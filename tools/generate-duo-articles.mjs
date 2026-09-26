#!/usr/bin/env node
/**
 * Расставляет немецкие артикли (der/die/das) по словарю Duolingo и пишет
 * src/app/data/duo-articles.ts.
 *
 * Зачем отдельным шагом, а не внутри generate-duo-words:
 *  - род в немецком лексический (das Wasser, но der Tee), вывести его из
 *    слова нельзя — нужен внешний источник;
 *  - этот шаг ходит в сеть и стоит денег, а пересборка списка слов — нет.
 *    Разделив их, `npm run gen:duo-words` остаётся бесплатным и быстрым;
 *  - результат — обычный текстовый файл, который можно руками поправить
 *    в спорных случаях, и он переживёт перегенерацию.
 *
 * Ключ — точное написание слова из duo-words.txt (регистр значит).
 *
 * Запуск:
 *   OR_KEY=<ключ OpenRouter> node tools/generate-duo-articles.mjs
 *   OR_KEY=... node tools/generate-duo-articles.mjs --force   # заново всё
 *   OR_KEY=... node tools/generate-duo-articles.mjs --only=Apfel,Brot
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wordsTxt = join(root, 'duo-words.txt');
const outFile = join(root, 'src', 'app', 'data', 'duo-articles.ts');

const KEY = process.env.OR_KEY;
const MODEL = 'google/gemini-2.5-flash-lite';
/** Слов в одном запросе. Больше — растёт риск, что модель потеряет часть. */
const BATCH = 100;
/** Пауза между запросами, чтобы не ловить rate limit. */
const DELAY_MS = 1200;
/** Повторов на пачку при неудачном или битом ответе. */
const MAX_TRIES = 3;

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg
  ? onlyArg
      .slice('--only='.length)
      .split(',')
      .map((s) => s.trim())
  : null;

if (!KEY && !only) {
  console.error('Нужен ключ: OR_KEY=<ключ OpenRouter> node tools/generate-duo-articles.mjs');
  process.exit(1);
}

/** Кандидаты в существительные: с заглавной буквы (в немецком это базовый признак). */
function readCandidates() {
  const raw = readFileSync(wordsTxt, 'utf8').replace(/^﻿/, '');
  const set = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const sep = line.indexOf(' - ');
    if (sep === -1) continue;
    const german = line.slice(0, sep).trim();
    if (!german) continue;
    // Имена собственные (Anna, Berlin) артикля в речи не имеют, но
    // определить их можно только по смыслу — поэтому шлём всё заглавное,
    // а решение «не существительное» принимает модель.
    if (!/^\p{Lu}/u.test(german)) continue;
    set.add(german);
  }
  return [...set];
}

/**
 * Приводит ответ модели к 'der'|'die'|'das'|null.
 *
 * Модель часто отдаёт строку "null" вместо JSON-null (проверено на
 * tools/probe-articles.mjs), поэтому нормализуем оба варианта. Всё
 * остальное — ошибка: молча превращать мусор в null нельзя, иначе
 * существительное тихо потеряет артикль.
 */
function normalizeArticle(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toLowerCase();
  if (text === 'null' || text === 'none' || text === '' || text === '-') return null;
  if (text === 'der' || text === 'die' || text === 'das') return text;
  return undefined; // мусор — вызывающий код переспросит
}

function buildPrompt(words) {
  return (
    'For each German word below, give its definite article in the nominative singular.\n' +
    'Rules:\n' +
    '- Common noun (including plurals and nominalised words): answer der, die or das.\n' +
    '- Proper name (person, city, country), verb, adjective, adverb, pronoun, ' +
    'preposition, conjunction, or multi-word phrase: answer null.\n' +
    '- German gender is lexical: never infer it from the meaning or the ending. ' +
    'Recall the established gender (e.g. das Wasser but der Tee, die Milch).\n' +
    '- For an ambiguous word, answer the most common noun sense.\n' +
    'Reply with ONLY a JSON object mapping each input word to der/die/das/null. ' +
    'No commentary.\n\n' +
    words.map((w) => `- ${w}`).join('\n')
  );
}

/**
 * Второй проход по словам, которым первый назначил null.
 *
 * Зачем: на первом проходе модель считает «не существительными» inflected-формы
 * (Antworten, Ärzte, Eier, Brüder) — они не совпадают со словарной формой,
 * и без уточнения она надёжно отвечает null. Для нас это ошибка: артикль у
 * таких слов есть, и карточка потеряла бы его требование.
 *
 * Ответы первого прохода не перебиваются: обновляем только те null, где
 * модель во втором проходе назвала конкретный артикль.
 */
function buildRefinePrompt(words) {
  return (
    'The German words below were tentatively classified as NOT nouns. Most were ' +
    'missed because they are inflected forms (plural or genitive) of ordinary nouns.\n' +
    'For EACH word decide again:\n' +
    '- If it is any inflected form of a common noun (plural -e/-en/-n, genitive -es, ' +
    'e.g. Antworten, Ärzte, Eier, Brüder, Beweises, Details), answer the article of ' +
    'the BASE noun (der/die/das).\n' +
    '- Answer null ONLY for: proper names of people, cities, countries and brands; ' +
    'names of languages; months and weekdays; and words that are not nouns at all.\n' +
    '- Every one of these is a real dictionary entry — decide, do not pass.\n' +
    'Reply with ONLY a JSON object mapping each input word to der/die/das/null. ' +
    'No commentary.\n\n' +
    words.map((w) => `- ${w}`).join('\n')
  );
}

async function askModel(words, build = buildPrompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [{ role: 'user', content: build(words) }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('в ответе нет JSON');

  const parsed = JSON.parse(match[0]);
  const result = new Map();
  for (const word of words) {
    if (!Object.prototype.hasOwnProperty.call(parsed, word)) continue;
    const article = normalizeArticle(parsed[word]);
    if (article === undefined) continue; // мусор — этот ответ не засчитываем
    result.set(word, article);
  }
  if (result.size === 0) throw new Error('пустой разбор ответа');
  return { result, cost: data.usage?.cost ?? 0 };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Читает уже собранный словарь артиклей, чтобы не платить повторно. */
function loadExisting() {
  if (!existsSync(outFile)) return new Map();
  const src = readFileSync(outFile, 'utf8');
  const map = new Map();
  // Формат строк:  'Kaffee': 'der',   'Anna': null,
  const re = /^\s*'((?:[^'\\]|\\.)*)':\s*(null|'der'|'die'|'das'),?\s*$/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const key = m[1].replace(/\\'/g, "'");
    map.set(key, m[2] === 'null' ? null : m[2].slice(1, -1));
  }
  return map;
}
function writeArticles(map) {
  const entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const body = entries
    .map(([word, article]) => `  '${esc(word)}': ${article === null ? 'null' : `'${article}'`},`)
    .join('\n');

  writeFileSync(
    outFile,
    `/**\n` +
      ` * Немецкие артикли для слов словаря Duolingo.\n` +
      ` * СГЕНЕРИРОВАНО из duo-words.txt через tools/generate-duo-articles.mjs.\n` +
      ` *\n` +
      ` * Ключ — слово из словаря (регистр значит), значение — 'der' | 'die' | 'das',\n` +
      ` * либо null, если это не существительное (глагол, прилагательное, имя\n` +
      ` * собственное, фраза) и артикля у него нет.\n` +
      ` *\n` +
      ` * Файл можно править руками: скрипт переиспользует уже записанные значения\n` +
      ` * и заново спрашивает только недостающие. Пересборка:\n` +
      ` *   OR_KEY=<ключ> node tools/generate-duo-articles.mjs\n` +
      ` */\n\n` +
      `import { Article } from '../models/flashcards';\n\n` +
      `/** Слово → артикль. null = существительным не является. */\n` +
      `export const DUO_ARTICLES: Record<string, Article | null> = {\n` +
      `${body}\n` +
      `};\n`,
    'utf8',
  );
}

// ── Запуск ─────────────────────────────────────────────────────────────────────

/** Прогоняет пачки через модель, повторяя при сбоях. */
async function runBatches(targets, build, { force = true } = {}) {
  let cost = 0;
  for (let i = 0; i < targets.length; i += BATCH) {
    const batch = targets.slice(i, i + BATCH);
    let done = false;
    for (let attempt = 1; attempt <= MAX_TRIES && !done; attempt++) {
      try {
        const { result, cost: c } = await askModel(batch, build);
        if (force) for (const [w, a] of result) known.set(w, a);
        else for (const [w, a] of result) if (a !== null) known.set(w, a);
        cost += c;
        done = true;
        process.stdout.write(
          `\r  ${Math.min(i + BATCH, targets.length)}/${targets.length}` +
            ` (в батче ${result.size}/${batch.length})   `,
        );
      } catch (error) {
        console.warn(`\n  попытка ${attempt}/${MAX_TRIES}: ${error.message}`);
        if (attempt === MAX_TRIES) {
          console.warn('  батч пропущен — эти слова попадут в следующий запуск');
        } else {
          await sleep(2000 * attempt);
        }
      }
    }
    if (i + BATCH < targets.length) await sleep(DELAY_MS);
  }
  return cost;
}

const allCandidates = readCandidates();
const known = force ? new Map() : loadExisting();

const refine = args.includes('--refine-nulls');
let targets = only
  ? allCandidates.filter((w) => new Set(only).has(w))
  : refine
    ? allCandidates.filter((w) => known.get(w) === null)
    : allCandidates.filter((w) => !known.has(w));

console.log(`Кандидатов в словаре: ${allCandidates.length}`);
console.log(`Уже известно: ${known.size}`);
console.log(`Запрашиваем: ${targets.length}${refine ? ' (уточнение null)' : ''}`);

if (targets.length && KEY) {
  // force=false во втором проходе: обновляем только null → конкретный артикль.
  const cost = await runBatches(targets, refine ? buildRefinePrompt : buildPrompt, {
    force: !refine,
  });
  console.log(`\nПотрачено: $${cost.toFixed(5)}`);
}

writeArticles(known);

const nouns = [...known.values()].filter((a) => a !== null).length;
const missing = allCandidates.filter((w) => !known.has(w));
console.log(`✓ Записано: ${outFile}`);
console.log(`  существительных: ${nouns}`);
console.log(`  не существительных: ${known.size - nouns}`);
console.log(`  всего в базе: ${known.size}`);
if (missing.length) {
  console.log(`  ⚠ без артикля осталось: ${missing.length}${only ? '' : ' (запустите ещё раз)'}`);
  console.log(`    ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`);
}

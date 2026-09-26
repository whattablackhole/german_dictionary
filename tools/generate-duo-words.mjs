#!/usr/bin/env node
/**
 * Конвертирует duo-words.txt (словарь Duolingo RU→DE) в TypeScript-модуль
 * src/app/data/duo-words.ts для режима карточек.
 *
 * Формат входного файла:
 *   1 CoffeeShop Заказывайте в кафе     ← заголовок юнита (номер, имя, тема)
 *    Kaffee - кофе                       ← слово (ведущий пробел, « - », переводы)
 *
 * Запуск:  node tools/generate-duo-words.mjs   (или npm run gen:duo-words)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'duo-words.txt');
const out = join(root, 'src', 'app', 'data', 'duo-words.ts');
/**
 * Словарь артиклей. Генерируется отдельным, сетевым скриптом
 * generate-duo-articles.mjs — здесь только читается, поэтому пересборка
 * списка слов остаётся бесплатной и мгновенной.
 */
const articlesFile = join(root, 'src', 'app', 'data', 'duo-articles.ts');

/** Читает duo-articles.ts в Map: слово → артикль либо null. */
function loadArticles() {
  if (!existsSync(articlesFile)) {
    console.warn(
      '⚠ src/app/data/duo-articles.ts не найден — слова соберутся без артиклей.\n' +
        '  Создайте его: OR_KEY=<ключ> node tools/generate-duo-articles.mjs',
    );
    return new Map();
  }
  const map = new Map();
  const re = /^\s*'((?:[^'\\]|\\.)*)':\s*(null|'der'|'die'|'das'),?\s*$/gm;
  let m;
  const text = readFileSync(articlesFile, 'utf8');
  while ((m = re.exec(text)) !== null) {
    map.set(m[1].replace(/\\'/g, "'"), m[2] === 'null' ? null : m[2].slice(1, -1));
  }
  return map;
}

const articles = loadArticles();

const raw = readFileSync(src, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/);

const units = [];
const words = [];
const skipped = [];
let currentUnit = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;

  // Заголовок юнита: строка, начинающаяся с цифры
  const unitMatch = /^(\d+)\s+(\S+)\s+(.*)$/.exec(line);
  if (unitMatch && !line.startsWith(' ')) {
    const order = parseInt(unitMatch[1], 10);
    const name = unitMatch[2];
    const theme = unitMatch[3].trim();
    currentUnit = { order, name, theme };
    units.push(currentUnit);
    continue;
  }

  // Слово: «немецкое - переводы» (с ведущим пробелом или без)
  const sep = line.indexOf(' - ');
  if (sep !== -1) {
    const german = line.slice(0, sep).trim();
    const translationsRaw = line.slice(sep + 3).trim();
    if (german && translationsRaw) {
      if (!currentUnit) {
        skipped.push(`строка ${i + 1}: слово до первого юнита — пропущено`);
        continue;
      }
      const russian = translationsRaw.split(',')[0].trim();
      words.push({ german, russian, translationsRaw, unit: currentUnit.order });
      continue;
    }
  }

  skipped.push(`строка ${i + 1}: не распознана — «${line.trim().slice(0, 60)}»`);
}

if (!units.length) {
  console.error('Не найдено ни одного юнита — проверьте формат duo-words.txt');
  process.exit(1);
}

// Проверка: юниты должны идти по возрастанию
for (let i = 1; i < units.length; i++) {
  if (units[i].order <= units[i - 1].order) {
    console.warn(`⚠ Юниты не по возрастанию: ${units[i - 1].order} → ${units[i].order}`);
  }
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const header =
  `/**\n` +
  ` * Словарь Duolingo RU→DE для режима карточек (RU → DE голосом).\n` +
  ` * СГЕНЕРИРОВАНО из duo-words.txt — не редактировать вручную.\n` +
  ` * Перегенерация: npm run gen:duo-words\n` +
  ` */\n\n` +
  `import { DuoUnit, DuoWord } from '../models/flashcards';\n\n`;

const unitsCode =
  `/** Юниты курса в порядке прохождения. */\n` +
  `export const DUO_UNITS: DuoUnit[] = [\n` +
  units
    .map(
      (u) =>
        `  { order: ${u.order}, name: '${esc(u.name)}', theme: '${esc(
          u.theme,
        )}', label: '${u.order} ${esc(u.name)} — ${esc(u.theme)}' },`,
    )
    .join('\n') +
  `\n];\n\n`;

const wordsCode =
  `/** Слова словаря (порядок как в источнике). */\n` +
  `export const DUO_WORDS: DuoWord[] = [\n` +
  words
    .map((w) => {
      // Артикль пишем только у существительных: у глаголов, прилагательных,
      // имён собственных и фраз его нет, и требовать его нельзя.
      const article = articles.get(w.german);
      const articleCode = article ? `, article: '${article}'` : '';
      return (
        `  { german: '${esc(w.german)}', russian: '${esc(w.russian)}', ` +
        `translationsRaw: '${esc(w.translationsRaw)}', unit: ${w.unit}${articleCode} },`
      );
    })
    .join('\n') +
  `\n];\n`;

writeFileSync(out, header + unitsCode + wordsCode, 'utf8');

console.log(`✓ Юнитов: ${units.length}`);
console.log(`✓ Слов: ${words.length}`);
console.log(`✓ С артиклем: ${words.filter((w) => articles.get(w.german)).length}`);
if (skipped.length) {
  console.warn(`⚠ Пропущено строк: ${skipped.length}`);
  for (const s of skipped.slice(0, 10)) console.warn('  ' + s);
}
console.log(`✓ Записано: ${out}`);

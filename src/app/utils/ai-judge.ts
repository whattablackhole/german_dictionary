/**
 * AI-судья режима карточек (RU → DE голосом).
 *
 * Судья — модель-классификатор Jev через специализированный OpenRouter
 * Decisions API (POST /api/alpha/decisions). Jev — «decisions model» и
 * chat/completions не поддерживает (HTTP 400). Дёшево: $0.042/M input,
 * $0/M output.
 *
 * Все чистые функции вынесены сюда, а не в сервис, чтобы их можно было
 * тестировать без Angular и без сети. Главное из них — `judgeLocally`:
 * он решает ответ локально за микросекунды, и только спорные случаи
 * отправляются в сеть (см. `AiService.judgeSpokenTranslation`).
 */
import { Article, JudgeVerdict } from '../models/flashcards';

/** Decisions endpoint (alpha) — единственный для Jev. */
export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';

/** Алиас «всегда последняя Jev». */
export const JUDGE_MODEL = '~typesafe/jev-latest';

/** Закреплённая версия — fallback, если алиас не резолвится на decisions. */
export const JUDGE_MODEL_PINNED = 'typesafe/jev-1.13';

/**
 * Инструкции судьи (поле instructions вопроса).
 *
 * Раньше здесь был один текст с припиской «Judge the WORD, not grammar or
 * articles». Теперь режимов два: когда игрок включил требование артикля,
 * артикль становится частью ответа, и судья обязан его проверять.
 */
const JUDGE_INSTRUCTIONS_BASE =
  'You are judging a spoken answer in a German vocabulary flashcard game. ' +
  'The card shows a Russian word; the user answered by SPEAKING German; ' +
  'speech recognition may be imperfect. Decide: can the spoken text be a ' +
  'correct German translation of the Russian word? The expected answer is ' +
  'only ONE valid option — accept any German word that is a correct ' +
  'translation of the Russian word (synonyms, other meanings of polysemous ' +
  'words, plural/singular, other translations from the list). Tolerate ' +
  'minor speech-recognition artifacts if the intended word is clear (wrong ' +
  'umlauts, "sh" for "sch"). Reject unrelated words even if they are valid ' +
  'German. ';

/** Свободный режим: артикль не нужен, слово засчитывается само по себе. */
export const JUDGE_INSTRUCTIONS =
  JUDGE_INSTRUCTIONS_BASE + 'Judge the WORD, not grammar or articles.';

/**
 * Строгий режим: кроме слова нужно названное определённое артикль.
 *
 * Судья здесь — последний рубеж: локальная проверка отправляет к нему как раз
 * спорные случаи (слово узнано, но артикль не совпал или отсутствует), иначе
 * ошибка распознавания «der» в «die» обернулась бы ложным «неверно».
 */
export const JUDGE_INSTRUCTIONS_STRICT =
  JUDGE_INSTRUCTIONS_BASE +
  'This card is a noun with a definite article, and the user was REQUIRED to ' +
  'say that article together with the word. The expected article is given ' +
  'below. The answer counts as correct only if BOTH parts are right: the ' +
  'correct noun AND the correct article. A missing article is incorrect. A ' +
  'wrong article is incorrect. Still judge the MEANING of the word leniently ' +
  '(synonyms and inflected forms count), and still tolerate speech-recognition ' +
  'artifacts in the noun itself; but the article is checked strictly. If the ' +
  'noun is right and the article is missing or different, answer incorrect.';

/** Текст инструкции под текущий режим. */
export function judgeInstructions(requireArticle: boolean): string {
  return requireArticle ? JUDGE_INSTRUCTIONS_STRICT : JUDGE_INSTRUCTIONS;
}

// ---- Типы Decisions API (по официальной документации OpenRouter) ----

export interface DecisionsQuestion {
  type: 'choice' | 'noul' | 'score';
  instructions: string;
  criteria: Record<string, string> | string[];
}

export interface DecisionsRequest {
  model: string;
  questions: Record<string, DecisionsQuestion>;
  /** Оцениваемый контент: строка или объект контекста. */
  state: Record<string, unknown> | string;
  provider?: { allow_fallbacks?: boolean };
}

export interface DecisionsAnswer {
  type?: string;
  /** Для type === 'choice'. */
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
  /** Для type === 'noul' (булев вопрос). */
  noul?: number;
}

export interface DecisionsResponse {
  answers?: Record<string, DecisionsAnswer>;
  model?: string;
  usage?: { cost?: number; input_tokens?: number; output_tokens?: number };
}

/**
 * Тело запроса к /api/alpha/decisions для одного вопроса:
 * «может ли сказанное быть переводом этого русского слова?»
 */
export function buildDecisionsPayload(config: {
  russian: string;
  translationsRaw: string;
  expectedGerman: string;
  spokenText: string;
  /** Требуемый артикль; вместе с requireArticle включает строгий режим. */
  expectedArticle?: Article;
  requireArticle?: boolean;
}): DecisionsRequest {
  // Строгий режим включается только когда артикль реально есть: у глаголов
  // и имён собственных его не требовать, даже если игрок включил тумблер.
  const strict = Boolean(config.requireArticle && config.expectedArticle);

  return {
    model: JUDGE_MODEL,
    questions: {
      verdict: {
        type: 'choice',
        instructions: judgeInstructions(strict),
        criteria: strict
          ? {
              correct:
                'The spoken text names the correct German noun AND uses the ' +
                'expected definite article (der, die or das).',
              incorrect:
                'The spoken noun is wrong, or the expected article is missing, ' +
                'or a different article was used.',
            }
          : {
              correct:
                'The spoken text is a valid German translation of the Russian ' +
                'word (any correct meaning of the word counts).',
              incorrect:
                'The spoken text is unrelated to the Russian word, or means ' +
                'something different.',
            },
      },
    },
    state: {
      russian: config.russian,
      translations: config.translationsRaw,
      expected_german: config.expectedGerman,
      ...(strict ? { expected_article: config.expectedArticle } : {}),
      spoken: config.spokenText,
    },
  };
}

/**
 * Разбор ответа Decisions API. Ожидаем answers.verdict типа 'choice'
 * с выбором correct/incorrect; на всякий случай понимаем и 'noul'.
 */
export function parseDecisionsResponse(data: DecisionsResponse): JudgeVerdict {
  const answer = data && data.answers ? data.answers['verdict'] : undefined;
  if (!answer) {
    throw new Error('Judge returned no verdict.');
  }

  if (answer.type === 'choice' || answer.choice !== undefined) {
    const correct = answer.choice === 'correct';
    return { correct, reason: confidenceReason(answer.confidence) };
  }

  if (answer.type === 'noul' && typeof answer.noul === 'number') {
    return { correct: answer.noul >= 0.5, reason: confidenceReason(answer.noul) };
  }

  throw new Error('Judge returned an unknown answer format.');
}

function confidenceReason(confidence?: number): string {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return '';
  return `уверенность ${Math.round(confidence * 100)}%`;
}

// ── Локальная проверка ответа (без сети) ──────────────────────────────────────

/**
 * Немецкие артикли и их падежные формы.
 *
 * Раньше это был просто STOP_WORDS: артикли выбрасывались перед сравнением,
 * потому что режим был один. Теперь в строгом режиме артикль — часть
 * ответа, поэтому его надо уметь и опознать, и потребовать.
 */
const ARTICLES = new Set(['der', 'die', 'das']);
const STOP_WORDS = new Set([
  ...ARTICLES,
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'eines',
]);

/** Назван ли в ответе именно этот артикль (в любом падеже формы не важны). */
export function mentionsArticle(text: string, article: Article): boolean {
  return normalizeGerman(text)
    .split(' ')
    .some((word) => ARTICLES.has(word) && word === article);
}

/** Назван ли в ответе какой-либо артикль — чтобы отличить «забыл» от «неверный». */
export function mentionsAnyArticle(text: string): boolean {
  return normalizeGerman(text)
    .split(' ')
    .some((word) => ARTICLES.has(word));
}

/** Убираем пунктуацию и лишние пробелы, приводим к нижнему регистру. */
export function normalizeGerman(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[^a-zäöüß\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Значимые слова ответа: без артиклей и пунктуации. */
export function contentWords(text: string): string[] {
  return normalizeGerman(text)
    .split(' ')
    .filter((word) => word && !STOP_WORDS.has(word));
}

/**
 * Приводим слово к «фонетическому» виду: сглаживаем систематические
 * ошибки распознавания, которые повторяются от слова к слову
 * (ш/сх → š, з/с → с, в/w → в, ck → к, ß → с).
 * Применяется к обоим сторонам сравнения, поэтому Kaffee и «кафее» сходятся.
 */
export function soundsLike(word: string): string {
  return (word ?? '')
    .toLowerCase()
    .replace(/tsch/g, 'š')
    .replace(/sch/g, 'š')
    .replace(/ck/g, 'k')
    .replace(/ch/g, 'x')
    .replace(/z/g, 's')
    .replace(/v/g, 'f')
    .replace(/w/g, 'v')
    .replace(/ß/g, 'ss');
}

/**
 * Расстояние Левенштейна с ранним выходом: как только минимальная стоимость
 * в строке превысила лимит, считать дальше бессмысленно.
 */
export function editDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > limit) return limit + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[b.length];
}

/**
 * Сколько опечаток в слове мы готовы простить. Короткие — одну букву,
 * длинные — две: иначе «машина» склеится с «мажорной».
 */
export function recognitionTolerance(word: string): number {
  if (word.length <= 4) return 1;
  if (word.length <= 8) return 2;
  return 3;
}

/** Формы, которые засчитываем как «это то самое слово»: Kaffee → Kaffe. */
export function acceptableGermanForms(word: { german: string }): string[] {
  const base = normalizeGerman(word.german);
  if (!base) return [];
  const forms = new Set<string>([base]);
  if (base.length > 4) forms.add(base.replace(/(e|en|er|es)$/, ''));
  return [...forms];
}

/** Ожидаемое слово плюс немецкие синонимы, если они есть в переводах. */
function candidateForms(config: { expectedGerman: string; translationsRaw?: string }): string[] {
  const forms = acceptableGermanForms({ german: config.expectedGerman });
  // translationsRaw — это русские переводы, а не немецкие, поэтому берём
  // оттуда только явно немецские синонимы (латиница с заглавной буквы).
  for (const raw of (config.translationsRaw ?? '').split(/[,;]/)) {
    const trimmed = raw.trim();
    if (trimmed && /^[A-ZÄÖÜ]/.test(trimmed)) {
      for (const form of acceptableGermanForms({ german: trimmed })) forms.push(form);
    }
  }
  return [...new Set(forms)];
}

/**
 * Пытается решить задачу локально, без обращения к AI-судье.
 *
 * Возвращает вердикт, только когда ответ однозначен (совпадение с
 * ожидаемым словом или его формой, с прощённой опечаткой или после
 * фонетической нормализации) — это экономит сетевой запрос на
 * большинстве карточек. `null` означает «нужно спросить судью»: так мы
 * никогда не занижаем оценку сомнительному ответу.
 */
/**
 * Пытается решить задачу локально, без обращения к AI-судье.
 *
 * Возвращает вердикт, только когда ответ однозначен (совпадение с
 * ожидаемым словом или его формой, с прощённой опечаткой или после
 * фонетической нормализации) — это экономит сетевой запрос на
 * большинстве карточек. `null` означает «нужно спросить судью»: так мы
 * никогда не занижаем оценку сомнительному ответу.
 *
 * Про артикли: локально мы **никогда** не ставим «неверно» из-за артикля.
 * «der» и «die» звучат почти одинаково, и Whisper регулярно их путает —
 * объявить карточку ошибкой по такому поводу значит научить игрока неверно.
 * Поэтому несовпадение артикля уходит судье, у которого есть и текст
 * ответа, и контекст карточки.
 */
export function judgeLocally(config: {
  expectedGerman: string;
  translationsRaw?: string;
  spokenText: string;
  /** Требуемый артикль (только для существительных). */
  expectedArticle?: Article;
  /** Включён ли тумблер «произносить с артиклем». */
  requireArticle?: boolean;
}): JudgeVerdict | null {
  const spoken = contentWords(config.spokenText);
  if (spoken.length === 0) return null;

  const forms = candidateForms(config);
  if (forms.length === 0) return null;

  // Ищем, названо ли нужное слово, и заодно запоминаем почему совпало.
  let reason: string | null = null;
  for (const word of spoken) {
    for (const form of forms) {
      if (word === form) {
        reason = 'точное совпадение';
        break;
      }
      // Прощаем опечатки в том же слове: «Kafee» → «Kaffee».
      const tolerance = recognitionTolerance(form);
      if (editDistance(word, form, tolerance) <= tolerance) {
        reason = 'совпадение с опечаткой';
        break;
      }
      // Прощаем систематические ошибки распознавания: «ш»/«сх», «с»/«з».
      if (soundsLike(word) === soundsLike(form)) {
        reason = 'совпадение после нормализации';
        break;
      }
    }
    if (reason) break;
  }

  // Слово не узнано — без сети не разберёмся (в том числе из-за артикля).
  if (!reason) return null;

  const strict = Boolean(config.requireArticle && config.expectedArticle);
  if (!strict) return { correct: true, reason };

  // Слово верное. Если нужный артикль прозвучал — всё ясно, отвечаем сразу.
  if (mentionsArticle(config.spokenText, config.expectedArticle as Article)) {
    return { correct: true, reason: `${reason}, артикль назван` };
  }

  // Слово верное, но артикля нет или он другой. Решать здесь опасно:
  // это одинаково выглядит и как ошибка игрока, и как огрех распознавания.
  return null;
}

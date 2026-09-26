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
import { JudgeVerdict } from '../models/flashcards';

/** Decisions endpoint (alpha) — единственный для Jev. */
export const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';

/** Алиас «всегда последняя Jev». */
export const JUDGE_MODEL = '~typesafe/jev-latest';

/** Закреплённая версия — fallback, если алиас не резолвится на decisions. */
export const JUDGE_MODEL_PINNED = 'typesafe/jev-1.13';

/** Инструкции судьи (поле instructions вопроса). */
export const JUDGE_INSTRUCTIONS =
  'You are judging a spoken answer in a German vocabulary flashcard game. ' +
  'The card shows a Russian word; the user answered by SPEAKING German; ' +
  'speech recognition may be imperfect. Decide: can the spoken text be a ' +
  'correct German translation of the Russian word? The expected answer is ' +
  'only ONE valid option — accept any German word that is a correct ' +
  'translation of the Russian word (synonyms, other meanings of polysemous ' +
  'words, plural/singular, other translations from the list). Tolerate ' +
  'minor speech-recognition artifacts if the intended word is clear (wrong ' +
  'umlauts, "sh" for "sch"). Reject unrelated words even if they are valid ' +
  'German. Judge the WORD, not grammar or articles.';

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
}): DecisionsRequest {
  return {
    model: JUDGE_MODEL,
    questions: {
      verdict: {
        type: 'choice',
        instructions: JUDGE_INSTRUCTIONS,
        criteria: {
          correct:
            'The spoken text is a valid German translation of the Russian ' +
            'word (any correct meaning of the word counts).',
          incorrect:
            'The spoken text is unrelated to the Russian word, or means ' + 'something different.',
        },
      },
    },
    state: {
      russian: config.russian,
      translations: config.translationsRaw,
      expected_german: config.expectedGerman,
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

/** Немецкие артикли: в произнесённой фразе они не несут смысла. */
const STOP_WORDS = new Set([
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'einem',
  'eines',
]);

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
export function judgeLocally(config: {
  expectedGerman: string;
  translationsRaw?: string;
  spokenText: string;
}): JudgeVerdict | null {
  const spoken = contentWords(config.spokenText);
  if (spoken.length === 0) return null;

  const forms = candidateForms(config);
  if (forms.length === 0) return null;

  for (const word of spoken) {
    for (const form of forms) {
      if (word === form) return { correct: true, reason: 'точное совпадение' };

      // Прощаем опечатки в том же слове: «Kafee» → «Kaffee».
      const tolerance = recognitionTolerance(form);
      if (editDistance(word, form, tolerance) <= tolerance) {
        return { correct: true, reason: 'совпадение с опечаткой' };
      }

      // Прощаем систематические ошибки распознавания: «ш»/«сх», «с»/«з».
      if (soundsLike(word) === soundsLike(form)) {
        return { correct: true, reason: 'совпадение после нормализации' };
      }
    }
  }
  return null;
}

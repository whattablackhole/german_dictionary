import { DifficultyLevel } from '../models/word';
import { StoryExercise } from '../models/story-exercise';
import { GeneratedStoryExercise } from './ai.service';
/**
 * Fisher-Yates shuffle. Returns a NEW array; the input is not mutated.
 */
export function shuffleOptions<T>(arr: readonly T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Normalizes an AI-provided option list: trims every option, drops empty
 * strings and exact duplicates, guarantees `correct` is present exactly once,
 * then shuffles the result. LLMs reliably put the correct answer first when
 * asked for a "random order", so we always re-shuffle client-side — otherwise
 * the correct answer would sit at a predictable position in every exercise.
 */
export function normalizeOptions(options: string[], correct: string): string[] {
  const unique = Array.from(
    new Set(options.map((o) => String(o).trim()).filter((o) => o.length > 0))
  );
  if (!unique.includes(correct)) unique.push(correct);
  return shuffleOptions(unique);
}

/** Option-array fields on a StoryExercise and the field holding the correct value. */
const MC_OPTION_FIELDS: {
  options:
    | 'mcOptions'
    | 'mcSentenceOptions'
    | 'mcPluralOptions'
    | 'mcVerbPastOptions'
    | 'mcVerbPerfectOptions'
    | 'mcComparativeOptions'
    | 'mcSuperlativeOptions';
  correct:
    | 'mcCorrect'
    | 'mcSentenceCorrect'
    | 'mcPluralCorrect'
    | 'mcVerbPastCorrect'
    | 'mcVerbPerfectCorrect'
    | 'mcComparativeCorrect'
    | 'mcSuperlativeCorrect';
}[] = [
  { options: 'mcOptions', correct: 'mcCorrect' },
  { options: 'mcSentenceOptions', correct: 'mcSentenceCorrect' },
  { options: 'mcPluralOptions', correct: 'mcPluralCorrect' },
  { options: 'mcVerbPastOptions', correct: 'mcVerbPastCorrect' },
  { options: 'mcVerbPerfectOptions', correct: 'mcVerbPerfectCorrect' },
  { options: 'mcComparativeOptions', correct: 'mcComparativeCorrect' },
  { options: 'mcSuperlativeOptions', correct: 'mcSuperlativeCorrect' },
];

/**
 * Returns a copy of the exercise with every multiple-choice option list
 * re-shuffled so the correct answer never sits at a predictable position.
 * Grading compares the picked string to the independent `*Correct` field,
 * so reordering is safe. Used when a session is built so even exercises
 * replayed from stored history get randomized options.
 */
export function withShuffledOptions(ex: StoryExercise): StoryExercise {
  const copy: StoryExercise = { ...ex };
  for (const field of MC_OPTION_FIELDS) {
    const opts = ex[field.options];
    const correct = ex[field.correct];
    if (Array.isArray(opts) && typeof correct === 'string') {
      copy[field.options] = normalizeOptions(opts, correct);
    }
  }
  return copy;
}

/**
 * Converts an AI-generated story exercise into a validated `StoryExercise`.
 * Shared by the Stories page and the Word Practice page so both generate the
 * exact same exercise types and validation rules. Returns null for malformed
 * exercises that cannot be rendered.
 */
export function toStoryExercise(
  g: GeneratedStoryExercise,
  storyId: string,
  level: DifficultyLevel
): StoryExercise | null {
  const base = {
    id: crypto.randomUUID(),
    storyId,
    word: g.word,
    level,
  };

  switch (g.type) {
    case 'mc': {
      if (!g.mcPrompt || !g.mcCorrect || !Array.isArray(g.mcOptions)) return null;
      const correct = String(g.mcCorrect).trim();
      if (!correct) return null;
      const options = normalizeOptions(g.mcOptions, correct);
      if (options.length < 2) return null;
      return {
        ...base,
        type: 'mc',
        mcPrompt: g.mcPrompt,
        mcOptions: options,
        mcCorrect: correct,
        mcDirection: g.mcDirection ?? 'de-native',
      };
    }
    case 'mc-sentence': {
      if (!g.mcSentence || !g.mcSentenceCorrect || !Array.isArray(g.mcSentenceOptions)) return null;
      const correct = String(g.mcSentenceCorrect).trim();
      if (!correct) return null;
      const opts = normalizeOptions(g.mcSentenceOptions, correct);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-sentence',
        mcSentence: g.mcSentence,
        mcSentenceOptions: opts,
        mcSentenceCorrect: correct,
      };
    }
    case 'mc-plural': {
      if (!g.mcPluralPrompt || !g.mcPluralCorrect || !Array.isArray(g.mcPluralOptions)) return null;
      const correct = String(g.mcPluralCorrect).trim();
      if (!correct) return null;
      const opts = normalizeOptions(g.mcPluralOptions, correct);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-plural',
        mcPluralPrompt: g.mcPluralPrompt,
        mcPluralOptions: opts,
        mcPluralCorrect: correct,
      };
    }
    case 'mc-verb-past': {
      if (!g.mcVerbPastPrompt || !g.mcVerbPastCorrect || !Array.isArray(g.mcVerbPastOptions)) return null;
      const correct = String(g.mcVerbPastCorrect).trim();
      if (!correct) return null;
      const opts = normalizeOptions(g.mcVerbPastOptions, correct);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-verb-past',
        mcVerbPastPrompt: g.mcVerbPastPrompt,
        mcVerbPastOptions: opts,
        mcVerbPastCorrect: correct,
      };
    }
    case 'mc-verb-perfect': {
      if (!g.mcVerbPerfectPrompt || !g.mcVerbPerfectCorrect || !Array.isArray(g.mcVerbPerfectOptions)) return null;
      const correct = String(g.mcVerbPerfectCorrect).trim();
      if (!correct) return null;
      const opts = normalizeOptions(g.mcVerbPerfectOptions, correct);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-verb-perfect',
        mcVerbPerfectPrompt: g.mcVerbPerfectPrompt,
        mcVerbPerfectOptions: opts,
        mcVerbPerfectCorrect: correct,
      };
    }
    case 'mc-comparative': {
      if (!g.mcComparativePrompt || !g.mcComparativeCorrect || !Array.isArray(g.mcComparativeOptions)) return null;
      const correct = String(g.mcComparativeCorrect).trim();
      if (!correct) return null;
      const opts = normalizeOptions(g.mcComparativeOptions, correct);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-comparative',
        mcComparativePrompt: g.mcComparativePrompt,
        mcComparativeOptions: opts,
        mcComparativeCorrect: correct,
      };
    }
    case 'mc-superlative': {
      if (!g.mcSuperlativePrompt || !g.mcSuperlativeCorrect || !Array.isArray(g.mcSuperlativeOptions)) return null;
      const correct = String(g.mcSuperlativeCorrect).trim();
      if (!correct) return null;
      const opts = normalizeOptions(g.mcSuperlativeOptions, correct);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-superlative',
        mcSuperlativePrompt: g.mcSuperlativePrompt,
        mcSuperlativeOptions: opts,
        mcSuperlativeCorrect: correct,
      };
    }
    case 'cloze': {
      if (!g.clozeSentence || !Array.isArray(g.clozeBlankWords)) return null;
      const blanks = g.clozeBlankWords
        .map((w) => String(w).trim())
        .filter((w) => w.length > 0 && g.clozeSentence!.includes(w));
      if (blanks.length === 0) return null;
      return {
        ...base,
        type: 'cloze',
        clozeSentence: g.clozeSentence,
        clozeBlankWords: blanks,
        clozeHint: g.clozeHint ?? '',
      };
    }
    case 'sentence': {
      if (!g.sentenceGerman || !g.sentenceNative) return null;
      return {
        ...base,
        type: 'sentence',
        sentenceGerman: g.sentenceGerman,
        sentenceNative: g.sentenceNative,
      };
    }
    default:
      return null;
  }
}
import { DifficultyLevel } from '../models/word';
import { StoryExercise } from '../models/story-exercise';
import { GeneratedStoryExercise } from './ai.service';

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
      const options = g.mcOptions
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0);
      if (!options.includes(g.mcCorrect)) options.push(g.mcCorrect);
      if (options.length < 2) return null;
      return {
        ...base,
        type: 'mc',
        mcPrompt: g.mcPrompt,
        mcOptions: options,
        mcCorrect: g.mcCorrect,
        mcDirection: g.mcDirection ?? 'de-native',
      };
    }
    case 'mc-sentence': {
      if (!g.mcSentence || !g.mcSentenceCorrect || !Array.isArray(g.mcSentenceOptions)) return null;
      const opts = g.mcSentenceOptions
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0);
      if (!opts.includes(g.mcSentenceCorrect)) opts.push(g.mcSentenceCorrect);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-sentence',
        mcSentence: g.mcSentence,
        mcSentenceOptions: opts,
        mcSentenceCorrect: g.mcSentenceCorrect,
      };
    }
    case 'mc-plural': {
      if (!g.mcPluralPrompt || !g.mcPluralCorrect || !Array.isArray(g.mcPluralOptions)) return null;
      const opts = g.mcPluralOptions
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0);
      if (!opts.includes(g.mcPluralCorrect)) opts.push(g.mcPluralCorrect);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-plural',
        mcPluralPrompt: g.mcPluralPrompt,
        mcPluralOptions: opts,
        mcPluralCorrect: g.mcPluralCorrect,
      };
    }
    case 'mc-verb-past': {
      if (!g.mcVerbPastPrompt || !g.mcVerbPastCorrect || !Array.isArray(g.mcVerbPastOptions)) return null;
      const opts = g.mcVerbPastOptions
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0);
      if (!opts.includes(g.mcVerbPastCorrect)) opts.push(g.mcVerbPastCorrect);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-verb-past',
        mcVerbPastPrompt: g.mcVerbPastPrompt,
        mcVerbPastOptions: opts,
        mcVerbPastCorrect: g.mcVerbPastCorrect,
      };
    }
    case 'mc-verb-perfect': {
      if (!g.mcVerbPerfectPrompt || !g.mcVerbPerfectCorrect || !Array.isArray(g.mcVerbPerfectOptions)) return null;
      const opts = g.mcVerbPerfectOptions
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0);
      if (!opts.includes(g.mcVerbPerfectCorrect)) opts.push(g.mcVerbPerfectCorrect);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-verb-perfect',
        mcVerbPerfectPrompt: g.mcVerbPerfectPrompt,
        mcVerbPerfectOptions: opts,
        mcVerbPerfectCorrect: g.mcVerbPerfectCorrect,
      };
    }
    case 'mc-comparative': {
      if (!g.mcComparativePrompt || !g.mcComparativeCorrect || !Array.isArray(g.mcComparativeOptions)) return null;
      const opts = g.mcComparativeOptions
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0);
      if (!opts.includes(g.mcComparativeCorrect)) opts.push(g.mcComparativeCorrect);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-comparative',
        mcComparativePrompt: g.mcComparativePrompt,
        mcComparativeOptions: opts,
        mcComparativeCorrect: g.mcComparativeCorrect,
      };
    }
    case 'mc-superlative': {
      if (!g.mcSuperlativePrompt || !g.mcSuperlativeCorrect || !Array.isArray(g.mcSuperlativeOptions)) return null;
      const opts = g.mcSuperlativeOptions
        .map((o) => String(o).trim())
        .filter((o) => o.length > 0);
      if (!opts.includes(g.mcSuperlativeCorrect)) opts.push(g.mcSuperlativeCorrect);
      if (opts.length < 2) return null;
      return {
        ...base,
        type: 'mc-superlative',
        mcSuperlativePrompt: g.mcSuperlativePrompt,
        mcSuperlativeOptions: opts,
        mcSuperlativeCorrect: g.mcSuperlativeCorrect,
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
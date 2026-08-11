import { Injectable, signal } from '@angular/core';
import { DifficultyLevel, Word } from '../models/word';
import { WordExercise } from '../models/word-exercise';

const STORAGE_KEY = 'german-dictionary-word-exercises';

@Injectable({ providedIn: 'root' })
export class WordExerciseService {
  readonly exercises = signal<WordExercise[]>(this.loadExercises());

  getExercises(): WordExercise[] {
    return this.exercises();
  }

  getExercisesByLevels(levels: DifficultyLevel[]): WordExercise[] {
    if (levels.length === 0) {
      return this.exercises();
    }
    return this.exercises().filter((e) => levels.includes(e.level));
  }

  /** Exercises with sessionCount === 0 (never practiced) */
  getNewExercises(
    levels: DifficultyLevel[],
    domain?: string
  ): WordExercise[] {
    let result = this.getExercisesByLevels(levels);
    if (domain) {
      result = result.filter(
        (e) => e.domain.toLowerCase() === domain.toLowerCase()
      );
    }
    return result.filter((e) => e.sessionCount === 0);
  }

  /** Exercises with sessionCount > 0 AND word.mastery < 100 (still learning) */
  getInProgressExercises(
    levels: DifficultyLevel[],
    domain?: string,
    words?: Word[]
  ): WordExercise[] {
    let result = this.getExercisesByLevels(levels);
    if (domain) {
      result = result.filter(
        (e) => e.domain.toLowerCase() === domain.toLowerCase()
      );
    }
    return result.filter((e) => {
      if (e.sessionCount === 0) return false;
      if (!words) return true;
      const word = words.find((w) => w.id === e.wordId);
      return !word || word.mastery < 100;
    });
  }

  /** Exercises where the associated word has mastery >= 100 */
  getMasteredExercises(
    levels: DifficultyLevel[],
    domain?: string,
    words?: Word[]
  ): WordExercise[] {
    let result = this.getExercisesByLevels(levels);
    if (domain) {
      result = result.filter(
        (e) => e.domain.toLowerCase() === domain.toLowerCase()
      );
    }
    if (!words) return [];
    return result.filter((e) => {
      const word = words.find((w) => w.id === e.wordId);
      return word && word.mastery >= 100;
    });
  }

  getExercisesForWord(wordId: string): WordExercise[] {
    return this.exercises().filter((e) => e.wordId === wordId);
  }

  /**
   * Returns:
   * - wordIdsToExclude: wordIds where mastery >= 100 (skip entirely)
   * - existingSentences: map of wordId → fullSentence for words with < 100 mastery that have exactly 1 exercise
   * - allSentences: map of wordId → all fullSentence values for words with < 100 mastery
   */
  getGenerationContext(words: Word[]): {
    wordIdsToExclude: Set<string>;
    existingSentences: Map<string, string>;
    allSentences: Map<string, string[]>;
  } {
    const wordIdsToExclude = new Set<string>();
    const existingSentences = new Map<string, string>();
    const allSentences = new Map<string, string[]>();

    // Build set of mastered word ids
    const masteredIds = new Set(
      words.filter((w) => w.mastery >= 100).map((w) => w.id)
    );

    for (const ex of this.exercises()) {
      // Skip if the word is mastered
      if (masteredIds.has(ex.wordId)) {
        wordIdsToExclude.add(ex.wordId);
        continue;
      }

      // Collect all sentences for this word
      const existing = allSentences.get(ex.wordId) || [];
      existing.push(ex.fullSentence);
      allSentences.set(ex.wordId, existing);

      // Track single-sentence words for avoidSentences
      if (existingSentences.has(ex.wordId)) {
        existingSentences.delete(ex.wordId);
      } else if (!wordIdsToExclude.has(ex.wordId)) {
        existingSentences.set(ex.wordId, ex.fullSentence);
      }
    }

    // Words with 2+ exercises are not excluded (they can get more varied sentences)
    // But we still pass all their sentences as avoidSentences
    return { wordIdsToExclude, existingSentences, allSentences };
  }

  addExercises(exercises: Omit<WordExercise, 'id' | 'createdAt'>[]): void {
    const now = new Date().toISOString();
    const newExercises: WordExercise[] = exercises.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      createdAt: now,
    }));
    this.exercises.update((existing) => [...existing, ...newExercises]);
    this.save();
  }

  recordAttempt(id: string): void {
    this.exercises.update((exercises) =>
      exercises.map((e) =>
        e.id === id ? { ...e, sessionCount: e.sessionCount + 1 } : e
      )
    );
    this.save();
  }

  private loadExercises(): WordExercise[] {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as WordExercise[];
      } catch {
        return [];
      }
    }
    return [];
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.exercises()));
  }
}
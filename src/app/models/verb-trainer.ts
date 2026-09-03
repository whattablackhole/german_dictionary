import {
  GERMAN_PERSONS,
  GERMAN_TENSES,
  GermanPerson,
  GermanTense,
} from '../utils/german';

/** A conjugation slot: one of the German finite tenses × one person. */
export type VerbTrainerPerson = GermanPerson;
export type VerbTrainerTense = GermanTense;

export type VerbDrillMode = 'typed' | 'mc' | 'sentence';

/** One recorded attempt in the verb trainer (used for weak-point analysis later). */
export interface VerbTrainerAttempt {
  verb: string;
  person: VerbTrainerPerson;
  tense: VerbTrainerTense;
  mode: VerbDrillMode;
  /** What the student wrote or picked. */
  answer: string;
  correct: boolean;
  /** The expected/correct form. */
  expected: string;
  score: number;
  explanation: string;
  /** ISO timestamp of the attempt. */
  ts: string;
}
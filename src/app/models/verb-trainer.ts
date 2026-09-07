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

/** Aggregated stats for one verb across all recorded attempts. */
export interface VerbTrainerStatsRow {
  verb: string;
  /** Total recorded attempts for the verb. */
  total: number;
  /** How many of the attempts were correct. */
  correct: number;
  /** Success rate in percent (0-100). */
  accuracy: number;
}

/** Stats across every recorded attempt (all verbs). */
export interface VerbTrainerOverallStats {
  /** Distinct verbs with at least one recorded attempt. */
  verbsTrained: number;
  /** Total recorded attempts. */
  totalAttempts: number;
  /** How many of the attempts were correct. */
  totalCorrect: number;
  /** Overall success rate in percent (0-100). */
  accuracy: number;
}

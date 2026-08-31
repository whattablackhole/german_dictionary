export interface StoryQuestion {
  id: string;
  storyId: string;
  /** The comprehension question about the story, in German. */
  question: string;
  /** Native (en/ru, per settings) translation of the question. */
  questionTranslation: string;
  /** The German model answer (a full sentence). */
  answer: string;
  /** Optional hint phrase shown before answering. */
  hint?: string;
}
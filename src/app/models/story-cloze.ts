export interface StoryClozeSentence {
  /** A story sentence verbatim (as returned by the AI). */
  text: string;
  /** The words removed from this sentence (0-2), in the order they appeared. */
  removedWords: string[];
}

export interface StoryCloze {
  id: string;
  storyId: string;
  /** Every story sentence, in order; sentences without removals keep an empty list. */
  sentences: StoryClozeSentence[];
}
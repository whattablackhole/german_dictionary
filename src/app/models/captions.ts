export interface CaptionSegment {
  timestamp: string;
  text: string;
}

export interface CaptionCorrection {
  original: string;
  corrected: string;
  explanation: string;
}

export interface CorrectedCaption {
  id: string;
  timestamp: number;
  rawText: string;
  correctedText: string;
  corrections: CaptionCorrection[];
  segments: CaptionSegment[];
}

export interface GrammarExplanation {
  translation: string;
  sentenceStructure: string;
  grammarNotes: string[];
  wordExplanations: { word: string; explanation: string }[];
}
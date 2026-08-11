import { Injectable } from '@angular/core';
import { PartOfSpeech } from '../models/word';

export interface PartOfSpeechInfo {
  key: PartOfSpeech;
  label: string;
  shortLabel: string;
}

const PARTS_OF_SPEECH: PartOfSpeechInfo[] = [
  { key: 'noun', label: 'Noun', shortLabel: 'N.' },
  { key: 'verb', label: 'Verb', shortLabel: 'V.' },
  { key: 'adjective', label: 'Adjective', shortLabel: 'Adj.' },
  { key: 'adverb', label: 'Adverb', shortLabel: 'Adv.' },
  { key: 'pronoun', label: 'Pronoun', shortLabel: 'Pron.' },
  { key: 'preposition', label: 'Preposition', shortLabel: 'Prep.' },
  { key: 'conjunction', label: 'Conjunction', shortLabel: 'Conj.' },
  { key: 'interjection', label: 'Interjection', shortLabel: 'Int.' },
  { key: 'numeral', label: 'Numeral', shortLabel: 'Num.' },
  { key: 'phrase', label: 'Phrase', shortLabel: 'Phr.' },
];

@Injectable({ providedIn: 'root' })
export class PartOfSpeechService {
  getAll(): PartOfSpeechInfo[] {
    return [...PARTS_OF_SPEECH];
  }

  getLabel(key: PartOfSpeech): string {
    return PARTS_OF_SPEECH.find((p) => p.key === key)?.label ?? key;
  }

  getShortLabel(key: PartOfSpeech): string {
    return PARTS_OF_SPEECH.find((p) => p.key === key)?.shortLabel ?? key;
  }
}
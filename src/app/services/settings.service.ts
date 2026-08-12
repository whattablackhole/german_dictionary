import { Injectable, signal } from '@angular/core';
import { TranslationLanguage, Word } from '../models/word';

const LANGUAGE_STORAGE_KEY = 'german-dictionary-translation-language';
const SHOW_ARTICLE_KEY = 'german-dictionary-show-article-practice';
const TTS_ENGINE_KEY = 'german-dictionary-tts-engine';

export type TtsEngine = 'browser' | 'openai';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly translationLanguage = signal<TranslationLanguage>(
    (localStorage.getItem(LANGUAGE_STORAGE_KEY) as TranslationLanguage) ?? 'ru'
  );

  readonly showArticleInPractice = signal<boolean>(
    localStorage.getItem(SHOW_ARTICLE_KEY) !== 'false'
  );

  readonly ttsEngine = signal<TtsEngine>(
    (localStorage.getItem(TTS_ENGINE_KEY) as TtsEngine) ?? 'browser'
  );

  setTranslationLanguage(language: TranslationLanguage): void {
    this.translationLanguage.set(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }

  setShowArticleInPractice(show: boolean): void {
    this.showArticleInPractice.set(show);
    localStorage.setItem(SHOW_ARTICLE_KEY, String(show));
  }

  setTtsEngine(engine: TtsEngine): void {
    this.ttsEngine.set(engine);
    localStorage.setItem(TTS_ENGINE_KEY, engine);
  }

  getTranslation(word: Word): string {
    return this.translationLanguage() === 'ru'
      ? word.translationRu
      : word.translationEn;
  }
}

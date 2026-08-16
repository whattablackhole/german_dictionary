import { Injectable, signal } from '@angular/core';
import { TranslationLanguage, Word } from '../models/word';

const LANGUAGE_STORAGE_KEY = 'german-dictionary-translation-language';
const SHOW_ARTICLE_KEY = 'german-dictionary-show-article-practice';
const TTS_ENGINE_KEY = 'german-dictionary-tts-engine';
const TTS_MODEL_KEY = 'german-dictionary-tts-model';
const TTS_VOICE_KEY = 'german-dictionary-tts-voice';
const LOOKUP_MODIFIER_KEY = 'german-dictionary-lookup-modifier';

export type TtsEngine = 'browser' | 'openai';
export type LookupModifier = 'alt' | 'ctrl' | 'meta' | 'shift';

export interface TtsModelOption {
  id: string;
  label: string;
  description: string;
  voices: TtsVoiceOption[];
}

export interface TtsVoiceOption {
  id: string;
  label: string;
}

export const TTS_MODELS: TtsModelOption[] = [
  {
    id: 'microsoft/mai-voice-2-flash',
    label: 'Microsoft MAI-Voice-2 Flash',
    description: 'Fast German TTS with a natural native German voice',
    voices: [
      { id: 'de-DE-Klaus:MAI-Voice-2', label: 'Klaus — male' },
    ],
  },
  {
    id: 'google/gemini-3.1-flash-tts-preview',
    label: 'Google Gemini 3.1 Flash TTS',
    description: 'Premium TTS with 70+ languages, 200+ inline audio tags for emotion/pacing, supports up to 2 speakers',
    voices: [
      { id: 'Zephyr', label: 'Zephyr' },
      { id: 'Puck', label: 'Puck' },
      { id: 'Charon', label: 'Charon' },
      { id: 'Kore', label: 'Kore' },
      { id: 'Fenrir', label: 'Fenrir' },
      { id: 'Leda', label: 'Leda' },
      { id: 'Orus', label: 'Orus' },
      { id: 'Aoede', label: 'Aoede' },
      { id: 'Callirrhoe', label: 'Callirrhoe' },
      { id: 'Autonoe', label: 'Autonoe' },
      { id: 'Enceladus', label: 'Enceladus' },
      { id: 'Iapetus', label: 'Iapetus' },
      { id: 'Umbriel', label: 'Umbriel' },
      { id: 'Algieba', label: 'Algieba' },
      { id: 'Despina', label: 'Despina' },
      { id: 'Erinome', label: 'Erinome' },
      { id: 'Algenib', label: 'Algenib' },
      { id: 'Rasalgethi', label: 'Rasalgethi' },
      { id: 'Laomedeia', label: 'Laomedeia' },
      { id: 'Achernar', label: 'Achernar' },
      { id: 'Alnilam', label: 'Alnilam' },
      { id: 'Schedar', label: 'Schedar' },
      { id: 'Gacrux', label: 'Gacrux' },
      { id: 'Pulcherrima', label: 'Pulcherrima' },
      { id: 'Achird', label: 'Achird' },
      { id: 'Zubenelgenubi', label: 'Zubenelgenubi' },
      { id: 'Vindemiatrix', label: 'Vindemiatrix' },
      { id: 'Sadachbia', label: 'Sadachbia' },
      { id: 'Sadaltager', label: 'Sadaltager' },
      { id: 'Sulafat', label: 'Sulafat' },
    ],
  },
  {
    id: 'fish-audio/s2.1-pro-free:free',
    label: 'Fish Audio S2.1 Pro (Free)',
    description: 'Free TTS for testing and prototyping',
    voices: [
      { id: 'b347db033a6549378b48d00acb0d06cd', label: 'Default voice' },
    ],
  },
];

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

  readonly ttsModel = signal<string>(
    localStorage.getItem(TTS_MODEL_KEY) ?? 'microsoft/mai-voice-2-flash'
  );

  readonly ttsVoice = signal<string>(
    localStorage.getItem(TTS_VOICE_KEY) ?? 'de-DE-Klaus:MAI-Voice-2'
  );

  readonly lookupModifierKey = signal<LookupModifier>(
    (localStorage.getItem(LOOKUP_MODIFIER_KEY) as LookupModifier) ?? 'alt'
  );

  setTranslationLanguage(language: TranslationLanguage): void {
    this.translationLanguage.set(language);
    this.safeWrite(LANGUAGE_STORAGE_KEY, language);
  }

  setShowArticleInPractice(show: boolean): void {
    this.showArticleInPractice.set(show);
    this.safeWrite(SHOW_ARTICLE_KEY, String(show));
  }

  setTtsEngine(engine: TtsEngine): void {
    this.ttsEngine.set(engine);
    this.safeWrite(TTS_ENGINE_KEY, engine);
  }

  setTtsModel(model: string): void {
    this.ttsModel.set(model);
    this.safeWrite(TTS_MODEL_KEY, model);
    // Reset voice to the new model's default when switching models
    const found = TTS_MODELS.find((m) => m.id === model);
    if (found && found.voices.length > 0) {
      this.setTtsVoice(found.voices[0].id);
    }
  }

  setTtsVoice(voice: string): void {
    this.ttsVoice.set(voice);
    this.safeWrite(TTS_VOICE_KEY, voice);
  }

  setLookupModifierKey(modifier: LookupModifier): void {
    this.lookupModifierKey.set(modifier);
    this.safeWrite(LOOKUP_MODIFIER_KEY, modifier);
  }

  getTranslation(word: Word): string {
    return this.translationLanguage() === 'ru'
      ? word.translationRu
      : word.translationEn;
  }

  private safeWrite(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.warn(`Failed to persist setting "${key}" to localStorage.`, err);
    }
  }
}
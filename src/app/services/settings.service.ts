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
    description: 'Fast German TTS with multiple native German voices',
    voices: [
      { id: 'de-DE-Klaus:MAI-Voice-2', label: 'Klaus — male' },
      { id: 'de-DE-Gerd:MAI-Voice-2', label: 'Gerd — male' },
      { id: 'de-DE-Stefan:MAI-Voice-2', label: 'Stefan — male' },
      { id: 'de-DE-Katja:MAI-Voice-2', label: 'Katja — female' },
      { id: 'de-DE-Elke:MAI-Voice-2', label: 'Elke — female' },
      { id: 'de-DE-Ursula:MAI-Voice-2', label: 'Ursula — female' },
    ],
  },
  {
    id: 'openai/gpt-audio-mini',
    label: 'OpenAI GPT-Audio Mini',
    description: 'Natural-sounding voices, cost-efficient',
    voices: [
      { id: 'alloy', label: 'Alloy — versatile' },
      { id: 'ash', label: 'Ash — neutral' },
      { id: 'ballad', label: 'Ballad — expressive' },
      { id: 'coral', label: 'Coral — warm' },
      { id: 'echo', label: 'Echo — soft' },
      { id: 'fable', label: 'Fable — British' },
      { id: 'nova', label: 'Nova — warm & natural' },
      { id: 'onyx', label: 'Onyx — deep' },
      { id: 'sage', label: 'Sage — calm' },
      { id: 'shimmer', label: 'Shimmer — bright' },
      { id: 'verse', label: 'Verse — melodic' },
    ],
  },
  {
    id: 'openai/gpt-audio',
    label: 'OpenAI GPT-Audio',
    description: 'Highest quality, most natural speech',
    voices: [
      { id: 'alloy', label: 'Alloy — versatile' },
      { id: 'ash', label: 'Ash — neutral' },
      { id: 'ballad', label: 'Ballad — expressive' },
      { id: 'coral', label: 'Coral — warm' },
      { id: 'echo', label: 'Echo — soft' },
      { id: 'fable', label: 'Fable — British' },
      { id: 'nova', label: 'Nova — warm & natural' },
      { id: 'onyx', label: 'Onyx — deep' },
      { id: 'sage', label: 'Sage — calm' },
      { id: 'shimmer', label: 'Shimmer — bright' },
      { id: 'verse', label: 'Verse — melodic' },
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
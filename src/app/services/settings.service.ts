import { Injectable, signal } from '@angular/core';
import { TranslationLanguage, Word } from '../models/word';

const LANGUAGE_STORAGE_KEY = 'german-dictionary-translation-language';
const SHOW_ARTICLE_KEY = 'german-dictionary-show-article-practice';
const TTS_ENGINE_KEY = 'german-dictionary-tts-engine';
const TTS_MODEL_KEY = 'german-dictionary-tts-model';
const TTS_VOICE_KEY = 'german-dictionary-tts-voice';
const LOOKUP_MODIFIER_KEY = 'german-dictionary-lookup-modifier';
const IMAGE_STYLE_KEY = 'german-dictionary-image-style';
const IMAGE_MODEL_KEY = 'german-dictionary-image-model';
const TEXT_MODEL_KEY = 'german-dictionary-text-model';
const TEXT_MODEL_PROVIDER_KEY = 'german-dictionary-text-model-provider';
const SHOW_SENTENCES_KEY = 'german-dictionary-show-sentences-srs';
const THROUGHPUT_ROUTING_KEY = 'german-dictionary-throughput-routing';
const TRANSLATION_API_URL_KEY = 'german-dictionary-translation-api-url';
const STORY_ONLY_MC_KEY = 'german-dictionary-story-only-mc-exercises';
const CLOZE_DENSITY_KEY = 'german-dictionary-cloze-density';

export type TtsEngine = 'browser' | 'openai';
export type LookupModifier = 'alt' | 'ctrl' | 'meta' | 'shift';

export const PRESET_IMAGE_MODELS = [
  { id: 'google/gemini-3.1-flash-lite-image', label: 'Google Gemini 3.1 Flash Lite Image', description: 'Cheapest (~$0.00003/image), fast, good quality' },
  { id: 'black-forest-labs/flux.2-klein-4b', label: 'Black Forest Labs FLUX.2 Klein 4B', description: '~$0.014/image, good for flashcard illustrations' },
  { id: 'openai/gpt-image-1-mini', label: 'OpenAI GPT Image 1 Mini', description: '~$0.004/image, high quality, supports streaming' },
];

export const PRESET_TEXT_MODELS = [
  { id: 'google/gemma-4-31b-it:free', label: 'Google Gemma 4 31B (Free)', description: 'Free model, good for text generation' },
  { id: 'nvidia/llama-3.3-nemotron-super-49b-v1:free', label: 'NVIDIA Nemotron 49B (Free)', description: 'Free NVIDIA model, strong reasoning' },
  { id: 'deepseek/deepseek-chat-v3-0324:free', label: 'DeepSeek V3 (Free)', description: 'Free DeepSeek model, good for German' },
  { id: 'qwen/qwen-2.5-72b-instruct:free', label: 'Qwen 2.5 72B (Free)', description: 'Free Alibaba model, strong multilingual support' },
  { id: 'microsoft/phi-4-mini-instruct:free', label: 'Microsoft Phi-4 Mini (Free)', description: 'Free Microsoft model, efficient' },
  { id: 'google/gemini-3.1-flash-lite:free', label: 'Google Gemini 3.1 Flash Lite (Free)', description: 'Gemini 3.1 Flash Lite, free tier available' },
];

export const PRESET_IMAGE_STYLES = [
  { id: 'none', label: 'No style (default minimal)', prompt: 'Minimalist cartoon style, white or light background, no text, suitable for a flashcard.' },
  { id: 'simpsons', label: 'Simpsons-like', prompt: 'In the style of The Simpsons cartoon, bright yellow skin tones, bold outlines, simple backgrounds, no text.' },
  { id: 'watercolor', label: 'Watercolor painting', prompt: 'Watercolor painting style, soft colors, artistic brush strokes, no text.' },
  { id: 'pixel-art', label: 'Pixel art (8-bit)', prompt: 'Pixel art style, 8-bit video game look, blocky pixels, retro gaming aesthetic, no text.' },
  { id: 'ukiyo-e', label: 'Japanese woodblock (Ukiyo-e)', prompt: 'In the style of Japanese Ukiyo-e woodblock prints, flat colors, bold outlines, Hokusai-inspired, no text.' },
  { id: 'line-art', label: 'Line art / coloring book', prompt: 'Simple black and white line art, coloring book style, clean outlines, no shading, no text.' },
  { id: 'vintage', label: 'Vintage engraving', prompt: '19th century vintage engraving style, crosshatch shading, sepia tones, antique print look, no text.' },
  { id: 'studio-ghibli', label: 'Studio Ghibli-inspired', prompt: 'In the style of Studio Ghibli anime, soft pastel colors, dreamy backgrounds, whimsical and warm atmosphere, no text.' },
  { id: 'minimalist-flat', label: 'Flat vector minimal', prompt: 'Flat vector illustration style, solid colors, geometric shapes, modern minimalist design, no text.' },
  { id: 'sketch', label: 'Pencil sketch', prompt: 'Hand-drawn pencil sketch style, rough lines, shading with graphite, study drawing, no text.' },
  { id: 'custom', label: 'Custom style (type below)', prompt: '' },
];

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
      { id: '88b18e0d81474a0ca08e2ea6f9df5ff4', label: 'Default voice' },
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

  /** The selected image style preset ID. 'none' = default minimal style. 'custom' = custom text. */
  readonly imageStyle = signal<string>(
    localStorage.getItem(IMAGE_STYLE_KEY) ?? 'none'
  );

  /** Average number of missing words per sentence for story cloze exercises (0.25-2). */
  readonly clozeDensity = signal<number>(this.loadClozeDensity());

  /** Custom style prompt text (only used when imageStyle === 'custom') */
  readonly imageStyleCustom = signal<string>(
    localStorage.getItem(IMAGE_STYLE_KEY + '-custom') ?? ''
  );

  /** The selected image generation model */
  readonly imageModel = signal<string>(
    localStorage.getItem(IMAGE_MODEL_KEY) ?? 'google/gemini-3.1-flash-lite-image'
  );

  /** The selected text generation model (for AI chat, word analysis, etc.) */
  readonly textModel = signal<string>(
    localStorage.getItem(TEXT_MODEL_KEY) ?? 'google/gemma-4-31b-it:free'
  );

  /** The selected provider for the text model (optional, for custom routing) */
  readonly textModelProvider = signal<string | null>(
    localStorage.getItem(TEXT_MODEL_PROVIDER_KEY) ?? null
  );

  /** The LibreTranslate API endpoint URL */
  readonly translationApiUrl = signal<string>(
    localStorage.getItem(TRANSLATION_API_URL_KEY) ?? 'http://localhost:5000/translate'
  );

  setTranslationApiUrl(url: string): void {
    this.translationApiUrl.set(url);
    this.safeWrite(TRANSLATION_API_URL_KEY, url);
  }

  setImageModel(model: string): void {
    this.imageModel.set(model);
    this.safeWrite(IMAGE_MODEL_KEY, model);
  }

  /** Sets the average number of missing words per sentence used when generating story cloze exercises. */
  setClozeDensity(density: number): void {
    const clamped = Math.min(2, Math.max(0.25, density));
    this.clozeDensity.set(clamped);
    this.safeWrite(CLOZE_DENSITY_KEY, String(clamped));
  }

  setTextModel(model: string): void {
    this.textModel.set(model);
    this.safeWrite(TEXT_MODEL_KEY, model);
  }

  setTextModelProvider(provider: string | null): void {
    this.textModelProvider.set(provider);
    if (provider) {
      this.safeWrite(TEXT_MODEL_PROVIDER_KEY, provider);
    } else {
      localStorage.removeItem(TEXT_MODEL_PROVIDER_KEY);
    }
  }

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

  /** Whether to show example sentences on SRS card front */
  readonly showSentencesInSrs = signal<boolean>(
    localStorage.getItem(SHOW_SENTENCES_KEY) !== 'false'
  );

  /** Route OpenRouter text requests by throughput instead of the default price-based load balancing */
  readonly throughputRouting = signal<boolean>(
    localStorage.getItem(THROUGHPUT_ROUTING_KEY) === 'true'
  );

  setShowSentencesInSrs(show: boolean): void {
    this.showSentencesInSrs.set(show);
    this.safeWrite(SHOW_SENTENCES_KEY, String(show));
  }

  setThroughputRouting(enabled: boolean): void {
    this.throughputRouting.set(enabled);
    this.safeWrite(THROUGHPUT_ROUTING_KEY, String(enabled));
  }

  /** Whether story exercises should be limited to multiple-choice (card) exercises only.
   *  When enabled, the AI still generates 3 exercises per word but all are \"mc\",
   *  mixing German→native and native→German directions. */
  readonly storyOnlyMcExercises = signal<boolean>(
    localStorage.getItem(STORY_ONLY_MC_KEY) === 'true'
  );

  setStoryOnlyMcExercises(enabled: boolean): void {
    this.storyOnlyMcExercises.set(enabled);
    this.safeWrite(STORY_ONLY_MC_KEY, String(enabled));
  }

  setImageStyle(style: string): void {
    this.imageStyle.set(style);
    this.safeWrite(IMAGE_STYLE_KEY, style);
  }

  setImageStyleCustom(text: string): void {
    this.imageStyleCustom.set(text);
    this.safeWrite(IMAGE_STYLE_KEY + '-custom', text);
  }

  /** Returns the full style prompt to inject into image generation */
  getImageStylePrompt(): string {
    const id = this.imageStyle();
    if (id === 'none') return '';
    const preset = PRESET_IMAGE_STYLES.find((s) => s.id === id);
    if (id === 'custom') {
      const custom = this.imageStyleCustom().trim();
      return custom ? `${custom}. No text in the image.` : '';
    }
    return preset?.prompt ?? '';
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

  /** Reads the persisted cloze density, or defaults to 1 (word per sentence). */
  private loadClozeDensity(): number {
    const raw = Number(localStorage.getItem(CLOZE_DENSITY_KEY));
    if (!raw || isNaN(raw)) return 1;
    return Math.min(2, Math.max(0.25, raw));
  }
}
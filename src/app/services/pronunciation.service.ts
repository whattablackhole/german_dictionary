/**
 * Естественный немецкий голос для карточек и глобального поиска слов.
 *
 * Зачем отдельный сервис: встроенный `speechSynthesis` звучит «роботом»,
 * а нормальный API-голос в приложении уже есть (`AiService.generateSpeech`)
 * вместе с кэшем в IndexedDB (`TtsCacheService`). Здесь они сведены в одно
 * место, чтобы карточки и плавающий поиск слов звучали одинаково.
 *
 * Что важно для задержки: `prefetch()` заранее (пока игрок отвечает на
 * предыдущую карточку) качает аудио следующего слова, поэтому к моменту
 * показа ответа звук уже лежит в кэше и включается мгновенно. Если API
 * недоступен (нет ключа, сеть, лимит) — молча откатываемся на голос
 * браузера, чтобы карточки никогда не оставались без озвучки.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { AiService } from './ai.service';
import { SettingsService } from './settings.service';
import { SpeechService } from './speech.service';
import { TtsCacheService } from './tts-cache.service';

const VOICE_SOURCE_KEY = 'german-dictionary-voice-source';

/** Сколько готовых треков держим в оперативной памяти (слова короткие). */
const MAX_MEMORY_ENTRIES = 24;

/** Страховка: если синтезатор браузера не сообщил об окончании — освобождаем флаг. */
const BROWSER_GUARD_MS = 5000;

/** Бесплатная модель OpenRouter: без оплаты, качество — «человекоподобное». */
export const FREE_TTS_MODEL = 'fish-audio/s2.1-pro-free:free';
export const FREE_TTS_VOICE = '88b18e0d81474a0ca08e2ea6f9df5ff4';

/** Откуда берём голос. */
export type VoiceSource =
  /** Бесплатная модель OpenRouter (zero-cost). */
  | 'api-free'
  /** Модель и голос из раздела «Настройки → Text-to-Speech». */
  | 'api-settings'
  /** Речевой синтез браузера: бесплатно и офлайн, но звучит «роботом». */
  | 'browser';

export interface VoiceSourceOption {
  id: VoiceSource;
  label: string;
}

/** Голос браузера — единственный вариант, работающий без ключа OpenRouter. */
export const BROWSER_VOICE: VoiceSourceOption = {
  id: 'browser',
  label: 'Браузер (офлайн, робот)',
};

export const VOICE_SOURCE_OPTIONS: readonly VoiceSourceOption[] = [
  { id: 'api-free', label: 'API — бесплатно (Fish Audio)' },
  { id: 'api-settings', label: 'API — модель из настроек' },
  BROWSER_VOICE,
];

/** Параметры одного запроса к /audio/speech. */
export interface TtsRequestOptions {
  model: string;
  voice: string;
}

@Injectable({ providedIn: 'root' })
export class PronunciationService {
  private readonly ai = inject(AiService);
  private readonly settings = inject(SettingsService);
  private readonly speech = inject(SpeechService);
  private readonly cache = inject(TtsCacheService);

  readonly voiceSource = signal<VoiceSource>(readVoiceSource());
  readonly options = VOICE_SOURCE_OPTIONS;
  /** Есть ли ключ OpenRouter — без него API-путь невозможен. */
  readonly apiAvailable = computed(() => this.ai.hasApiKey());
  /** Идёт ли озвучка прямо сейчас (для блокировки микрофона). */
  readonly speaking = signal(false);

  private readonly _onStart = new Subject<void>();
  private readonly _onEnd = new Subject<void>();
  /** Озвучка началась — микрофон надо сразу отпустить. */
  readonly onStart = this._onStart.asObservable();
  /** Озвучка закончилась. */
  readonly onEnd = this._onEnd.asObservable();

  private audio: HTMLAudioElement | null = null;
  private speechSub: Subscription | null = null;
  private guardTimer: ReturnType<typeof setTimeout> | null = null;
  /** Растёт на каждый вызов speak/stop — защита от устаревших ответов API. */
  private token = 0;
  private readonly memory = new Map<string, string>();
  private readonly inflight = new Map<string, Promise<string | null>>();

  setVoiceSource(source: VoiceSource): void {
    this.voiceSource.set(source);
    try {
      localStorage.setItem(VOICE_SOURCE_KEY, source);
    } catch {
      // Приватный режим: настройка просто не переживёт перезагрузку.
    }
  }

  /**
   * Произнести текст. `onStart` приходит синхронно — вызывающий код сразу
   * гасит микрофон, ещё не дожидаясь ни сети, ни ответа API.
   */
  speak(text: string): void {
    const clean = (text ?? '').trim();
    if (!clean) return;

    this.halt();
    const token = ++this.token;
    this.speaking.set(true);
    this._onStart.next();

    const source = this.voiceSource();
    if (source === 'browser' || !this.ai.hasApiKey()) {
      this.speakWithBrowser(clean, token);
      return;
    }
    void this.resolve(clean, this.optionsFor(source)).then((dataUrl) => {
      if (token !== this.token) return;
      if (!dataUrl) {
        this.speakWithBrowser(clean, token);
        return;
      }
      this.play(clean, dataUrl, token);
    });
  }

  /** Заранее скачать озвучку, чтобы в момент ответа звук уже был готов. */
  prefetch(text: string): void {
    const clean = (text ?? '').trim();
    if (!clean) return;
    const source = this.voiceSource();
    if (source === 'browser' || !this.ai.hasApiKey()) return;
    void this.resolve(clean, this.optionsFor(source));
  }

  /** Прервать озвучку. Если что-то играло — придёт `onEnd`. */
  stop(): void {
    const wasSpeaking = this.speaking();
    this.token++;
    this.halt();
    if (!wasSpeaking) return;
    this.speaking.set(false);
    this._onEnd.next();
  }

  // ── Внутреннее ───────────────────────────────────────────────────────────────

  private optionsFor(source: VoiceSource): TtsRequestOptions {
    if (source === 'api-free') return { model: FREE_TTS_MODEL, voice: FREE_TTS_VOICE };
    return { model: this.settings.ttsModel(), voice: this.settings.ttsVoice() };
  }

  /** Память → IndexedDB → API. Одинаковые запросы не дублируются. */
  private resolve(text: string, options: TtsRequestOptions): Promise<string | null> {
    const key = `${options.model}|${options.voice}|${text}`;
    const hot = this.memory.get(key);
    if (hot) return Promise.resolve(hot);

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const job = (async () => {
      try {
        const stored = await this.cache.getAudio(text, options);
        if (stored) {
          this.remember(key, stored);
          return stored;
        }
        const fresh = await this.ai.generateSpeech(text, options);
        this.remember(key, fresh);
        void this.cache.setAudio(text, fresh, options);
        return fresh;
      } catch {
        // Нет ключа, сеть или лимит — откатимся на голос браузера.
        return null;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, job);
    return job;
  }

  /** Простейший LRU: Map сохраняет порядок вставки, достаточно перевставить. */
  private remember(key: string, dataUrl: string): void {
    this.memory.delete(key);
    this.memory.set(key, dataUrl);
    while (this.memory.size > MAX_MEMORY_ENTRIES) {
      const oldest = this.memory.keys().next();
      if (oldest.done) break;
      this.memory.delete(oldest.value);
    }
  }

  private play(text: string, dataUrl: string, token: number): void {
    let audio: HTMLAudioElement;
    try {
      audio = new Audio(dataUrl);
    } catch {
      this.speakWithBrowser(text, token);
      return;
    }
    this.audio = audio;
    const fallback = () => {
      if (token === this.token) this.speakWithBrowser(text, token);
    };
    audio.onended = () => {
      if (token === this.token) this.finish();
    };
    audio.onerror = fallback;
    audio.play().catch(fallback);
  }

  private speakWithBrowser(text: string, token: number): void {
    this.speechSub?.unsubscribe();
    this.speechSub = this.speech.onEnd.subscribe(() => {
      if (token === this.token) this.finish();
    });
    this.speech.speak(text);
    if (this.guardTimer) clearTimeout(this.guardTimer);
    this.guardTimer = setTimeout(() => {
      this.guardTimer = null;
      if (token === this.token) this.finish();
    }, BROWSER_GUARD_MS);
  }

  private finish(): void {
    this.clearGuard();
    this.audio = null;
    this.speechSub?.unsubscribe();
    this.speechSub = null;
    if (!this.speaking()) return;
    this.speaking.set(false);
    this._onEnd.next();
  }

  /** Заглушить всё, не трогая флаги (вызывается из speak/stop). */
  private halt(): void {
    this.clearGuard();
    const audio = this.audio;
    this.audio = null;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // Элемент мог не успеть загрузиться — ничего страшного.
      }
    }
    this.speechSub?.unsubscribe();
    this.speechSub = null;
    this.speech.stop();
  }

  private clearGuard(): void {
    if (!this.guardTimer) return;
    clearTimeout(this.guardTimer);
    this.guardTimer = null;
  }
}

function readVoiceSource(): VoiceSource {
  try {
    const stored = localStorage.getItem(VOICE_SOURCE_KEY);
    if (stored === 'api-free' || stored === 'api-settings' || stored === 'browser') return stored;
  } catch {
    // localStorage может быть недоступен — берём значение по умолчанию.
  }
  return 'api-free';
}

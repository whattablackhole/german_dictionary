import { Injectable } from '@angular/core';

export interface RecognitionResult {
  transcript: string;
  confidence: number;
}

export type RecognitionStatus = 'audio-start' | 'speech-start' | 'speech-end';

export interface SpeechDebugEvent {
  time: string;
  timestamp: number;
  category: 'lifecycle' | 'event' | 'error' | 'warn' | 'info';
  message: string;
  data?: Record<string, unknown>;
}

export function isFatalRecognitionError(code?: string): boolean {
  return (
    code === 'not-allowed' ||
    code === 'service-not-allowed' ||
    code === 'audio-capture' ||
    code === 'unsupported' ||
    code === 'start-failed'
  );
}

@Injectable({ providedIn: 'root' })
export class SpeechRecognitionService {
  private recognition: SpeechRecognitionInstance | null = null;
  private interimTranscript = '';
  private _stoppedByUser = false;

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as unknown as Record<string, unknown>;
    return !!(w['SpeechRecognition'] || w['webkitSpeechRecognition']);
  }

  /**
   * Start listening. onFinal fires with the recognized text.
   * onInterim fires with intermediate text as user speaks.
   * onError fires on any recognition error.
   */
  start(
    onFinal: (result: RecognitionResult) => void,
    onInterim?: (text: string) => void,
    onError?: (message: string, code?: string) => void
  ): void {
    this.log('info', 'start() called');
    if (!SpeechRecognitionService.isSupported()) {
      this.log('error', 'Browser does not support SpeechRecognition');
      onError?.('Распознавание речи не поддерживается этим браузером. Используйте Chrome.', 'unsupported');
      return;
    }

    this.halt();

    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w['SpeechRecognition'] || w['webkitSpeechRecognition']) as { new (): SpeechRecognitionInstance };
    const rec = new Ctor();
    rec.lang = 'de-DE';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.log('info', 'Recognition instance created', { lang: rec.lang });

    let finalTranscript = '';

    rec.onaudiostart = () => this.log('event', 'onaudiostart');
    rec.onspeechstart = () => this.log('event', 'onspeechstart');
    rec.onspeechend = () => this.log('event', 'onspeechend');

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (e.results[i].isFinal) {
          finalTranscript += ' ' + alt.transcript;
        } else {
          interim += alt.transcript;
        }
      }
      this.interimTranscript = interim;
      this.log('event', 'onresult', { interim: interim.substring(0, 50) });
      onInterim?.((finalTranscript + ' ' + interim).trim());

      if (finalTranscript) {
        onFinal({ transcript: finalTranscript.trim(), confidence: 1 });
        finalTranscript = '';
        this.interimTranscript = '';
      }
    };

    rec.onerror = (e) => {
      const isNoSpeech = e.error === 'no-speech';
      if (isNoSpeech) {
        this.log('error', 'no-speech: continuing to listen...');
      } else {
        const messages: Record<string, string> = {
          'not-allowed': 'Нет доступа к микрофону. Разрешите его в браузере.',
          'service-not-allowed': 'Сервис распознавания недоступен.',
          'audio-capture': 'Микрофон не найден.',
          network: 'Ошибка сети при распознавании.',
        };
        const msg = messages[e.error] ?? 'Ошибка распознавания: ' + e.error;
        this.log(
          e.error === 'not-allowed' || e.error === 'audio-capture' ? 'warn' : 'error',
          `Error: ${e.error} — ${msg}`
        );
        onError?.(msg, e.error);
      }
    };

    rec.onend = () => {
      this.log('info', 'onend: session ended');
      // Only clear when stop()/abort() was called, not on no-speech
      if (this._stoppedByUser) {
        this.recognition = null;
        this._stoppedByUser = false;
      }
      if (finalTranscript) {
        onFinal({ transcript: finalTranscript.trim(), confidence: 1 });
      }
    };

    this.recognition = rec;
    try {
      rec.start();
      this.log('info', 'rec.start() succeeded');
    } catch (e) {
      this.log('error', `rec.start() failed: ${String(e)}`);
      onError?.('Не удалось запустить микрофон: ' + String(e), 'start-failed');
    }
  }

  /** Stop listening and deliver whatever has been recognized. */
  stop(): void {
    this.log('info', 'stop() called');
    this._stoppedByUser = true;
    const rec = this.recognition;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }

  /** Hard abort: no callbacks fired. */
  abort(): void {
    this.log('info', 'abort() called');
    this._stoppedByUser = true;
    this.halt();
  }

  /** Is the microphone currently listening? */
  isListening(): boolean {
    return this.recognition !== null;
  }

  /** Current intermediate transcript (for UI). */
  getInterim(): string {
    return this.interimTranscript;
  }

  // ── Debug logging ──────────────────────────────────────────────
  private debugLog: SpeechDebugEvent[] = [];
  private static MAX_DEBUG_LOG = 500;

  private log(category: SpeechDebugEvent['category'], message: string, data?: Record<string, unknown>): void {
    const now = Date.now();
    const d = new Date(now);
    const time = d.toLocaleTimeString('de-DE', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(now % 1000).padStart(3, '0');
    const entry: SpeechDebugEvent = { time, timestamp: now, category, message, data };
    this.debugLog.push(entry);
    if (this.debugLog.length > SpeechRecognitionService.MAX_DEBUG_LOG) this.debugLog.shift();
    const consoleFn = category === 'error' ? console.error : category === 'warn' ? console.warn : console.debug;
    consoleFn(`[SpeechRec:${category}] ${time} ${message}`, data ?? '');
  }

  getDebugLog(): SpeechDebugEvent[] {
    return [...this.debugLog].reverse();
  }

  clearDebugLog(): void {
    this.debugLog = [];
  }

  getDebugLogSize(): number {
    return this.debugLog.length;
  }

  private halt(): void {
    this._stoppedByUser = false;
    if (this.recognition) {
      try { this.recognition.abort(); } catch { /* ignore */ }
      this.recognition = null;
    }
    this.interimTranscript = '';
  }
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onaudiostart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

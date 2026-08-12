import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SpeechWordBoundary {
  charIndex: number;
  charLength: number;
}

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private _onBoundary = new Subject<SpeechWordBoundary>();
  private _onEnd = new Subject<void>();
  private _onStart = new Subject<void>();

  readonly onBoundary = this._onBoundary.asObservable();
  readonly onEnd = this._onEnd.asObservable();
  readonly onStart = this._onStart.asObservable();

  constructor() {
    if ('speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.voices = window.speechSynthesis.getVoices();
      };
    }
  }

  speak(text: string): void {
    const cleanText = text.trim();
    if (!cleanText || !('speechSynthesis' in window)) {
      return;
    }

    this.stop();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'de-DE';

    const germanVoice = this.voices.find((v) =>
      v.lang.toLowerCase().startsWith('de')
    );
    if (germanVoice) {
      utterance.voice = germanVoice;
    }

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        this._onBoundary.next({
          charIndex: event.charIndex,
          charLength: event.charLength ?? 0,
        });
      }
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      this._onEnd.next();
    };

    utterance.onstart = () => {
      this._onStart.next();
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.currentUtterance = null;
  }

  isSpeaking(): boolean {
    return 'speechSynthesis' in window && window.speechSynthesis.speaking;
  }
}

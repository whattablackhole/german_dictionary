import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpeechService {
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if ('speechSynthesis' in window) {
      // Load available voices (async in some browsers)
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

    // Stop any currently playing speech before starting new playback
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'de-DE';

    // Prefer a German voice if available
    const germanVoice = this.voices.find((v) =>
      v.lang.toLowerCase().startsWith('de')
    );
    if (germanVoice) {
      utterance.voice = germanVoice;
    }

    window.speechSynthesis.speak(utterance);
  }
}
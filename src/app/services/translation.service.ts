import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly localRunning = signal<boolean | null>(null);

  constructor(private readonly settingsService: SettingsService) {}

  isLocalRunning(): boolean | null {
    return this.localRunning();
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(environment.libreTranslateUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
      this.localRunning.set(res.ok);
      return res.ok;
    } catch {
      this.localRunning.set(false);
      return false;
    }
  }

  async translateSentence(text: string): Promise<string> {
    const target = this.settingsService.translationLanguage() === 'ru' ? 'ru' : 'en';

    const params = new URLSearchParams({
      q: text,
      source: 'de',
      target,
      format: 'text',
    });

    const response = await fetch(environment.libreTranslateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`LibreTranslate error: ${response.status}`);
    }

    const data: { translatedText: string } = await response.json();
    return data.translatedText;
  }
}
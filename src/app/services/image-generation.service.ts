import { Injectable } from '@angular/core';
import { AiService } from './ai.service';
import { ImageCacheService } from './image-cache.service';
import { SettingsService } from './settings.service';
import { Word } from '../models/word';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImageGenerationService {
  constructor(
    private readonly aiService: AiService,
    private readonly imageCache: ImageCacheService,
    private readonly settingsService: SettingsService
  ) {}

  /** Builds an image prompt from a word, incorporating the user's style preference */
  private buildPrompt(word: Word): string {
    const gender = word.gender ? `${word.gender} ` : '';
    const type = word.partOfSpeech;
    const translation = word.translationEn || word.translationRu || '';
    const stylePrompt = this.settingsService.getImageStylePrompt();
    const styleSuffix = stylePrompt
      ? ` ${stylePrompt}`
      : ' Minimalist cartoon style, white or light background, no text, suitable for a flashcard.';

    if (type === 'noun') {
      const plural = word.pluralForm ? ` (plural: ${word.pluralForm})` : '';
      return `A simple, clear educational illustration of a ${gender}${word.german}${plural} — ${translation}.${styleSuffix}`;
    }

    if (type === 'verb') {
      return `A simple, clear educational illustration showing the action "${word.german}" — ${translation}.${styleSuffix}`;
    }

    return `A simple, clear educational illustration representing "${word.german}" — ${translation}.${styleSuffix}`;
  }

  /**
   * Generates an image for the given word using OpenRouter's dedicated Image API.
   * Returns the base64 data URL of the generated image.
   * The image is automatically cached in IndexedDB.
   */
  async generateImage(word: Word): Promise<string> {
    const existing = await this.imageCache.getImage(word.id);
    if (existing) return existing;

    const apiKey = this.aiService.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const prompt = this.buildPrompt(word);

    // Use the dedicated Image API endpoint with the user's selected model
    const response = await fetch(environment.openRouterImageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.imageModel(),
        prompt,
        n: 1,
        response_format: {
          type: 'image',
          aspect_ratio: '1:1',
          image_size: '512x512',
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API key rejected. Check your OpenRouter key at openrouter.ai/keys.');
      }
      if (response.status === 402) {
        throw new Error('OpenRouter account has insufficient credits. Add credits at openrouter.ai.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit reached. Try again in a moment.');
      }
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Image generation failed (HTTP ${response.status}): ${errorBody}`);
    }

    const data = await response.json();

    // Parse the response: OpenRouter Image API returns data[0].b64_json + media_type
    const imageData = data.data?.[0];
    if (!imageData?.b64_json) {
      throw new Error('AI returned no image data in the response.');
    }

    const mediaType = imageData.media_type || 'image/png';
    const base64DataUrl = `data:${mediaType};base64,${imageData.b64_json}`;

    // Cache in IndexedDB
    await this.imageCache.storeImage(word.id, base64DataUrl);

    return base64DataUrl;
  }
}
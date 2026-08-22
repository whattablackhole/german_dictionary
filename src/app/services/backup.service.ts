import { Injectable } from '@angular/core';
import { ImageCacheService, ImageEntry } from './image-cache.service';
import { SentenceCacheService, SentenceEntry } from './sentence-cache.service';
import { StoryService } from './story.service';
import { CaptionsService } from './captions.service';
import { Story } from '../models/story';
import { CorrectedCaption } from '../models/captions';

export interface BackupData {
  app: 'GermanDictionary';
  version: 1 | 2 | 3;
  exportedAt: string;
  data: Record<string, string>;
  /** Optional: images stored in IndexedDB */
  images?: ImageEntry[];
  /** Optional: example sentences stored in IndexedDB */
  sentences?: SentenceEntry[];
  /** Optional: stories stored in IndexedDB */
  stories?: Story[];
  /** Optional: captions stored in IndexedDB */
  captions?: CorrectedCaption[];
}

const BACKUP_KEYS: string[] = [
  'german-dictionary-words',
  'german-dictionary-sentences',
  'german-dictionary-word-exercises',
  'german-dictionary-stories',
  'german-dictionary-grammar-notes',
  'german-dictionary-custom-domains',
  'german-dictionary-translation-language',
  'german-dictionary-show-article-practice',
  'german-dictionary-tts-engine',
  'german-dictionary-tts-model',
  'german-dictionary-tts-voice',
  'german-dictionary-lookup-modifier',
  'german-dictionary-openrouter-key',
  // Additional localStorage keys that were previously missing from backups
  'german-dictionary-pattern-history',
  'german-dictionary-diary',
  'german-dictionary-declension-mastery',
  'german-dictionary-preposition-mastery',
  'german-dictionary-image-style',
  'german-dictionary-image-style-custom',
  'german-dictionary-image-model',
  'german-dictionary-text-model',
  'german-dictionary-show-sentences-srs',
  'german-dictionary-translation-api-url',
  'german-dictionary-throughput-routing',
];

const SENTENCE_NOTES_PREFIX = 'sentence-note-';

@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(
    private readonly imageCache: ImageCacheService,
    private readonly sentenceCache: SentenceCacheService,
    private readonly storyService: StoryService,
    private readonly captionsService: CaptionsService
  ) {}

  /**
   * Collects all known localStorage keys + IndexedDB data and triggers a JSON file download.
   */
  async exportBackup(): Promise<void> {
    const data: Record<string, string> = {};
    for (const key of BACKUP_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }

    // Include sentence notes from localStorage (dynamic keys)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(SENTENCE_NOTES_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          data[key] = value;
        }
      }
    }

    // Include images from IndexedDB
    const images = await this.imageCache.getAllEntries();
    // Include sentences from IndexedDB
    const sentences = await this.sentenceCache.getAllEntries();
    // Include stories from IndexedDB
    const stories = await this.storyService.getAllEntries();
    // Include captions from IndexedDB
    const captions = await this.captionsService.getAllEntries();

    const backup: BackupData = {
      app: 'GermanDictionary',
      version: 3,
      exportedAt: new Date().toISOString(),
      data,
      images: images.length > 0 ? images : undefined,
      sentences: sentences.length > 0 ? sentences : undefined,
      stories: stories.length > 0 ? stories : undefined,
      captions: captions.length > 0 ? captions : undefined,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `german-dictionary-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Validates and restores a backup file into localStorage + IndexedDB.
   */
  importBackup(
    file: File
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!file) {
      return Promise.resolve({ ok: false, error: 'No file selected.' });
    }

    if (file.size > 50 * 1024 * 1024) {
      return Promise.resolve({
        ok: false,
        error: 'File is too large (max 50 MB).',
      });
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(reader.result as string) as BackupData;
          if (parsed.app !== 'GermanDictionary') {
            resolve({
              ok: false,
              error: 'Not a German Dictionary backup file.',
            });
            return;
          }
          if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) {
            resolve({
              ok: false,
              error: `Unsupported backup version: ${parsed.version}`,
            });
            return;
          }
          if (!parsed.data || typeof parsed.data !== 'object') {
            resolve({ ok: false, error: 'Backup file is missing data.' });
            return;
          }

          const STORIES_KEY = 'german-dictionary-stories';

          for (const [key, value] of Object.entries(parsed.data)) {
            let finalValue = value;
            if (key === STORIES_KEY) {
              try {
                const stories = JSON.parse(value) as Array<Record<string, unknown>>;
                if (Array.isArray(stories)) {
                  finalValue = JSON.stringify(
                    stories.map(({ audioUrl, ...rest }) => rest)
                  );
                }
              } catch {
                // keep as-is
              }
            }

            try {
              localStorage.setItem(key, finalValue);
            } catch (err) {
              resolve({
                ok: false,
                error:
                  'Quota exceeded while restoring. Some data may not have been restored. Free up space in your browser and try again.',
              });
              return;
            }
          }

          // Restore images to IndexedDB
          if (parsed.images && Array.isArray(parsed.images)) {
            try {
              await this.imageCache.restoreAll(parsed.images);
            } catch (err) {
              // Non-critical — images can be regenerated
              console.warn('Failed to restore images:', err);
            }
          }

          // Restore sentences to IndexedDB
          if (parsed.sentences && Array.isArray(parsed.sentences)) {
            try {
              await this.sentenceCache.restoreAll(parsed.sentences);
            } catch (err) {
              // Non-critical — sentences can be regenerated
              console.warn('Failed to restore sentences:', err);
            }
          }

          // Restore stories to IndexedDB
          if (parsed.stories && Array.isArray(parsed.stories)) {
            try {
              await this.storyService.restoreAll(parsed.stories);
            } catch (err) {
              console.warn('Failed to restore stories:', err);
            }
          }

          // Restore captions to IndexedDB
          if (parsed.captions && Array.isArray(parsed.captions)) {
            try {
              await this.captionsService.restoreAll(parsed.captions);
            } catch (err) {
              console.warn('Failed to restore captions:', err);
            }
          }

          resolve({ ok: true });
        } catch {
          resolve({ ok: false, error: 'Invalid JSON file.' });
        }
      };
      reader.onerror = () => {
        resolve({ ok: false, error: 'Failed to read the file.' });
      };
      reader.readAsText(file);
    });
  }
}
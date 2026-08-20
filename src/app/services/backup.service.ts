import { Injectable } from '@angular/core';
import { ImageCacheService, ImageEntry } from './image-cache.service';
import { SentenceCacheService, SentenceEntry } from './sentence-cache.service';

export interface BackupData {
  app: 'GermanDictionary';
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
  /** Optional: images stored in IndexedDB */
  images?: ImageEntry[];
  /** Optional: example sentences stored in IndexedDB */
  sentences?: SentenceEntry[];
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
];

@Injectable({ providedIn: 'root' })
export class BackupService {
  constructor(
    private readonly imageCache: ImageCacheService,
    private readonly sentenceCache: SentenceCacheService
  ) {}

  /**
   * Collects all known localStorage keys + IndexedDB images and triggers a JSON file download.
   */
  async exportBackup(): Promise<void> {
    const data: Record<string, string> = {};
    for (const key of BACKUP_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }

    // Include images from IndexedDB
    const images = await this.imageCache.getAllEntries();
    // Include sentences from IndexedDB
    const sentences = await this.sentenceCache.getAllEntries();

    const backup: BackupData = {
      app: 'GermanDictionary',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
      images: images.length > 0 ? images : undefined,
      sentences: sentences.length > 0 ? sentences : undefined,
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
   * Validates and restores a backup file into localStorage + IndexedDB images.
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
          if (parsed.version !== 1) {
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
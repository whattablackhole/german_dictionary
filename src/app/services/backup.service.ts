import { Injectable } from '@angular/core';

export interface BackupData {
  app: 'GermanDictionary';
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
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
  /**
   * Collects all known localStorage keys and triggers a JSON file download.
   */
  exportBackup(): void {
    const data: Record<string, string> = {};
    for (const key of BACKUP_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) {
        data[key] = value;
      }
    }

    const backup: BackupData = {
      app: 'GermanDictionary',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
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
   * Validates and restores a backup file into localStorage.
   * Returns a promise resolving to true on success, or an error message on failure.
   */
  importBackup(
    file: File
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!file) {
      return Promise.resolve({ ok: false, error: 'No file selected.' });
    }

    if (file.size > 10 * 1024 * 1024) {
      return Promise.resolve({
        ok: false,
        error: 'File is too large (max 10 MB).',
      });
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
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
            // TTS audio is stored in IndexedDB now, not localStorage. Strip any
            // embedded base64 audioUrl blobs from restored stories so an old
            // backup can't re-bloat storage past the quota.
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
                // If the stored value isn't valid JSON, keep it as-is; the
                // app's story service will fall back to seed data anyway.
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
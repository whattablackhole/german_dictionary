import { Injectable } from '@angular/core';

const DB_NAME = 'german-dictionary-cache';
const DB_VERSION = 1;
const STORE_NAME = 'tts-audio';

interface TtsAudioEntry {
  key: string;
  dataUrl: string;
  createdAt: number;
}

/**
 * Persists TTS audio data URLs in IndexedDB instead of localStorage.
 *
 * Audio blobs (base64 MP3 data URLs) can be several MB each, which easily
 * blows the ~5 MB localStorage quota. IndexedDB has a much larger quota,
 * making it the right place to cache generated speech.
 *
 * Keys are derived from the story text itself (FNV-1a hash + length), so
 * identical story text reuses the same cached audio regardless of story id.
 */
@Injectable({ providedIn: 'root' })
export class TtsCacheService {
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  /**
   * Returns the cached audio data URL for the given text, model and voice, or null.
   * Resolves to null when IndexedDB is unavailable or no entry exists.
   */
  async getAudio(
    text: string,
    options: { model: string; voice: string; voiceSecond?: string }
  ): Promise<string | null> {
    const db = await this.openDb();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(this.hashKey(text, options));

      request.onsuccess = () => {
        const entry = request.result as TtsAudioEntry | undefined;
        resolve(entry?.dataUrl ?? null);
      };
      request.onerror = () => resolve(null);
    });
  }

  /**
   * Caches the audio data URL for the given text, model and voice.
   */
  async setAudio(
    text: string,
    dataUrl: string,
    options: { model: string; voice: string; voiceSecond?: string }
  ): Promise<void> {
    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: TtsAudioEntry = {
        key: this.hashKey(text, options),
        dataUrl,
        createdAt: Date.now(),
      };
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  /**
   * Removes a single cached entry. Used when a story is deleted so we don't
   * leave orphaned audio blobs behind forever.
   */
  async deleteAudio(
    text: string,
    options: { model: string; voice: string; voiceSecond?: string }
  ): Promise<void> {
    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(this.hashKey(text, options));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  /**
   * Removes all cached audio. Useful if the user clears data or storage gets tight.
   */
  async clearAll(): Promise<void> {
    const db = await this.openDb();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  }

  private openDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      this.dbPromise = Promise.resolve(null);
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        console.warn('IndexedDB unavailable; TTS audio will not be cached.', request.error);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked; TTS audio will not be cached.');
        resolve(null);
      };
    });

    return this.dbPromise;
  }

  /**
   * Computes a stable, collision-resistant hash key for the combination of
   * text + model + voice. Uses FNV-1a, which is deterministic and fast.
   */
  private hashKey(
    text: string,
    options: { model: string; voice: string; voiceSecond?: string }
  ): string {
    // Include model + voice(s) so switching them never replays stale audio
    // (voiceSecond only differs for multi-speaker dialogue requests).
    //
    // Multi-speaker keys carry an explicit version marker (`ms3:`):
    // the `ms2:` dialect sent top-level `reference_id`, which OpenRouter
    // strips (their SpeechRequest schema has no such field), so Fish received
    // no voices and used the same default for every speaker. Bumping the
    // marker invalidates that cached (wrong) audio so it regenerates.
    const voiceSecondKey = options.voiceSecond
      ? `ms3:${options.voiceSecond}`
      : '';
    const input = `${options.model}|${options.voice}|${voiceSecondKey}|${text}`;
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return 'fnv_' + (hash >>> 0).toString(16) + '_' + input.length;
  }
}
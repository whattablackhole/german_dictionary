import { Injectable } from '@angular/core';

const DB_NAME = 'german-dictionary-images';
const STORE_NAME = 'word-images';
const DB_VERSION = 1;

export interface ImageEntry {
  wordId: string;
  data: string; // base64 data URL
}

@Injectable({ providedIn: 'root' })
export class ImageCacheService {
  private db: IDBDatabase | null = null;

  private async openDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'wordId' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /** Returns the base64 data URL for a word's image, or null if not cached */
  async getImage(wordId: string): Promise<string | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(wordId);

      request.onsuccess = () => {
        resolve(request.result?.data ?? null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /** Returns whether a word has a cached image */
  async hasImage(wordId: string): Promise<boolean> {
    const image = await this.getImage(wordId);
    return image !== null;
  }

  /** Stores a base64 image for a word */
  async storeImage(wordId: string, base64Data: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ wordId, data: base64Data });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /** Deletes an image for a word */
  async deleteImage(wordId: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(wordId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /** Returns all image entries (for backup) */
  async getAllEntries(): Promise<ImageEntry[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as ImageEntry[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /** Restores all images from a backup (clears existing first) */
  async restoreAll(entries: ImageEntry[]): Promise<void> {
    const db = await this.openDb();

    // Clear existing
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    if (entries.length === 0) return;

    // Store all entries
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const entry of entries) {
        store.put(entry);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Returns the count of cached images */
  async getImageCount(): Promise<number> {
    const entries = await this.getAllEntries();
    return entries.length;
  }
}
import { Injectable } from '@angular/core';
import { ExampleSentence } from '../models/word';

const DB_NAME = 'german-dictionary-sentences';
const STORE_NAME = 'word-sentences';
const DB_VERSION = 1;

export interface SentenceEntry {
  wordId: string;
  sentences: ExampleSentence[];
}

@Injectable({ providedIn: 'root' })
export class SentenceCacheService {
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

  /** Returns the example sentences for a word, or null if not cached */
  async getSentences(wordId: string): Promise<ExampleSentence[] | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(wordId);

      request.onsuccess = () => {
        resolve(request.result?.sentences ?? null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /** Returns whether a word has cached sentences */
  async hasSentences(wordId: string): Promise<boolean> {
    const sentences = await this.getSentences(wordId);
    return sentences !== null;
  }

  /** Stores example sentences for a word */
  async storeSentences(wordId: string, sentences: ExampleSentence[]): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put({ wordId, sentences });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /** Deletes sentences for a word */
  async deleteSentences(wordId: string): Promise<void> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(wordId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /** Returns all sentence entries (for backup) */
  async getAllEntries(): Promise<SentenceEntry[]> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as SentenceEntry[]);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /** Restores all sentences from a backup (clears existing first) */
  async restoreAll(entries: SentenceEntry[]): Promise<void> {
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

  /** Returns the count of cached sentence entries */
  async getSentenceCount(): Promise<number> {
    const entries = await this.getAllEntries();
    return entries.length;
  }
}
import { Injectable, signal } from '@angular/core';
import { Story } from '../models/story';

const STORAGE_KEY = 'german-dictionary-stories';
const DB_NAME = 'german-dictionary-db';
const DB_VERSION = 1;
const STORE_NAME = 'stories';

const SEED_STORIES: Story[] = [
  {
    id: 'seed-1',
    title: 'Ein Tag im Park',
    german: 'Es war ein sonniger Tag. Anna ging in den Park. Sie sah viele bunte Blumen und hörte die Vögel singen. Ein kleiner Hund lief fröhlich neben ihr. Sie setzte sich auf eine Bank und las ein Buch. Es war sehr entspannend.',
    translationEn: 'A day in the park. Anna went to the park. She saw many colorful flowers and heard the birds singing. A small dog ran happily next to her. She sat down on a bench and read a book. It was very relaxing.',
    translationRu: 'День в парке. Анна пошла в парк. Она увидела много ярких цветов и услышала пение птиц. Маленькая собачка весело бежала рядом с ней. Она села на скамейку и читала книгу. Это было очень расслабляюще.',
    level: 'A1',
    domain: 'Nature',
    grammarTopics: ['Simple present tense', 'Basic sentence structure'],
    wordCount: 48,
    createdAt: '2026-08-01T10:00:00.000Z',
  },
  {
    id: 'seed-2',
    title: 'Der verregnete Tag',
    german: 'Gestern hat es den ganzen Tag geregnet. Ich bin zu Hause geblieben und habe einen Film gesehen. Plötzlich hat das Telefon geklingelt. Meine Freundin hat mich zum Kaffee eingeladen. Ich habe mich warm angezogen und bin losgegangen. Wir haben uns in einem gemütlichen Café getroffen und stundenlang gequatscht.',
    translationEn: 'Yesterday it rained all day. I stayed at home and watched a movie. Suddenly the phone rang. My friend invited me for coffee. I dressed warmly and left. We met in a cozy café and chatted for hours.',
    translationRu: 'Вчера весь день шёл дождь. Я остался дома и смотрел фильм. Внезапно зазвонил телефон. Моя подруга пригласила меня на кофе. Я тепло оделся и вышел. Мы встретились в уютном кафе и болтали часами.',
    level: 'A2',
    domain: 'Daily Life',
    grammarTopics: ['Perfekt tense', 'Separable prefix verbs', 'Prepositions with dative'],
    wordCount: 55,
    createdAt: '2026-08-02T10:00:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class StoryService {
  readonly stories = signal<Story[]>([]);

  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private initPromise: Promise<void>;

  constructor() {
    this.initPromise = this.initialize();
  }

  /**
   * Initialize the service: open IndexedDB, migrate any leftover localStorage data,
   * then load all stories into the signal.
   */
  private async initialize(): Promise<void> {
    const db = await this.openDb();
    if (!db) {
      // IndexedDB unavailable — fall back to localStorage
      const local = this.loadFromLocalStorage();
      this.stories.set(local);
      return;
    }

    // Migrate any leftover data from localStorage into IndexedDB
    await this.migrateFromLocalStorage(db);

    // Load all stories from IndexedDB
    const all = await this.loadAllFromDb(db);
    this.stories.set(all.length > 0 ? all : [...SEED_STORIES]);
  }

  getStories(): Story[] {
    return this.stories();
  }

  /** Returns all stories from IndexedDB (for backup) */
  async getAllEntries(): Promise<Story[]> {
    const db = await this.openDb();
    if (!db) return [];
    return this.loadAllFromDb(db);
  }

  /** Restores all stories from a backup (clears existing first) */
  async restoreAll(entries: Story[]): Promise<void> {
    const db = await this.openDb();
    if (!db) {
      // Fallback: save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      } catch (err) {
        console.warn('Failed to restore stories to localStorage.', err);
      }
      return;
    }

    await this.saveAllToDb(db, entries);
    this.stories.set(entries.length > 0 ? entries : [...SEED_STORIES]);
  }

  getStoryById(id: string): Story | undefined {
    return this.stories().find((s) => s.id === id);
  }

  async addStory(story: Omit<Story, 'id' | 'createdAt'>): Promise<Story> {
    const newStory: Story = {
      ...story,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.stories.update((stories) => [newStory, ...stories]);
    await this.save();
    return newStory;
  }

  async deleteStory(id: string): Promise<void> {
    this.stories.update((stories) => stories.filter((s) => s.id !== id));
    await this.save();
  }

  // ── IndexedDB helpers ──

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
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
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
        console.warn('IndexedDB unavailable for stories; falling back to localStorage.', request.error);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked; falling back to localStorage.');
        resolve(null);
      };
    });

    return this.dbPromise;
  }

  private async loadAllFromDb(db: IDBDatabase): Promise<Story[]> {
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const result = request.result as Story[];
        resolve(result ?? []);
      };
      request.onerror = () => resolve([]);
    });
  }

  private async saveAllToDb(db: IDBDatabase, stories: Story[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      // Clear existing data first, then add all
      store.clear();

      for (const story of stories) {
        store.add(story);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  // ── localStorage fallback ──

  private loadFromLocalStorage(): Story[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Story[];
        if (Array.isArray(parsed)) {
          // Strip any legacy audioUrl fields
          if (parsed.some((s) => 'audioUrl' in s)) {
            return parsed.map(({ audioUrl, ...rest }) => rest as Story);
          }
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [...SEED_STORIES];
  }

  /**
   * On first load after this change, migrate any data from localStorage into
   * IndexedDB, then remove the localStorage key so future loads don't re-migrate.
   */
  private async migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
    let localData: Story[] | null = null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Story[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strip legacy audioUrl fields
          if (parsed.some((s) => 'audioUrl' in s)) {
            localData = parsed.map(({ audioUrl, ...rest }) => rest as Story);
          } else {
            localData = parsed;
          }
        }
      }
    } catch {
      // ignore
    }

    if (localData && localData.length > 0) {
      try {
        // Check if IndexedDB already has data — if so, merge
        const existing = await this.loadAllFromDb(db);
        if (existing.length === 0) {
          await this.saveAllToDb(db, localData);
        }
        // Remove the old localStorage key to free up quota
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // migration failed — keep localStorage data as fallback
      }
    }
  }

  // ── Persistence ──

  private async save(): Promise<void> {
    const stories = this.stories();
    const db = await this.openDb();
    if (db) {
      try {
        await this.saveAllToDb(db, stories);
        return;
      } catch (err) {
        console.warn('Failed to save stories to IndexedDB; falling back to localStorage.', err);
      }
    }

    // Fallback: save to localStorage (with quota error handling)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stories));
    } catch (err) {
      console.warn('Failed to persist stories to localStorage; keeping in memory only.', err);
    }
  }
}
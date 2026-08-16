import { Injectable, signal } from '@angular/core';
import { Story } from '../models/story';

const STORAGE_KEY = 'german-dictionary-stories';

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
  readonly stories = signal<Story[]>(this.loadStories());

  getStories(): Story[] {
    return this.stories();
  }

  getStoryById(id: string): Story | undefined {
    return this.stories().find((s) => s.id === id);
  }

  addStory(story: Omit<Story, 'id' | 'createdAt'>): Story {
    const newStory: Story = {
      ...story,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.stories.update((stories) => [newStory, ...stories]);
    this.save();
    return newStory;
  }

  deleteStory(id: string): void {
    this.stories.update((stories) => stories.filter((s) => s.id !== id));
    this.save();
  }

  private loadStories(): Story[] {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (e.g. private mode) — fall back to seed data
      return [...SEED_STORIES];
    }

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Story[];
        if (!Array.isArray(parsed)) {
          return [...SEED_STORIES];
        }

        // Strip any legacy audioUrl fields. TTS audio is stored in IndexedDB now,
        // not localStorage — embedded base64 blobs previously blew the quota.
        let sanitized = parsed;
        if (parsed.some((s) => 'audioUrl' in s)) {
          sanitized = parsed.map(({ audioUrl, ...rest }) => rest as Story);
        }

        // Re-persist the sanitized (much smaller) payload only if it shrank
        // materially, so we actually clear out the bloated old value.
        const sanitizedJson = JSON.stringify(sanitized);
        if (sanitizedJson.length <= stored.length - 1024) {
          this.safeSave(sanitizedJson);
        }

        return sanitized;
      } catch {
        // fall through to seed data
      }
    }
    return [...SEED_STORIES];
  }

  private save(): void {
    this.safeSave(JSON.stringify(this.stories()));
  }

  private safeSave(json: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch (err) {
      // Quota exceeded or storage unavailable — keep working in memory only.
      console.warn('Failed to persist stories to localStorage; keeping in memory.', err);
    }
  }
}
import { Injectable, signal } from '@angular/core';
import { Story } from '../models/story';
import { StoryCloze } from '../models/story-cloze';

@Injectable({ providedIn: 'root' })
export class StoryClozeService {
  /** The story the current cloze session was generated from. */
  readonly story = signal<Story | null>(null);
  /** The cloze task for the current session. */
  readonly cloze = signal<StoryCloze | null>(null);

  setSession(story: Story, cloze: StoryCloze): void {
    this.story.set(story);
    this.cloze.set(cloze);
  }

  clear(): void {
    this.story.set(null);
    this.cloze.set(null);
  }
}
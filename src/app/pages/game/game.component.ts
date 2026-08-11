import { Component, computed, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { WordService } from '../../services/word.service';
import { SettingsService } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { Gender, Word } from '../../models/word';

interface GameResult {
  word: Word;
  selected: Gender;
  correct: boolean;
}

@Component({
  selector: 'app-game',
  imports: [
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
  ],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent {
  readonly genders: { key: Gender; label: string; color: string }[] = [
    { key: 'der', label: 'der', color: '#1976d2' },
    { key: 'die', label: 'die', color: '#d32f2f' },
    { key: 'das', label: 'das', color: '#388e3c' },
  ];

  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);

  private readonly queue = signal<Word[]>([]);
  private readonly currentIndex = signal(0);
  readonly selectedGender = signal<Gender | null>(null);
  readonly results = signal<GameResult[]>([]);
  readonly gameStarted = signal(false);
  readonly gameFinished = signal(false);

  readonly currentWord = computed<Word | null>(() => {
    const q = this.queue();
    const i = this.currentIndex();
    return i < q.length ? q[i] : null;
  });

  readonly currentNumber = computed(() => this.currentIndex() + 1);
  readonly totalWords = computed(() => this.queue().length);
  readonly score = computed(
    () => this.results().filter((r) => r.correct).length
  );
  readonly filteredWords = computed(() =>
    this.wordService.getWordsByDateRange(this.fromDate(), this.toDate())
  );
  readonly availableWords = computed(() => this.filteredWords().length);
  readonly filterActive = computed(
    () => this.fromDate() !== null || this.toDate() !== null
  );

  constructor(
    private readonly wordService: WordService,
    private readonly settingsService: SettingsService,
    private readonly speechService: SpeechService
  ) {}

  getTranslation(word: Word): string {
    return this.settingsService.getTranslation(word);
  }

  clearFilter(): void {
    this.fromDate.set(null);
    this.toDate.set(null);
  }

  speakCurrentWord(): void {
    const word = this.currentWord();
    if (word) {
      this.speechService.speak(`${word.gender} ${word.german}`);
    }
  }

  startGame(): void {
    const words = [...this.filteredWords()].filter((w) => w.partOfSpeech === 'noun');
    this.shuffle(words);
    this.queue.set(words);
    this.currentIndex.set(0);
    this.results.set([]);
    this.selectedGender.set(null);
    this.gameStarted.set(true);
    this.gameFinished.set(false);
  }

  selectGender(gender: Gender): void {
    if (this.selectedGender() !== null) {
      return;
    }
    const word = this.currentWord();
    if (!word) {
      return;
    }
    this.selectedGender.set(gender);
    this.results.update((results) => [
      ...results,
      { word, selected: gender, correct: gender === word.gender },
    ]);

    // Automatically pronounce the correct article + word
    this.speechService.speak(`${word.gender} ${word.german}`);
  }

  nextWord(): void {
    if (this.currentIndex() + 1 >= this.queue().length) {
      this.gameFinished.set(true);
      return;
    }
    this.currentIndex.update((i) => i + 1);
    this.selectedGender.set(null);
  }

  restart(): void {
    this.startGame();
  }

  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
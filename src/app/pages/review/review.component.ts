import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { WordService } from '../../services/word.service';
import { SettingsService } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { PartOfSpeechService } from '../../services/part-of-speech.service';
import { DifficultyLevel, Gender, PartOfSpeech, VerbType, Word } from '../../models/word';

@Component({
  selector: 'app-review',
  imports: [
    FormsModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
  ],
  templateUrl: './review.component.html',
  styleUrl: './review.component.scss',
})
export class ReviewComponent {
  readonly genders: { key: Gender; label: string; color: string }[] = [
    { key: 'der', label: 'der', color: '#1976d2' },
    { key: 'die', label: 'die', color: '#d32f2f' },
    { key: 'das', label: 'das', color: '#388e3c' },
  ];

  readonly levels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  readonly partsOfSpeech: PartOfSpeech[] = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'numeral', 'phrase'];

  readonly fromDate = signal<Date | null>(null);
  readonly toDate = signal<Date | null>(null);
  readonly searchQuery = signal('');
  readonly posFilter = signal<PartOfSpeech | ''>('');
  readonly levelFilter = signal<DifficultyLevel | ''>('');
  readonly masteryMin = signal<number | null>(null);
  readonly masteryMax = signal<number | null>(null);

  readonly dateFilteredWords = computed(() =>
    this.wordService.getWordsByDateRange(this.fromDate(), this.toDate())
  );

  readonly filteredWords = computed(() => {
    let words = this.dateFilteredWords();
    const search = this.searchQuery().toLowerCase().trim();
    const pos = this.posFilter();
    const level = this.levelFilter();
    const min = this.masteryMin();
    const max = this.masteryMax();

    if (search) {
      words = words.filter(
        (w) =>
          w.german.toLowerCase().includes(search) ||
          w.translationEn.toLowerCase().includes(search) ||
          w.translationRu.toLowerCase().includes(search)
      );
    }
    if (pos) {
      words = words.filter((w) => w.partOfSpeech === pos);
    }
    if (level) {
      words = words.filter((w) => w.level === level);
    }
    if (min !== null) {
      words = words.filter((w) => w.mastery >= min);
    }
    if (max !== null) {
      words = words.filter((w) => w.mastery <= max);
    }
    return words;
  });

  readonly wordsByGender = computed(() => {
    const words = this.paginatedWords();
    const nouns = words.filter((w) => w.gender !== null);
    return {
      der: nouns.filter((w) => w.gender === 'der'),
      die: nouns.filter((w) => w.gender === 'die'),
      das: nouns.filter((w) => w.gender === 'das'),
      other: words.filter((w) => w.gender === null),
    };
  });

  readonly filterActive = computed(
    () =>
      this.fromDate() !== null ||
      this.toDate() !== null ||
      this.searchQuery().trim().length > 0 ||
      this.posFilter() !== '' ||
      this.levelFilter() !== '' ||
      this.masteryMin() !== null ||
      this.masteryMax() !== null
  );

  // Pagination
  readonly page = signal(1);
  readonly pageSize = signal(30);
  readonly pageSizeOptions = [10, 30, 50, 100];

  /** Toggle: when true, distribute words equally across columns instead of chunking chronologically */
  readonly equalDistribution = signal(false);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredWords().length / this.pageSize()))
  );

  /** Words on the current page — either chronological slice or equally distributed */
  readonly paginatedWords = computed(() => {
    const words = this.filteredWords();
    const size = this.pageSize();

    if (!this.equalDistribution()) {
      const start = (this.page() - 1) * size;
      return words.slice(start, start + size);
    }

    // Equal distribution mode: split words into 4 gender pools, take evenly from each
    const der = words.filter((w) => w.gender === 'der');
    const die = words.filter((w) => w.gender === 'die');
    const das = words.filter((w) => w.gender === 'das');
    const other = words.filter((w) => w.gender === null);
    const columns = [der, die, das, other];

    // How many per column per page (round-robin: 8,8,7,7 for 30; 3,3,2,2 for 10)
    const base = Math.floor(size / 4);
    const firstNGetExtra = size % 4;
    const perColumn = [0, 1, 2, 3].map((idx) => base + (idx < firstNGetExtra ? 1 : 0));

    // For this page, skip (page-1) * perColumn[i] items from each pool
    const prevPages = this.page() - 1;
    const result: Word[] = [];
    for (let i = 0; i < 4; i++) {
      const skip = prevPages * perColumn[i];
      result.push(...columns[i].slice(skip, skip + perColumn[i]));
    }
    return result;
  });

  readonly expandedWordId = signal<string | null>(null);

  constructor(
    private readonly wordService: WordService,
    private readonly settingsService: SettingsService,
    private readonly speechService: SpeechService,
    private readonly posService: PartOfSpeechService
  ) {
    // Keep page in valid range when filters change the result count
    effect(() => {
      const total = this.totalPages();
      if (this.page() > total) {
        this.page.set(total);
      }
    });
  }

  getTranslation(word: Word): string {
    return this.settingsService.getTranslation(word);
  }

  clearFilter(): void {
    this.fromDate.set(null);
    this.toDate.set(null);
    this.searchQuery.set('');
    this.posFilter.set('');
    this.levelFilter.set('');
    this.masteryMin.set(null);
    this.masteryMax.set(null);
    this.page.set(1);
  }

  setPage(p: number): void {
    const clamped = Math.min(Math.max(1, p), this.totalPages());
    this.page.set(clamped);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
  }

  pageRange(): number[] {
    const total = this.totalPages();
    const current = this.page();
    const range: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }

  speak(word: Word): void {
    const gender = word.gender ? `${word.gender} ` : '';
    this.speechService.speak(`${gender}${word.german}`);
  }

  getPosLabel(word: Word): string {
    return this.posService.getShortLabel(word.partOfSpeech);
  }

  getGenderColor(gender: Gender | null): string {
    return this.genders.find((g) => g.key === gender)?.color ?? '#757575';
  }

  getMasteryColor(mastery: number, genderColor: string): string {
    const hex = genderColor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Opacity scales from 0.05 (0%) to 0.30 (100%)
    const opacity = 0.05 + (mastery / 100) * 0.25;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  toggleExpand(wordId: string): void {
    this.expandedWordId.update((current) => (current === wordId ? null : wordId));
  }

  getVerbTypeLabel(type: VerbType | undefined): string {
    if (!type) return '';
    const labels: Record<VerbType, string> = { strong: 'stark', weak: 'schwach', mixed: 'gemischt' };
    return labels[type];
  }
}

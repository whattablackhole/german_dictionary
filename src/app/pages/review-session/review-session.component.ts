import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Word, ExampleSentence } from '../../models/word';
import { buildAnswerFields, normalizeAnswer, AnswerField } from '../../utils/answer-fields';
import { SrsService, SrsGrade } from '../../services/srs.service';
import { WordService } from '../../services/word.service';
import { SettingsService } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { PartOfSpeechService } from '../../services/part-of-speech.service';
import { ImageCacheService } from '../../services/image-cache.service';
import { ImageGenerationService } from '../../services/image-generation.service';
import { SentenceCacheService } from '../../services/sentence-cache.service';
import { SentenceGenerationService } from '../../services/sentence-generation.service';

type CardDirection = 'de-native' | 'native-de';
type CardDirectionMode = 'de-native' | 'native-de' | 'both';

interface SessionCard {
  word: Word;
  revealed: boolean;
  grade: SrsGrade | null;
  direction: CardDirection;
}

@Component({
  selector: 'app-review-session',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './review-session.component.html',
  styleUrl: './review-session.component.scss',
})
export class ReviewSessionComponent {
  readonly sessionType = signal<'due' | 'new' | 'all'>('due');
  readonly cards = signal<SessionCard[]>([]);
  readonly currentIndex = signal(0);
  readonly sessionFinished = signal(false);
  
  /** Which card direction(s) to include in the session. */
  readonly directionMode = signal<CardDirectionMode>('de-native');

  // Typed-answer state (Native → German production practice)
  readonly answerFields = signal<AnswerField[]>([]);
  readonly answersChecked = signal(false);
  /** Bumped whenever the answer form is (re)built; used to focus the first input. */
  readonly answerNonce = signal(0);

  readonly currentCard = computed(() => {
    const c = this.cards();
    const i = this.currentIndex();
    return i < c.length ? c[i] : null;
  });

  readonly totalCards = computed(() => this.cards().length);
  readonly reviewedCount = computed(() =>
    this.cards().filter((c) => c.grade !== null).length
  );
  readonly progress = computed(() => {
    const total = this.totalCards();
    if (total === 0) return 100;
    return Math.round((this.reviewedCount() / total) * 100);
  });

  readonly genders = [
    { key: 'der' as const, color: '#1976d2' },
    { key: 'die' as const, color: '#d32f2f' },
    { key: 'das' as const, color: '#388e3c' },
  ];

  // Image data for the current word
  readonly currentImage = signal<string | null>(null);
  readonly generatingImage = signal(false);
  // Example sentences for the current word
  readonly currentSentences = signal<ExampleSentence[] | null>(null);
  readonly generatingSentences = signal(false);

  readonly dueCount = computed(() => this.srsService.getDueCount());
  readonly newCount = computed(() => this.srsService.getNewWords().length);

  constructor(
    private readonly srsService: SrsService,
    private readonly wordService: WordService,
    readonly settingsService: SettingsService,
    private readonly speechService: SpeechService,
    private readonly posService: PartOfSpeechService,
    private readonly imageCache: ImageCacheService,
    private readonly imageGen: ImageGenerationService,
    private readonly sentenceCache: SentenceCacheService,
    private readonly sentenceGen: SentenceGenerationService
  ) {
    // Load image and sentences when card changes
    effect(async () => {
      const card = this.currentCard();
      if (card) {
        const img = await this.imageCache.getImage(card.word.id);
        this.currentImage.set(img);
        const sents = await this.sentenceCache.getSentences(card.word.id);
        this.currentSentences.set(sents);
      } else {
        this.currentImage.set(null);
        this.currentSentences.set(null);
      }
      this.generatingImage.set(false);
      this.generatingSentences.set(false);
    });

    // Focus the first typed-answer input whenever a Native → German card renders.
    effect(() => {
      this.answerNonce();
      const card = this.cards()[this.currentIndex()];
      if (!card || card.direction !== 'native-de' || card.revealed) return;
      document.getElementById(`srs-answer-${card.word.id}-0`)?.focus();
    });
  }

  async generateCurrentSentences(): Promise<void> {
    const card = this.currentCard();
    if (!card) return;
    this.generatingSentences.set(true);
    try {
      const sents = await this.sentenceGen.generateSentences(card.word);
      this.currentSentences.set(sents);
    } catch (err) {
      console.error('Failed to generate sentences:', err);
    } finally {
      this.generatingSentences.set(false);
    }
  }

  async generateCurrentWordImage(): Promise<void> {
    const card = this.currentCard();
    if (!card) return;
    this.generatingImage.set(true);
    try {
      const data = await this.imageGen.generateImage(card.word);
      this.currentImage.set(data);
    } catch (err) {
      console.error('Failed to generate image:', err);
    } finally {
      this.generatingImage.set(false);
    }
  }

  getTranslation(word: Word): string {
    return this.settingsService.getTranslation(word);
  }

  getGenderColor(gender: string | null): string {
    return this.genders.find((g) => g.key === gender)?.color ?? '#757575';
  }

  getPosLabel(word: Word): string {
    return this.posService.getShortLabel(word.partOfSpeech);
  }

  getVerbTypeLabel(type: string | undefined): string {
    if (!type) return '';
    const labels: Record<string, string> = {
      strong: 'stark',
      weak: 'schwach',
      mixed: 'gemischt',
    };
    return labels[type] ?? type;
  }

  startSession(type: 'due' | 'new' | 'all'): void {
    let words: Word[];
    if (type === 'due') {
      words = this.srsService.getDueWords();
    } else if (type === 'new') {
      words = this.srsService.getNewWords();
    } else {
      words = this.wordService.getWords();
    }

    const mode = this.directionMode();
    const useBidirectional = mode === 'both';

    if (!useBidirectional) {
      // Simple shuffle for single direction ('de-native' or 'native-de')
      const shuffled = [...words].sort(() => Math.random() - 0.5);
      this.sessionType.set(type);
      this.cards.set(
        shuffled.map((w) => ({ word: w, revealed: false, grade: null, direction: mode as CardDirection }))
      );
      this.currentIndex.set(0);
      this.sessionFinished.set(false);
      this.resetAnswerState();
      return;
    }

    // Bidirectional mode: create de-native and native-de cards with proper shuffling
    // 1. Shuffle for de-native order
    const deNativeOrder = [...words].sort(() => Math.random() - 0.5);
    
    // 2. Shuffle again for native-de order (different order)
    const nativeDeOrder = [...words].sort(() => Math.random() - 0.5);

    // 3. Create de-native cards
    const deNativeCards = deNativeOrder.map((w) => ({ 
      word: w, 
      revealed: false, 
      grade: null, 
      direction: 'de-native' as CardDirection 
    }));

    // 4. Create native-de cards in the second shuffled order
    const nativeDeCards = nativeDeOrder.map((w) => ({ 
      word: w, 
      revealed: false, 
      grade: null, 
      direction: 'native-de' as CardDirection 
    }));

    // 5. Merge: insert each native-de card after its de-native counterpart
    //    but at a random position after it (not immediately after)
    const mergedCards = this.mergeBidirectionalCards(deNativeCards, nativeDeCards);

    this.sessionType.set(type);
    this.cards.set(mergedCards);
    this.currentIndex.set(0);
    this.sessionFinished.set(false);
    this.resetAnswerState();
  }

  /**
   * Merges de-native and native-de cards ensuring each native-de appears
   * after its corresponding de-native card, but shuffled (not immediately after).
   */
  private mergeBidirectionalCards(
    deNativeCards: SessionCard[],
    nativeDeCards: SessionCard[]
  ): SessionCard[] {
    // Create a map from word ID to native-de card for quick lookup
    const nativeDeMap = new Map<string, SessionCard>();
    for (const card of nativeDeCards) {
      nativeDeMap.set(card.word.id, card);
    }

    const result: SessionCard[] = [];
    const remainingNativeDe = new Map(nativeDeMap); // Cards not yet placed

    // First pass: add all de-native cards
    for (const deNativeCard of deNativeCards) {
      result.push(deNativeCard);
    }

    // Second pass: insert each native-de card at a random position 
    // after its de-native card
    for (const deNativeCard of deNativeCards) {
      const nativeDeCard = remainingNativeDe.get(deNativeCard.word.id);
      if (!nativeDeCard) continue;

      // Find the index of the de-native card in result
      const deNativeIndex = result.indexOf(deNativeCard);
      if (deNativeIndex === -1) continue;

      // Insert at a random position after deNativeIndex
      // Range: deNativeIndex + 1 to result.length (inclusive for append)
      const maxInsertPos = result.length;
      const minInsertPos = deNativeIndex + 1;
      
      // If there's room to shuffle (not immediately after), pick random position
      let insertPos: number;
      if (maxInsertPos > minInsertPos) {
        insertPos = minInsertPos + Math.floor(Math.random() * (maxInsertPos - minInsertPos + 1));
      } else {
        insertPos = maxInsertPos; // Append at end
      }

      result.splice(insertPos, 0, nativeDeCard);
      remainingNativeDe.delete(deNativeCard.word.id);
    }

    // Any remaining native-de cards (shouldn't happen, but safety)
    for (const card of remainingNativeDe.values()) {
      result.push(card);
    }

    return result;
  }

  /** Front-click handler: only German→Native cards reveal on tap (native→German requires typing). */
  onFrontClick(card: SessionCard): void {
    if (card.direction === 'de-native' && !card.revealed) {
      this.revealCard();
    }
  }

  revealCard(): void {
    const card = this.currentCard();
    if (!card || card.revealed) return;
    this.cards.update((cards) =>
      cards.map((c, i) =>
        i === this.currentIndex() ? { ...c, revealed: true } : c
      )
    );
    this.speakWord(card.word);
  }

  onAnswerInput(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.answerFields.update((fields) =>
      fields.map((f, i) => (i === index ? { ...f, value } : f))
    );
  }

  onAnswerEnter(index: number, event: Event): void {
    event.preventDefault();
    const card = this.cards()[this.currentIndex()];
    if (!card) return;
    if (index + 1 < this.answerFields().length) {
      document.getElementById(`srs-answer-${card.word.id}-${index + 1}`)?.focus();
    } else {
      this.checkAnswers();
    }
  }

  checkAnswers(): void {
    const card = this.currentCard();
    if (!card || card.revealed) return;
    this.answerFields.update((fields) =>
      fields.map((f) => ({
        ...f,
        correct: normalizeAnswer(f.value) === f.expectedKey,
      }))
    );
    this.answersChecked.set(true);
    this.revealCard();
  }

  /** Gives up on typing: reveals the German word without scoring. */
  showAnswer(): void {
    const card = this.currentCard();
    if (!card || card.revealed) return;
    this.revealCard();
  }

  private resetAnswerState(): void {
    const card = this.cards()[this.currentIndex()];
    this.answersChecked.set(false);
    if (card && card.direction === 'native-de') {
      this.answerFields.set(buildAnswerFields(card.word));
    } else {
      this.answerFields.set([]);
    }
    this.answerNonce.update((n) => n + 1);
  }

  recordGrade(grade: SrsGrade): void {
    const card = this.currentCard();
    if (!card) return;

    const result = this.srsService.recordReview(card.word.id, grade);

    // Update the card with the fresh word data so the template shows the new interval
    this.cards.update((cards) =>
      cards.map((c, i) =>
        i === this.currentIndex() ? { ...c, grade, word: result.word } : c
      )
    );
  }

  nextCard(): void {
    if (this.currentIndex() + 1 >= this.totalCards()) {
      this.sessionFinished.set(true);
      return;
    }
    this.currentIndex.update((i) => i + 1);
    this.resetAnswerState();
  }

  speakWord(word: Word): void {
    const gender = word.gender ? `${word.gender} ` : '';
    this.speechService.speak(`${gender}${word.german}`);
  }

  restart(): void {
    this.cards.set([]);
    this.currentIndex.set(0);
    this.sessionFinished.set(false);
    this.resetAnswerState();
  }

  goToReviewPage(): void {
    window.location.href = '/review';
  }
}
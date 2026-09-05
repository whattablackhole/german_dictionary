import { Component, OnInit, Signal, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Story } from '../../models/story';
import { StoryCloze } from '../../models/story-cloze';
import { StoryClozeResult } from '../../models/story-cloze-history';
import { StoryClozeService } from '../../services/story-cloze.service';
import { StoryClozeHistoryService } from '../../services/story-cloze-history.service';
import { buildClozeSegments, normalizeGermanText } from '../../utils/german';

/** One removed word in the session; each piece is unique and maps 1:1 to a blank slot. */
interface ClozePiece {
  id: string;
  word: string;
  sentenceIndex: number;
  blankIndex: number;
}

/** A rendered story sentence made of plain-text and blank-slot pieces. */
interface ClozeDisplaySegment {
  text: string;
  blankIndex: number;
  slotKey: string;
  key: string;
}

function slotKey(sentenceIndex: number, blankIndex: number): string {
  return `s${sentenceIndex}-b${blankIndex}`;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Story Cloze mode: the AI removes 10-50 words from a story (max 2 per
 * sentence) and the learner drag-and-drops them back into the gaps from a word
 * bank underneath the story.
 */
@Component({
  selector: 'app-story-cloze',
  imports: [CommonModule, MatIconModule, MatButtonModule, DragDropModule],
  templateUrl: './story-cloze.component.html',
  styleUrl: './story-cloze.component.scss',
})
export class StoryClozeComponent implements OnInit {
  readonly story: Signal<Story | null>;
  readonly cloze: Signal<StoryCloze | null>;

  /** Words still sitting in the word bank (in display order). */
  readonly bankPieces = signal<ClozePiece[]>([]);
  /** Per-blank placement state: slot key -> (0 or 1) pieces currently inside it. */
  readonly slotArrays = signal<Record<string, ClozePiece[]>>({});
  /** The bank word currently selected for click-to-place (or null). */
  readonly selectedBankPiece = signal<ClozePiece | null>(null);

  readonly checked = signal(false);
  readonly finished = signal(false);
  readonly checkedResults = signal<StoryClozeResult[]>([]);
  readonly slotCorrect = signal<Record<string, boolean>>({});

  /** All removable words in reading order. */
  readonly pieces = computed<ClozePiece[]>(() => {
    const cloze = this.cloze();
    if (!cloze) return [];
    const list: ClozePiece[] = [];
    cloze.sentences.forEach((s, si) => {
      s.removedWords.forEach((w, bi) => {
        list.push({
          id: `${si}-${bi}`,
          word: w,
          sentenceIndex: si,
          blankIndex: bi,
        });
      });
    });
    return list;
  });

  /** The story rendered sentence-by-sentence with blank slots in place. */
  readonly displaySentences = computed(() => {
    const cloze = this.cloze();
    if (!cloze) return [];
    return cloze.sentences.map((sent, si) => {
      const raw = buildClozeSegments(sent.text, sent.removedWords);
      const segments: ClozeDisplaySegment[] = (raw ?? [
        { text: sent.text, blankIndex: -1 },
      ]).map((seg, i) => ({
        text: seg.text,
        blankIndex: seg.blankIndex,
        slotKey: seg.blankIndex >= 0 ? slotKey(si, seg.blankIndex) : '',
        key: `${si}-seg${i}`,
      }));
      return { indexKey: `s${si}`, segments };
    });
  });

  readonly totalBlanks = computed(() => this.pieces().length);

  readonly placedCount = computed(() =>
    Object.values(this.slotArrays()).reduce((n, arr) => n + arr.length, 0)
  );

  readonly correctCount = computed(
    () => this.checkedResults().filter((r) => r.correct).length
  );

  readonly scorePercent = computed(() => {
    const total = this.totalBlanks();
    return total === 0 ? 0 : Math.round((this.correctCount() / total) * 100);
  });

  constructor(
    readonly storyClozeService: StoryClozeService,
    private readonly historyService: StoryClozeHistoryService,
    private readonly router: Router
  ) {
    this.story = storyClozeService.story;
    this.cloze = storyClozeService.cloze;
  }

  ngOnInit(): void {
    this.start();
  }

  /** (Re)builds the session: puts every removed word into the bank (shuffled)
   *  and empties all slots. */
  start(): void {
    const pieces = this.pieces();
    const slots: Record<string, ClozePiece[]> = {};
    for (const p of pieces) {
      slots[slotKey(p.sentenceIndex, p.blankIndex)] = [];
    }
    this.bankPieces.set(shuffle(pieces));
    this.slotArrays.set(slots);
    this.selectedBankPiece.set(null);
    this.checked.set(false);
    this.finished.set(false);
    this.checkedResults.set([]);
    this.slotCorrect.set({});
  }

  restart(): void {
    this.start();
  }

  /** Returns the pieces currently stored inside the given slot (0 or 1). */
  slotArray(key: string): ClozePiece[] {
    return this.slotArrays()[key] ?? [];
  }

  slotCount(key: string): number {
    return this.slotArray(key).length;
  }

  slotFirst(key: string): ClozePiece | null {
    return this.slotArray(key)[0] ?? null;
  }

  /** Maps a bound drop-list data array back to a slot key (null = word bank). */
  private slotKeyForData(data: ClozePiece[]): string | null {
    if (data === this.bankPieces()) return null;
    for (const [key, arr] of Object.entries(this.slotArrays())) {
      if (arr === data) return key;
    }
    return null;
  }

  /** Central drag & drop handler shared by the bank and every slot. */
  onDrop(event: CdkDragDrop<ClozePiece[]>): void {
    if (this.checked()) return;
    this.selectedBankPiece.set(null);

    const from = event.previousContainer.data;
    const to = event.container.data;

    // Same list: only the bank can reorder (slots hold at most one item).
    if (event.previousContainer === event.container) {
      if (from === this.bankPieces()) {
        moveItemInArray(from, event.previousIndex, event.currentIndex);
        this.bankPieces.set([...from]);
      }
      this.afterListsChanged();
      return;
    }

    const targetKey = this.slotKeyForData(to);

    if (targetKey === null) {
      // Chip dropped on the bank -> return it (not placed in a slot anymore).
      transferArrayItem(
        from,
        to,
        event.previousIndex,
        Math.max(0, Math.min(to.length, event.currentIndex))
      );
      this.bankPieces.set([...to]);
    } else {
      // Chip dropped on a slot -> swap out any current occupant first.
      if (to.length > 0) {
        this.bankPieces().push(to[0]);
        to.length = 0;
      }
      transferArrayItem(from, to, event.previousIndex, 0);
      this.bankPieces.set([...this.bankPieces()]);
    }

    this.afterListsChanged();
  }

  /** Touch-friendly fallback: pick a bank word, then tap a gap. */
  onBankChipClick(piece: ClozePiece): void {
    if (this.checked()) return;
    const selected = this.selectedBankPiece();
    this.selectedBankPiece.set(selected?.id === piece.id ? null : piece);
  }

  /** Places the selected bank word into a tapped gap (swap if the gap is full). */
  onSlotClick(key: string): void {
    if (this.checked()) return;
    const piece = this.selectedBankPiece();
    if (!piece) return;

    const bank = this.bankPieces();
    const fromIndex = bank.findIndex((p) => p.id === piece.id);
    if (fromIndex === -1) return;

    const target = this.slotArrays()[key] ?? [];
    if (target.length === 0 && this.slotArrays()[key] === undefined) return;

    // Gap already filled -> send the current word back to the bank (tap = swap).
    if (target.length > 0) {
      bank.push(target[0]);
      target.length = 0;
    }
    target.push(piece);
    bank.splice(fromIndex, 1);
    this.bankPieces.set([...bank]);
    this.slotArrays.set({ ...this.slotArrays() });
    this.selectedBankPiece.set(null);
  }

  /** Removes a placed word back into the bank (chip's ✕ button). */
  removeFromSlot(key: string, event: Event): void {
    event.stopPropagation();
    if (this.checked()) return;
    const target = this.slotArrays()[key];
    const piece = target?.[0];
    if (!piece) return;
    this.bankPieces().push(piece);
    target!.length = 0;
    this.bankPieces.set([...this.bankPieces()]);
    this.slotArrays.set({ ...this.slotArrays() });
    this.selectedBankPiece.set(null);
  }

  clearSelection(): void {
    this.selectedBankPiece.set(null);
  }

  /** Grades every placement (local, exact-word comparison). */
  checkAnswers(): void {
    if (this.checked()) return;
    const results = this.buildResults();
    const correctMap: Record<string, boolean> = {};
    for (const r of results) {
      correctMap[slotKey(r.sentenceIndex, r.blankIndex)] = r.correct;
    }
    this.checkedResults.set(results);
    this.slotCorrect.set(correctMap);
    this.checked.set(true);
  }

  /** True when the slot with `key` was answered correctly (after checking). */
  isSlotCorrect(key: string): boolean {
    return this.checked() && (this.slotCorrect()[key] ?? false);
  }

  correctWordFor(key: string): string {
    return (
      this.pieces().find(
        (p) => slotKey(p.sentenceIndex, p.blankIndex) === key
      )?.word ?? ''
    );
  }

  /** Persists the session and shows the results screen. */
  finishSession(): void {
    const results = this.buildResults();
    this.checkedResults.set(results);
    this.saveResults(results);
    this.checked.set(true);
    this.finished.set(true);
  }

  /** Quits mid-session: persists results so far and returns to the story page. */
  quitSession(): void {
    this.saveResults(this.buildResults());
    this.goBackToStory();
  }

  backToStories(): void {
    this.goBackToStory();
  }

  /** Navigates back to the specific story page for this session's story. */
  private goBackToStory(): void {
    const story = this.storyClozeService.story();
    this.storyClozeService.clear();
    if (story) {
      this.router.navigate(['/stories', story.id]);
    } else {
      this.router.navigate(['/stories']);
    }
  }

  /** Persists the given session results (skips runs with no answered blanks). */
  private saveResults(results: StoryClozeResult[]): void {
    const story = this.storyClozeService.story();
    const cloze = this.storyClozeService.cloze();
    if (!story || !cloze) return;
    if (results.every((r) => !r.answered)) return;
    this.historyService.addSession(story, cloze, results);
  }

  private buildResults(): StoryClozeResult[] {
    return this.pieces().map((p) => {
      const key = slotKey(p.sentenceIndex, p.blankIndex);
      const placed = this.slotArrays()[key]?.[0] ?? null;
      const answered = placed !== null;
      const correct =
        answered &&
        normalizeGermanText(placed.word) === normalizeGermanText(p.word);
      return {
        sentenceIndex: p.sentenceIndex,
        blankIndex: p.blankIndex,
        correctWord: p.word,
        placedWord: placed?.word ?? null,
        answered,
        correct,
      };
    });
  }

  /** Re-creates the slot record so Angular refreshes cdkDropListData bindings. */
  private afterListsChanged(): void {
    this.slotArrays.set({ ...this.slotArrays() });
  }
}
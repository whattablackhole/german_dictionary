import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  GERMAN_VERBS,
  GERMAN_PREFIX_GROUPS,
  GermanVerbEntry,
} from '../../data/german-verbs';
import { AiService, GeneratedVerbSentence } from '../../services/ai.service';
import { SettingsService } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { TtsCacheService } from '../../services/tts-cache.service';
import { VerbImportService } from '../../services/verb-import.service';
import { VerbTrainerService } from '../../services/verb-trainer.service';
import { WordService } from '../../services/word.service';
import { Word } from '../../models/word';
import {
  GERMAN_PERSONS,
  GERMAN_TENSES,
  GERMAN_TENSE_LABELS,
  normalizeGermanText,
  buildBlankSegments,
  BlankSegment,
} from '../../utils/german';
import {
  VerbTrainerPerson,
  VerbTrainerTense,
} from '../../models/verb-trainer';

/**
 * Most recent unique person × tense combos sent to the AI as "avoid" context
 * for unfiltered drills (6 persons × 6 tenses = 36 possible combos).
 */
const RECENT_SLOT_CONTEXT_MAX = 12;

/** One generated sentence drill as rendered by this page. */
interface DrillSentence {
  fullSentence: string;
  blankWords: string[];
  person: VerbTrainerPerson;
  tense: VerbTrainerTense;
  hintEn: string;
  hintRu: string;
  /** Sentence split into text/blank segments for the inline inputs. */
  segments: BlankSegment[];
  /** What the student wrote into each blank (parallel to blankWords). */
  answers: string[];
  /** null until checked, then per-blank correctness. */
  blankResults: boolean[] | null;
  correct: boolean | null;
}

@Component({
  selector: 'app-verbs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './verbs.component.html',
  styleUrl: './verbs.component.scss',
})
export class VerbsComponent {
  private readonly aiService = inject(AiService);
  private readonly settingsService = inject(SettingsService);
  private readonly speechService = inject(SpeechService);
  private readonly ttsCache = inject(TtsCacheService);
  private readonly verbImport = inject(VerbImportService);
  private readonly wordService = inject(WordService);
  readonly verbTrainer = inject(VerbTrainerService);

  readonly persons = GERMAN_PERSONS;
  readonly tenses = GERMAN_TENSES;
  readonly tenseLabels = GERMAN_TENSE_LABELS;

  // ── Catalog ──
  readonly search = signal('');
  /**
   * Prefix filter: 'all' | 'none' | 'separable' | 'inseparable'
   * or a concrete prefix such as 'an' or 'ver'.
   */
  readonly prefixFilter = signal('all');
  readonly onlyInDictionary = signal(false);
  readonly currentPage = signal(1);
  readonly pageSize = 60;
  readonly infoMessage = signal('');

  /** All prefixes present in the data (table defaults plus any extra ones). */
  readonly prefixFilters = computed(() => {
    const used = new Set<string>();
    GERMAN_PREFIX_GROUPS.forEach((g) => used.add(g.prefix));
    GERMAN_VERBS.forEach((e) => e.prefix && used.add(e.prefix));
    return [...used].sort((a, b) => a.localeCompare(b, 'de'));
  });

  readonly filteredEntries = computed(() => {
    let entries = GERMAN_VERBS;
    const q = this.search().trim().toLowerCase();
    if (q) entries = entries.filter((e) => e.infinitive.toLowerCase().includes(q));

    const f = this.prefixFilter();
    if (f === 'none') {
      entries = entries.filter((e) => !e.prefix);
    } else if (f === 'separable') {
      entries = entries.filter((e) => e.separable === true);
    } else if (f === 'inseparable') {
      entries = entries.filter((e) => !!e.prefix && e.separable !== true);
    } else if (f !== 'all') {
      entries = entries.filter((e) => e.prefix === f);
    }

    if (this.onlyInDictionary()) {
      entries = entries.filter((e) => !!this.verbImport.findInDictionary(e.infinitive));
    }
    return entries;
  });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredEntries().length / this.pageSize))
  );

  readonly pagedEntries = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredEntries().slice(start, start + this.pageSize);
  });

  readonly stats = computed(() => {
    const verbs = GERMAN_VERBS;
    const inDictionary = verbs.filter((v) => this.verbImport.findInDictionary(v.infinitive))
      .length;
    return {
      total: verbs.length,
      prefixed: verbs.filter((v) => v.prefix).length,
      separable: verbs.filter((v) => v.separable === true).length,
      inDictionary,
    };
  });

  statusOf(entry: GermanVerbEntry): string {
    return this.verbImport.getStatus(entry);
  }

  async addToDictionary(entry: GermanVerbEntry): Promise<void> {
    this.infoMessage.set('');
    try {
      const word = await this.verbImport.ensureVerbInDictionary(entry);
      if (word) {
        this.wordService.incrementUsage([word.german]);
        this.infoMessage.set(
          `"${word.german}" added to your dictionary — review it in the Review tab.`
        );
      }
    } catch (err) {
      this.infoMessage.set(
        err instanceof Error ? err.message : 'Failed to add the verb to the dictionary.'
      );
    }
  }

  onSearch(): void {
    this.currentPage.set(1);
  }

  setPrefixFilter(filter: string): void {
    this.prefixFilter.set(filter);
    this.currentPage.set(1);
  }

  setOnlyInDictionary(checked: boolean): void {
    this.onlyInDictionary.set(checked);
    this.currentPage.set(1);
  }

  // ── Trainer ──
  readonly selectedVerb = signal<GermanVerbEntry | null>(null);
  readonly lazyWord = signal<Word | null>(null);
  readonly lazyLoading = signal(false);
  /** Selected persons; empty selection means "all". */
  readonly selectedPersons = signal<VerbTrainerPerson[]>([]);
  /** Selected tenses; empty selection means "all". */
  readonly selectedTenses = signal<VerbTrainerTense[]>([]);
  readonly sentenceCount = signal(5);
  readonly generatingSentences = signal(false);
  readonly drillSentences = signal<DrillSentence[]>([]);
  readonly trainerError = signal('');

  readonly infinitive = computed(() => this.selectedVerb()?.infinitive ?? '');

  readonly trainerStats = computed(() => {
    const verb = this.infinitive();
    return verb
      ? this.verbTrainer.getStatsByVerb(verb)
      : { total: 0, correct: 0, accuracy: 0 };
  });

  readonly recentAttempts = computed(() => {
    const verb = this.infinitive();
    return verb ? this.verbTrainer.getHistoryByVerb(verb).slice(0, 8) : [];
  });

  /**
   * Person × tense combos the student already practiced for the current verb
   * (newest first, deduped, capped). Only sent to the AI when NEITHER the
   * person filter NOR the tense filter is active: with a filter the student
   * explicitly chose what to practice, so the AI must stick to it instead of
   * skipping combinations. With no filters these combos bias the next batch
   * away from recently practiced slots — a broad mix is the whole point of
   * unfiltered drills.
   */
  private recentSlotContext(): Array<{
    person: VerbTrainerPerson;
    tense: VerbTrainerTense;
  }> {
    if (this.selectedPersons().length > 0 || this.selectedTenses().length > 0) {
      return [];
    }
    const verb = this.infinitive();
    if (!verb) return [];
    const seen = new Set<string>();
    const slots: Array<{
      person: VerbTrainerPerson;
      tense: VerbTrainerTense;
    }> = [];
    for (const attempt of this.verbTrainer.getHistoryByVerb(verb)) {
      if (slots.length >= RECENT_SLOT_CONTEXT_MAX) break;
      const key = `${attempt.tense}|${attempt.person}`;
      if (seen.has(key)) continue;
      seen.add(key);
      slots.push({ person: attempt.person, tense: attempt.tense });
    }
    return slots;
  }

  async openTrainer(entry: GermanVerbEntry): Promise<void> {
    this.selectedVerb.set(entry);
    this.resetDrill();
    const known = this.verbImport.findInDictionary(entry.infinitive);
    this.lazyWord.set(known ?? null);
    if (!known) {
      // Lazy enrich: the verb joins the dictionary when the user starts training it.
      this.lazyLoading.set(true);
      try {
        const word = await this.verbImport.ensureVerbInDictionary(entry);
        this.lazyWord.set(word);
      } catch (err) {
        this.trainerError.set(
          err instanceof Error ? err.message : 'Could not enrich the verb. Check your AI key.'
        );
      } finally {
        this.lazyLoading.set(false);
      }
    }
  }

  closeTrainer(): void {
    this.selectedVerb.set(null);
    this.lazyWord.set(null);
    this.resetDrill();
    this.trainerError.set('');
  }

  resetDrill(): void {
    this.drillSentences.set([]);
    this.trainerError.set('');
  }

  togglePerson(p: VerbTrainerPerson): void {
    this.selectedPersons.update((list) =>
      list.includes(p) ? list.filter((x) => x !== p) : [...list, p]
    );
    this.resetDrill();
  }

  toggleTense(t: VerbTrainerTense): void {
    this.selectedTenses.update((list) =>
      list.includes(t) ? list.filter((x) => x !== t) : [...list, t]
    );
    this.resetDrill();
  }

  clearPersonFilters(): void {
    this.selectedPersons.set([]);
    this.resetDrill();
  }

  clearTenseFilters(): void {
    this.selectedTenses.set([]);
    this.resetDrill();
  }

  setSentenceCount(count: number): void {
    this.sentenceCount.set(count);
    this.resetDrill();
  }

  tenseLabel(t: VerbTrainerTense): string {
    return this.tenseLabels[t];
  }

  /**
   * Generate sentence drills for the current verb, filtered by the selected
   * persons and tenses (empty selection = all). Each drill hides the verb
   * form(s) inside a natural sentence behind inline inputs.
   */
  async generateSentences(): Promise<void> {
    const entry = this.selectedVerb();
    const verb = this.infinitive();
    if (!entry || !verb) return;

    this.generatingSentences.set(true);
    this.trainerError.set('');
    try {
      if (!this.lazyWord()) {
        this.lazyWord.set(await this.verbImport.ensureVerbInDictionary(entry));
      }
      const word = this.lazyWord();
      if (!word) {
        throw new Error('Add the verb to the dictionary first (AI key needed).');
      }
      const generated = await this.aiService.generateVerbSentences(
        verb,
        {
          translationEn: word.translationEn,
          translationRu: word.translationRu,
        },
        this.selectedPersons(),
        this.selectedTenses(),
        this.sentenceCount(),
        {
          presentThirdPerson: word.presentThirdPerson,
          simplePast: word.simplePast,
          pastParticiple: word.pastParticiple,
        },
        this.recentSlotContext()
      );
      const drills = generated
        .map((g) => this.toDrillSentence(g))
        .filter((d): d is DrillSentence => d !== null);
      if (drills.length === 0) {
        throw new Error('The AI could not generate valid sentences. Try again.');
      }
      this.drillSentences.set(this.shuffleArray(drills));
      this.wordService.incrementUsage([verb]);
    } catch (err) {
      this.trainerError.set(
        err instanceof Error ? err.message : 'Generation failed. Try again.'
      );
    } finally {
      this.generatingSentences.set(false);
    }
  }

  private toDrillSentence(g: GeneratedVerbSentence): DrillSentence | null {
    const segments = buildBlankSegments(g.fullSentence, g.blankWords);
    if (!segments) return null;
    return {
      fullSentence: g.fullSentence,
      blankWords: g.blankWords,
      person: g.person as VerbTrainerPerson,
      tense: g.tense as VerbTrainerTense,
      hintEn: g.hintEn ?? '',
      hintRu: g.hintRu ?? '',
      segments,
      answers: g.blankWords.map(() => ''),
      blankResults: null,
      correct: null,
    };
  }

  /** Grades one drill: compares each inline answer with the expected word. */
  checkSentence(index: number): void {
    const sentence = this.drillSentences()[index];
    if (!sentence || sentence.correct !== null) return;

    const blankResults = sentence.blankWords.map((expected, i) =>
      normalizeGermanText(sentence.answers[i]) === normalizeGermanText(expected)
    );
    const correct = blankResults.every(Boolean);

    this.drillSentences.update((list) =>
      list.map((s, i) => (i === index ? { ...s, blankResults, correct } : s))
    );

    this.verbTrainer.record({
      verb: this.infinitive(),
      person: sentence.person,
      tense: sentence.tense,
      mode: 'sentence',
      answer: sentence.answers.join(' '),
      correct,
      expected: sentence.blankWords.join(' '),
      score: correct
        ? 100
        : Math.round(
            (blankResults.filter(Boolean).length / blankResults.length) * 100
          ),
      explanation: '',
      ts: new Date().toISOString(),
    });
    if (this.infinitive()) {
      this.wordService.incrementUsage([this.infinitive()]);
    }

    // Pronounce the CORRECT sentence, never the student's typed (possibly
    // wrong) variant — the prompt word "play only correct version".
    this.speakSentence(sentence.fullSentence);
  }

  /**
   * Pronounces a German sentence using the configured TTS engine: browser
   * SpeechSynthesis (free) or the OpenAI-style audio model from Settings.
   * Errors are swallowed so grading never breaks because audio failed.
   */
  private async speakSentence(text: string): Promise<void> {
    if (!text.trim() || this.generatingSentences()) return;

    if (this.settingsService.ttsEngine() === 'openai') {
      const ttsOptions = {
        model: this.settingsService.ttsModel(),
        voice: this.settingsService.ttsVoice(),
      };
      try {
        const cached = await this.ttsCache.getAudio(text, ttsOptions);
        const dataUrl =
          cached ?? (await this.aiService.generateSpeech(text, ttsOptions));
        if (!cached) {
          await this.ttsCache.setAudio(text, dataUrl, ttsOptions);
        }
        const audio = new Audio(dataUrl);
        await audio.play();
      } catch {
        // AI TTS failed — fall back to the built-in browser voice.
        this.speechService.speak(text);
      }
    } else {
      this.speechService.speak(text);
    }
  }

  onAnswerChange(index: number, blankIndex: number, value: string): void {
    this.drillSentences.update((list) =>
      list.map((s, i) => {
        if (i !== index) return s;
        const answers = [...s.answers];
        answers[blankIndex] = value;
        return { ...s, answers };
      })
    );
  }

  allAnswered(drill: DrillSentence): boolean {
    return drill.answers.every((a) => a.trim().length > 0);
  }

  /** Approximate input width from the expected word length. */
  blankSize(word: string): number {
    return Math.max(word.length + 2, 6);
  }

  /** Replays the correct German version of an already checked drill. */
  replaySentence(drill: DrillSentence): void {
    if (drill.correct === null) return;
    void this.speakSentence(drill.fullSentence);
  }

  hasApiKey(): boolean {
    return this.aiService.hasApiKey();
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
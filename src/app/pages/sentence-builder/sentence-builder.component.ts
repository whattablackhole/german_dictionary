import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WordService } from '../../services/word.service';
import { AiService, AiSuggestion } from '../../services/ai.service';
import { SentencePatternService } from '../../services/sentence-pattern.service';
import { SentencePattern, PatternHistory, SentenceFeedback } from '../../models/sentence-pattern';
import { PluralFormation } from '../../models/word';
import { TtsCacheService } from '../../services/tts-cache.service';
import { SettingsService } from '../../services/settings.service';

interface ChatMessage {
  type: 'user' | 'ai';
  sentence?: string;
  feedback?: SentenceFeedback;
  timestamp: number;
  loading?: boolean;
}

interface PendingWord {
  word: string;
  /** The word to actually store (normalized to infinitive for verbs) */
  storeAs: string;
  suggestion: AiSuggestion;
  isDuplicate: boolean;
  duplicateOf?: string;
}

@Component({
  selector: 'app-sentence-builder',
  imports: [
    FormsModule,
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatTooltipModule,
  ],
  templateUrl: './sentence-builder.component.html',
  styleUrl: './sentence-builder.component.scss',
})
export class SentenceBuilderComponent {
  readonly patterns: SentencePattern[];
  readonly selectedPatternId = signal<string | null>(null);
  readonly userInput = signal('');
  readonly messages = signal<ChatMessage[]>([]);
  readonly wordBox = signal<{ german: string; translationEn: string; translationRu: string }[]>([]);
  readonly submitting = signal(false);
  readonly aiError = signal('');
  readonly addingWords = signal<Set<number>>(new Set());
  readonly pendingWords = signal<PendingWord[] | null>(null);
  readonly pendingMsgIndex = signal<number | null>(null);
  readonly analyzingWords = signal(false);
  readonly selectedPendingWords = signal<Set<string>>(new Set());

  readonly selectedPattern = computed(() => {
    const id = this.selectedPatternId();
    return id ? this.patternService.getPatternById(id) ?? null : null;
  });

  readonly patternHistory = computed<PatternHistory | null>(() => {
    const id = this.selectedPatternId();
    return id ? this.patternService.getHistory(id) : null;
  });

  readonly playingAudio = signal<string | null>(null);

  constructor(
    private readonly wordService: WordService,
    private readonly aiService: AiService,
    readonly patternService: SentencePatternService,
    private readonly ttsCache: TtsCacheService,
    private readonly settingsService: SettingsService
  ) {
    this.patterns = this.patternService.getAllPatterns();
    this.reseedWords();
  }

  reseedWords(): void {
    const words = this.wordService.getWords();
    this.wordBox.set(this.patternService.seedWords(words, 40));
  }

  insertWord(word: string): void {
    this.userInput.update((val) => {
      const trimmed = val.trim();
      return trimmed ? `${trimmed} ${word} ` : `${word} `;
    });
  }

  selectPattern(id: string): void {
    this.selectedPatternId.set(id);
    this.messages.set([]);
    this.userInput.set('');
    this.aiError.set('');
    this.pendingWords.set(null);
    this.pendingMsgIndex.set(null);
    this.selectedPendingWords.set(new Set());

    // Load history into chat
    const history = this.patternService.getHistory(id);
    if (history.submissions.length > 0) {
      const chatMessages: ChatMessage[] = [];
      for (const sub of history.submissions) {
        chatMessages.push({ type: 'user', sentence: sub.sentence, timestamp: sub.timestamp });
        chatMessages.push({ type: 'ai', feedback: sub.feedback, timestamp: sub.timestamp });
      }
      this.messages.set(chatMessages);
    }
  }

  submitOnEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submitSentence();
    }
  }

  async submitSentence(): Promise<void> {
    const sentence = this.userInput().trim();
    const pattern = this.selectedPattern();
    if (!sentence || !pattern) return;

    this.submitting.set(true);
    this.aiError.set('');

    // Add user message
    const userMsg: ChatMessage = {
      type: 'user',
      sentence,
      timestamp: Date.now(),
    };
    this.messages.update((msgs) => [...msgs, userMsg]);

    // Add loading message
    const loadingMsg: ChatMessage = {
      type: 'ai',
      timestamp: Date.now(),
      loading: true,
    };
    this.messages.update((msgs) => [...msgs, loadingMsg]);

    this.userInput.set('');

    try {
      // AI only checks the grammar pattern. We check vocabulary locally.
      const aiFeedback = await this.aiService.verifySentenceWriting(
        sentence,
        pattern.id,
        pattern.description,
        pattern.tips
      );

      // Local vocabulary check — determine which words are not in the user's vocabulary
      const knownForms = this.buildKnownWordForms();
      const tokenized = sentence
        .toLowerCase()
        .split(/[^a-zäöüß]+/i)
        .filter((w) => w.length > 0);
      const unknownWords = [...new Set(tokenized.filter((w) => !knownForms.has(w)))];

      const feedback: SentenceFeedback = {
        ...aiFeedback,
        vocabCorrect: unknownWords.length === 0,
        unknownWords,
      };

      // Save submission
      const submission = this.patternService.addSubmission(pattern.id, feedback);
      this.patternService.updateSubmissionSentence(pattern.id, submission.id, sentence);

      // Replace loading with actual feedback
      this.messages.update((msgs) => {
        const updated = [...msgs];
        updated[updated.length - 1] = {
          type: 'ai',
          feedback,
          timestamp: Date.now(),
        };
        return updated;
      });
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to analyze sentence.');
      // Remove loading message on error
      this.messages.update((msgs) => msgs.slice(0, -1));
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Builds a set of all known word forms (german, infinitive, conjugated forms)
   * to detect duplicates more intelligently.
   */
  private buildKnownWordForms(): Set<string> {
    const known = new Set<string>();
    for (const w of this.wordService.getWords()) {
      known.add(w.german.toLowerCase());
      if (w.verbType) {
        // Also check all stored conjugated forms
        if (w.presentThirdPerson) known.add(w.presentThirdPerson.toLowerCase());
        if (w.simplePast) known.add(w.simplePast.toLowerCase());
        if (w.pastParticiple) known.add(w.pastParticiple.toLowerCase());
      }
    }
    return known;
  }

  async analyzeUnknownWords(msgIndex: number): Promise<void> {
    const msg = this.messages()[msgIndex];
    if (!msg?.feedback?.unknownWords?.length) return;

    const wordsToCheck = msg.feedback.unknownWords;
    const knownForms = this.buildKnownWordForms();

    this.analyzingWords.set(true);
    this.pendingWords.set(null);
    this.pendingMsgIndex.set(msgIndex);
    this.selectedPendingWords.set(new Set());

    try {
      const pending: PendingWord[] = [];

      for (const word of wordsToCheck) {
        const lower = word.toLowerCase();

        // Check if this word (or a conjugated form of it) is already known
        if (knownForms.has(lower)) {
          const existing = this.wordService.getWords().find(
            (w) =>
              w.german.toLowerCase() === lower ||
              w.presentThirdPerson?.toLowerCase() === lower ||
              w.simplePast?.toLowerCase() === lower ||
              w.pastParticiple?.toLowerCase() === lower
          );
          pending.push({
            word,
            storeAs: word,
            suggestion: null as unknown as AiSuggestion,
            isDuplicate: true,
            duplicateOf: existing?.german ?? word,
          });
          continue;
        }

        const suggestion = await this.aiService.analyzeWord(word);
        // Normalize to dictionary/base form (covers verbs → infinitive,
        // declined pronouns/adjectives like "seine" → "sein", "gute" → "gut")
        const storeAs =
          suggestion.baseForm?.trim() ||
          (suggestion.partOfSpeech === 'verb' && suggestion.infinitive
            ? suggestion.infinitive
            : word);
        pending.push({ word, storeAs, suggestion, isDuplicate: false });
      }

      this.pendingWords.set(pending);
      this.selectedPendingWords.set(new Set(pending.filter((p) => !p.isDuplicate).map((p) => p.word)));
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to analyze words.');
    } finally {
      this.analyzingWords.set(false);
    }
  }

  togglePendingWord(word: string): void {
    this.selectedPendingWords.update((set) => {
      const updated = new Set(set);
      if (updated.has(word)) {
        updated.delete(word);
      } else {
        updated.add(word);
      }
      return updated;
    });
  }

  confirmAddWords(msgIndex: number): void {
    const pending = this.pendingWords();
    if (!pending) return;

    const selected = this.selectedPendingWords();
    const toAdd = pending.filter((p) => !p.isDuplicate && selected.has(p.word));
    if (toAdd.length === 0) return;

    this.addingWords.update((set) => new Set(set).add(msgIndex));

    try {
      for (const p of toAdd) {
        this.wordService.addWord({
          german: p.storeAs,
          partOfSpeech: p.suggestion.partOfSpeech,
          gender: p.suggestion.gender,
          translationEn: p.suggestion.translationEn,
          translationRu: p.suggestion.translationRu,
          level: p.suggestion.level,
          mastery: 0,
          usageCount: 0,
          verbType: p.suggestion.verbType,
          presentThirdPerson: p.suggestion.presentThirdPerson,
          simplePast: p.suggestion.simplePast,
          pastParticiple: p.suggestion.pastParticiple,
          pluralForm: p.suggestion.pluralForm,
          pluralFormation: p.suggestion.pluralFormation as PluralFormation | undefined,
        });
      }

      this.clearUnknownWords(msgIndex);
      this.pendingWords.set(null);
      this.pendingMsgIndex.set(null);
      this.selectedPendingWords.set(new Set());
      this.reseedWords();
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to add words to vocabulary.');
    } finally {
      this.addingWords.update((set) => {
        const updated = new Set(set);
        updated.delete(msgIndex);
        return updated;
      });
    }
  }

  cancelAddWords(): void {
    this.pendingWords.set(null);
    this.pendingMsgIndex.set(null);
    this.selectedPendingWords.set(new Set());
  }

  private clearUnknownWords(msgIndex: number): void {
    this.messages.update((msgs) => {
      const updated = [...msgs];
      const feedback = updated[msgIndex]?.feedback;
      if (feedback) {
        updated[msgIndex] = {
          ...updated[msgIndex],
          feedback: { ...feedback, unknownWords: [] },
        };
      }
      return updated;
    });
  }

  async playVerbAudio(text: string): Promise<void> {
    if (this.playingAudio() === text) {
      this.playingAudio.set(null);
      return;
    }

    this.playingAudio.set(text);
    try {
      const ttsOptions = {
        model: this.settingsService.ttsModel(),
        voice: this.settingsService.ttsVoice(),
      };
      const cached = await this.ttsCache.getAudio(text, ttsOptions);
      let dataUrl: string;
      if (cached) {
        dataUrl = cached;
      } else {
        dataUrl = await this.aiService.generateSpeech(text, ttsOptions);
        await this.ttsCache.setAudio(text, dataUrl, ttsOptions);
      }
      const audio = new Audio(dataUrl);
      audio.onended = () => this.playingAudio.set(null);
      audio.onerror = () => this.playingAudio.set(null);
      await audio.play();
    } catch {
      this.playingAudio.set(null);
    }
  }

  getMasteryClass(mastery: number): string {
    if (mastery >= 80) return 'mastery-high';
    if (mastery >= 40) return 'mastery-mid';
    return 'mastery-low';
  }

  formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
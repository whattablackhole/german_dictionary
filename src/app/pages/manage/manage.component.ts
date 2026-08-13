import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { WordService } from '../../services/word.service';
import { SettingsService } from '../../services/settings.service';
import { PartOfSpeechService, PartOfSpeechInfo } from '../../services/part-of-speech.service';
import { AiService, AiSuggestion } from '../../services/ai.service';
import { Gender, DifficultyLevel, PartOfSpeech, VerbType, PluralFormation, Word } from '../../models/word';

@Component({
  selector: 'app-manage',
  imports: [
    FormsModule,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './manage.component.html',
  styleUrl: './manage.component.scss',
})
export class ManageComponent {
  readonly genders: Gender[] = ['der', 'die', 'das'];
  readonly verbTypes: VerbType[] = ['strong', 'weak', 'mixed'];
  readonly pluralFormations: PluralFormation[] = ['-e', '-en', '-er', '-s', '-n', '-', 'umlaut', 'umlaut + -e', 'umlaut + -er', 'umlaut + -en', 'foreign'];
  readonly levels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  readonly partsOfSpeech: PartOfSpeechInfo[];

  readonly allWords = computed(() => this.wordService.words());

  readonly searchQuery = signal('');
  readonly posFilter = signal<PartOfSpeech | ''>('');
  readonly levelFilter = signal<DifficultyLevel | ''>('');
  readonly genderFilter = signal<Gender | ''>('');

  readonly words = computed(() => {
    let words = this.allWords();
    const search = this.searchQuery().toLowerCase().trim();
    const pos = this.posFilter();
    const level = this.levelFilter();
    const gender = this.genderFilter();

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
    if (gender) {
      words = words.filter((w) => w.gender === gender);
    }
    return words;
  });

  readonly editingId = signal<string | null>(null);
  readonly germanInput = signal('');
  readonly partOfSpeechInput = signal<PartOfSpeech>('noun');
  readonly genderInput = signal<Gender | null>('der');
  readonly translationEnInput = signal('');
  readonly translationRuInput = signal('');
  readonly levelInput = signal<DifficultyLevel>('A1');
  // Verb-specific fields
  readonly verbTypeInput = signal<VerbType>('weak');
  readonly presentThirdPersonInput = signal('');
  readonly simplePastInput = signal('');
  readonly pastParticipleInput = signal('');
  // Noun-specific fields
  readonly pluralFormInput = signal('');
  readonly pluralFormationInput = signal<PluralFormation | ''>('');

  // Expanded row in word list
  readonly expandedRowId = signal<string | null>(null);

  readonly isNoun = computed(() => this.partOfSpeechInput() === 'noun');
  readonly isVerb = computed(() => this.partOfSpeechInput() === 'verb');

  readonly apiKeyInput = signal('');
  readonly apiKeySaved = signal(false);

  readonly aiLoading = signal(false);
  readonly aiError = signal('');
  readonly suggestion = signal<AiSuggestion | null>(null);

  constructor(
    private readonly wordService: WordService,
    private readonly settingsService: SettingsService,
    private readonly posService: PartOfSpeechService,
    private readonly aiService: AiService
  ) {
    this.partsOfSpeech = this.posService.getAll();
    this.apiKeyInput.set(this.aiService.getApiKey());
    this.apiKeySaved.set(this.aiService.hasApiKey());
  }

  startAdd(): void {
    this.editingId.set(null);
    this.germanInput.set('');
    this.partOfSpeechInput.set('noun');
    this.genderInput.set('der');
    this.translationEnInput.set('');
    this.translationRuInput.set('');
    this.levelInput.set('A1');
    this.verbTypeInput.set('weak');
    this.presentThirdPersonInput.set('');
    this.simplePastInput.set('');
    this.pastParticipleInput.set('');
    this.pluralFormInput.set('');
    this.pluralFormationInput.set('');
    this.clearSuggestion();
  }

  startEdit(word: Word): void {
    this.editingId.set(word.id);
    this.germanInput.set(word.german);
    this.partOfSpeechInput.set(word.partOfSpeech);
    this.genderInput.set(word.gender ?? 'der');
    this.translationEnInput.set(word.translationEn);
    this.translationRuInput.set(word.translationRu);
    this.levelInput.set(word.level);
    this.verbTypeInput.set(word.verbType ?? 'weak');
    this.presentThirdPersonInput.set(word.presentThirdPerson ?? '');
    this.simplePastInput.set(word.simplePast ?? '');
    this.pastParticipleInput.set(word.pastParticiple ?? '');
    this.pluralFormInput.set(word.pluralForm ?? '');
    this.pluralFormationInput.set(word.pluralFormation ?? '');
    this.clearSuggestion();
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.germanInput.set('');
    this.partOfSpeechInput.set('noun');
    this.genderInput.set('der');
    this.translationEnInput.set('');
    this.translationRuInput.set('');
    this.levelInput.set('A1');
    this.verbTypeInput.set('weak');
    this.presentThirdPersonInput.set('');
    this.simplePastInput.set('');
    this.pastParticipleInput.set('');
    this.pluralFormInput.set('');
    this.pluralFormationInput.set('');
    this.clearSuggestion();
  }

  save(): void {
    const german = this.germanInput().trim();
    const translationEn = this.translationEnInput().trim();
    const translationRu = this.translationRuInput().trim();
    if (!german || !translationEn || !translationRu) {
      return;
    }

    const existing = this.editingId()
      ? this.wordService.getWords().find((w) => w.id === this.editingId())
      : undefined;

    const isNoun = this.partOfSpeechInput() === 'noun';

    const isVerb = this.partOfSpeechInput() === 'verb';

    const data = {
      german,
      partOfSpeech: this.partOfSpeechInput(),
      gender: isNoun ? this.genderInput() : null,
      translationEn,
      translationRu,
      level: this.levelInput(),
      mastery: existing?.mastery ?? 0,
      usageCount: existing?.usageCount ?? 0,
      verbType: isVerb ? this.verbTypeInput() : undefined,
      presentThirdPerson: isVerb ? (this.presentThirdPersonInput().trim() || undefined) : undefined,
      simplePast: isVerb ? (this.simplePastInput().trim() || undefined) : undefined,
      pastParticiple: isVerb ? (this.pastParticipleInput().trim() || undefined) : undefined,
      pluralForm: isNoun ? (this.pluralFormInput().trim() || undefined) : undefined,
      pluralFormation: isNoun ? (this.pluralFormationInput() || undefined) : undefined,
    };

    if (this.editingId()) {
      this.wordService.updateWord(this.editingId()!, data);
    } else {
      // Check for duplicate German word (case-insensitive)
      const duplicate = this.wordService
        .getWords()
        .find((w) => w.german.toLowerCase() === german.toLowerCase());
      if (duplicate) {
        const confirmed = window.confirm(
          `The word "${german}" already exists (${duplicate.translationEn}).\n\nClick OK to update the existing entry with the new data.\nClick Cancel to go back and edit.`
        );
        if (confirmed) {
          this.wordService.updateWord(duplicate.id, data);
        } else {
          return; // keep the form open so the user can adjust
        }
      } else {
        this.wordService.addWord(data);
      }
    }

    this.cancelEdit();
  }

  deleteWord(id: string): void {
    this.wordService.deleteWord(id);
    if (this.editingId() === id) {
      this.cancelEdit();
    }
  }

  isEditing(wordId: string): boolean {
    return this.editingId() === wordId;
  }

  saveApiKey(): void {
    this.aiService.setApiKey(this.apiKeyInput());
    this.apiKeySaved.set(this.aiService.hasApiKey());
  }

  async suggestWithAi(): Promise<void> {
    const german = this.germanInput().trim();
    if (!german) {
      return;
    }

    this.clearSuggestion();
    this.aiLoading.set(true);
    this.aiError.set('');

    try {
      const result = await this.aiService.analyzeWord(german);
      this.suggestion.set(result);
    } catch (err) {
      this.aiError.set(
        err instanceof Error ? err.message : 'AI request failed. Try again.'
      );
    } finally {
      this.aiLoading.set(false);
    }
  }

  acceptSuggestion(): void {
    const s = this.suggestion();
    if (!s) {
      return;
    }
    this.partOfSpeechInput.set(s.partOfSpeech);
    this.genderInput.set(s.gender ?? 'der');
    this.translationEnInput.set(s.translationEn);
    this.translationRuInput.set(s.translationRu);
    this.levelInput.set(s.level);
    // Fill verb fields if present
    if (s.verbType) {
      this.verbTypeInput.set(s.verbType);
      this.presentThirdPersonInput.set(s.presentThirdPerson ?? '');
      this.simplePastInput.set(s.simplePast ?? '');
      this.pastParticipleInput.set(s.pastParticiple ?? '');
    }
    // Fill noun fields if present
    if (s.pluralForm) {
      this.pluralFormInput.set(s.pluralForm);
      this.pluralFormationInput.set((s.pluralFormation as PluralFormation) ?? '');
    }
    this.clearSuggestion();
  }

  clearSuggestion(): void {
    this.suggestion.set(null);
    this.aiError.set('');
  }

  getPosLabel(key: PartOfSpeech): string {
    return this.posService.getLabel(key);
  }

  formatDate(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString();
  }

  getVerbTypeLabel(type: VerbType | undefined): string {
    if (!type) return '';
    const labels: Record<VerbType, string> = { strong: 'stark', weak: 'schwach', mixed: 'gemischt' };
    return labels[type];
  }

  toggleExpand(wordId: string): void {
    this.expandedRowId.update((current) => (current === wordId ? null : wordId));
  }

  getTranslation(word: Word): string {
    return this.settingsService.getTranslation(word);
  }
}
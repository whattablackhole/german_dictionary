import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { Gender, DifficultyLevel, PartOfSpeech, Word } from '../../models/word';

@Component({
  selector: 'app-manage',
  imports: [
    FormsModule,
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
  readonly levels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  readonly partsOfSpeech: PartOfSpeechInfo[];

  readonly words = computed(() => this.wordService.words());

  readonly editingId = signal<string | null>(null);
  readonly germanInput = signal('');
  readonly partOfSpeechInput = signal<PartOfSpeech>('noun');
  readonly genderInput = signal<Gender | null>('der');
  readonly translationEnInput = signal('');
  readonly translationRuInput = signal('');
  readonly levelInput = signal<DifficultyLevel>('A1');

  readonly isNoun = computed(() => this.partOfSpeechInput() === 'noun');

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

    const data = {
      german,
      partOfSpeech: this.partOfSpeechInput(),
      gender: isNoun ? this.genderInput() : null,
      translationEn,
      translationRu,
      level: this.levelInput(),
      mastery: existing?.mastery ?? 0,
      usageCount: existing?.usageCount ?? 0,
    };

    if (this.editingId()) {
      this.wordService.updateWord(this.editingId()!, data);
    } else {
      this.wordService.addWord(data);
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

  getTranslation(word: Word): string {
    return this.settingsService.getTranslation(word);
  }
}
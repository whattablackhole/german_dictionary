import { Component, computed, signal, inject, OnInit } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { SettingsService, TtsEngine, TTS_MODELS, LookupModifier, PRESET_IMAGE_STYLES, PRESET_IMAGE_MODELS, PRESET_TEXT_MODELS } from '../../services/settings.service';
import { BackupService } from '../../services/backup.service';
import { WordService } from '../../services/word.service';
import { AiService, TextModelOption } from '../../services/ai.service';
import { ImageCacheService } from '../../services/image-cache.service';
import { ImageGenerationService } from '../../services/image-generation.service';
import { SentenceCacheService } from '../../services/sentence-cache.service';
import { SentenceGenerationService } from '../../services/sentence-generation.service';
import { PluralFormation, TranslationLanguage, Word } from '../../models/word';

@Component({
  selector: 'app-settings',
  imports: [MatRadioModule, MatSlideToggleModule, MatCardModule, MatSelectModule, MatFormFieldModule, MatButtonModule, MatProgressBarModule, MatInputModule, MatAutocompleteModule, MatIconModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly aiService = inject(AiService);

  readonly presetTextModels = PRESET_TEXT_MODELS;
  readonly presetImageStyles = PRESET_IMAGE_STYLES;
  readonly presetImageModels = PRESET_IMAGE_MODELS;
  readonly languages: { key: TranslationLanguage; label: string }[] = [
    { key: 'ru', label: 'Russian' },
    { key: 'en', label: 'English' },
  ];

  readonly ttsModels = TTS_MODELS;

  /** True while fetching models from OpenRouter API */
  readonly modelsLoading = signal(false);

  /** Dynamically fetched text models from OpenRouter API */
  readonly dynamicTextModels = computed<TextModelOption[]>(() => {
    const fetched = this.aiService.availableTextModels();
    if (fetched.length > 0) {
      return fetched;
    }
    return this.presetTextModels;
  });

  /** Search input for the text model autocomplete */
  readonly textModelSearchInput = signal('');

  /** Filter: only free models */
  readonly textModelFreeOnly = signal(false);

  /** Filter: minimum context window size bucket */
  readonly textModelContextFilter = signal<'any' | 'small' | 'medium' | 'large' | 'huge'>('any');

  /** Sort order for the text model list */
  readonly textModelSort = signal<'default' | 'name' | 'context'>('default');

  readonly contextFilterOptions: { key: 'any' | 'small' | 'medium' | 'large' | 'huge'; label: string }[] = [
    { key: 'any', label: 'Any size' },
    { key: 'small', label: '≤ 8K' },
    { key: 'medium', label: '8K–32K' },
    { key: 'large', label: '32K–128K' },
    { key: 'huge', label: '> 128K' },
  ];

  readonly sortOptions: { key: 'default' | 'name' | 'context'; label: string }[] = [
    { key: 'default', label: 'Default (free first)' },
    { key: 'name', label: 'Name A–Z' },
    { key: 'context', label: 'Largest context' },
  ];

  /** Returns true when a model matches the active context size bucket. */
  private matchesContextBucket(
    model: TextModelOption,
    bucket: 'any' | 'small' | 'medium' | 'large' | 'huge'
  ): boolean {
    const c = model.contextLength;
    switch (bucket) {
      case 'small': return c !== undefined && c <= 8_000;
      case 'medium': return c !== undefined && c > 8_000 && c <= 32_000;
      case 'large': return c !== undefined && c > 32_000 && c <= 128_000;
      case 'huge': return c !== undefined && c > 128_000;
      default: return true;
    }
  }

  /** Text models filtered by search query + filters, then sorted. */
  readonly filteredTextModels = computed<TextModelOption[]>(() => {
    const query = this.textModelSearchInput().trim().toLowerCase();
    const freeOnly = this.textModelFreeOnly();
    const bucket = this.textModelContextFilter();
    const sort = this.textModelSort();

    let models = this.dynamicTextModels().filter((m) => {
      if (freeOnly && !m.free) return false;
      if (bucket !== 'any' && !this.matchesContextBucket(m, bucket)) return false;
      if (query) {
        return (
          m.label.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          (m.description ?? '').toLowerCase().includes(query)
        );
      }
      return true;
    });

    if (sort === 'name') {
      models = [...models].sort((a, b) => a.label.localeCompare(b.label));
    } else if (sort === 'context') {
      models = [...models].sort((a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0));
    }
    // 'default' keeps the order from dynamicTextModels (already free-first, by label)

    return models;
  });

  /** Label of the currently selected text model, shown in the autocomplete input. */
  readonly selectedTextModelLabel = computed<string>(() => {
    const current = this.settingsService.textModel();
    const found = this.dynamicTextModels().find((m) => m.id === current);
    return found ? found.label : current;
  });

  /** Available providers for the currently selected text model */
  readonly selectedTextModelProviders = computed<string[]>(() => {
    const current = this.settingsService.textModel();
    const found = this.dynamicTextModels().find((m) => m.id === current);
    return found?.providers ?? [];
  });

  onTextModelSelected(id: string): void {
    this.settingsService.setTextModel(id);
    const found = this.dynamicTextModels().find((m) => m.id === id);
    this.textModelSearchInput.set(found ? found.label : id);
    // Clear provider when model changes
    this.settingsService.setTextModelProvider(null);
  }

  readonly currentModelVoices = computed(() => {
    const model = this.ttsModels.find(
      (m) => m.id === this.settingsService.ttsModel()
    );
    return model?.voices ?? [];
  });

  backupStatus: string | null = null;
  backupError: string | null = null;

  // Plural fix state
  readonly pluralFixRunning = signal(false);
  readonly pluralFixProgress = signal(0);
  readonly pluralFixTotal = signal(0);
  readonly pluralFixStatus = signal<string | null>(null);
  readonly pluralFixError = signal<string | null>(null);

  // Image generation state
  readonly imageGenRunning = signal(false);

  // Sentence generation state
  readonly sentenceGenRunning = signal(false);
  readonly sentenceGenProgress = signal(0);
  readonly sentenceGenTotal = signal(0);
  readonly sentenceGenBatchSize = signal(10);
  readonly sentenceGenStatus = signal<string | null>(null);
  readonly sentenceGenError = signal<string | null>(null);
  readonly imageGenProgress = signal(0);
  readonly imageGenTotal = signal(0);
  readonly imageGenBatchSize = signal(10);
  readonly imageGenStatus = signal<string | null>(null);
  readonly imageGenError = signal<string | null>(null);

  /** Preset LibreTranslate endpoints for autocomplete */
  readonly translationPresets: string[] = [
    'http://localhost:5000/translate',
    'https://translate.argosopentech.com/translate',
  ];

  /** Two-way bound input for the autocomplete field */
  readonly translationApiUrlInput = signal('');

  // API key state
  readonly apiKeyInput = signal('');
  readonly apiKeySaved = signal(false);

  constructor(
    readonly settingsService: SettingsService,
    private readonly backupService: BackupService,
    private readonly wordService: WordService,
    private readonly imageCache: ImageCacheService,
    private readonly imageGen: ImageGenerationService,
    private readonly sentenceCache: SentenceCacheService,
    private readonly sentenceGen: SentenceGenerationService
  ) {
    this.translationApiUrlInput.set(this.settingsService.translationApiUrl());
    this.apiKeyInput.set(this.aiService.getApiKey());
    this.apiKeySaved.set(this.aiService.hasApiKey());
    this.textModelSearchInput.set(this.selectedTextModelLabel());
  }

  saveApiKey(): void {
    this.aiService.setApiKey(this.apiKeyInput());
    this.apiKeySaved.set(this.aiService.hasApiKey());
  }

  ngOnInit(): void {
    // Fetch available text models from OpenRouter when settings page opens
    this.fetchTextModels();
  }

  private async fetchTextModels(): Promise<void> {
    if (!this.aiService.hasApiKey()) {
      return;
    }
    this.modelsLoading.set(true);
    try {
      await this.aiService.fetchAvailableModels();
    } catch (err) {
      console.warn('Failed to fetch text models:', err);
    } finally {
      this.modelsLoading.set(false);
    }
  }

  setImageGenBatchSize(size: number): void {
    this.imageGenBatchSize.set(size);
  }

  async batchGenerateImages(): Promise<void> {
    if (!this.aiService.hasApiKey()) {
      this.imageGenError.set('Set your OpenRouter API key first.');
      return;
    }

    const allWords = this.wordService.getWords();
    const wordsWithoutImage: Word[] = [];

    for (const w of allWords) {
      const has = await this.imageCache.hasImage(w.id);
      if (!has) wordsWithoutImage.push(w);
    }

    if (wordsWithoutImage.length === 0) {
      this.imageGenStatus.set('All words already have images. Nothing to generate.');
      return;
    }

    const batchSize = this.imageGenBatchSize();
    const wordsToProcess = wordsWithoutImage.slice(0, batchSize);

    this.imageGenRunning.set(true);
    this.imageGenProgress.set(0);
    this.imageGenTotal.set(wordsToProcess.length);
    this.imageGenStatus.set(`Generating ${wordsToProcess.length} image(s)...`);
    this.imageGenError.set(null);

    let successCount = 0;
    for (let i = 0; i < wordsToProcess.length; i++) {
      const word = wordsToProcess[i];
      try {
        await this.imageGen.generateImage(word);
        successCount++;
      } catch (err) {
        console.error(`Failed to generate image for "${word.german}":`, err);
      }
      this.imageGenProgress.set(i + 1);
      this.imageGenStatus.set(
        `Generated ${i + 1}/${wordsToProcess.length} images (${successCount} succeeded)...`
      );
    }

    this.imageGenStatus.set(
      `Done! Generated ${successCount}/${wordsToProcess.length} image${successCount === 1 ? '' : 's'}.`
    );
    this.imageGenRunning.set(false);
  }

  setLanguage(language: TranslationLanguage): void {
    this.settingsService.setTranslationLanguage(language);
  }

  toggleShowArticle(show: boolean): void {
    this.settingsService.setShowArticleInPractice(show);
  }

  setTtsEngine(engine: TtsEngine): void {
    this.settingsService.setTtsEngine(engine);
  }

  setTtsModel(model: string): void {
    this.settingsService.setTtsModel(model);
  }

  setTtsVoice(voice: string): void {
    this.settingsService.setTtsVoice(voice);
  }

  setLookupModifier(modifier: LookupModifier): void {
    this.settingsService.setLookupModifierKey(modifier);
  }

  async onExport(): Promise<void> {
    try {
      await this.backupService.exportBackup();
      this.backupStatus = 'Backup file downloaded. Store it somewhere safe.';
      this.backupError = null;
    } catch {
      this.backupError = 'Failed to export backup.';
      this.backupStatus = null;
    }
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const confirmed = window.confirm(
      'This will overwrite all current app data (words, sentences, stories, notes, settings, API key) with the backup contents. Continue?'
    );
    if (!confirmed) {
      input.value = '';
      return;
    }

    this.backupService.importBackup(file).then((result) => {
      if (result.ok) {
        this.backupStatus = 'Data restored successfully. Reloading...';
        this.backupError = null;
        setTimeout(() => window.location.reload(), 1200);
      } else {
        this.backupError = result.error;
        this.backupStatus = null;
      }
      input.value = '';
    });
  }

  async batchGenerateSentences(): Promise<void> {
    if (!this.aiService.hasApiKey()) {
      this.sentenceGenError.set('Set your OpenRouter API key first.');
      return;
    }

    const allWords = this.wordService.getWords();
    const wordsWithoutSentences: Word[] = [];

    for (const w of allWords) {
      const has = await this.sentenceCache.hasSentences(w.id);
      if (!has) wordsWithoutSentences.push(w);
    }

    if (wordsWithoutSentences.length === 0) {
      this.sentenceGenStatus.set('All words already have example sentences. Nothing to generate.');
      return;
    }

    const batchSize = this.sentenceGenBatchSize();
    const wordsToProcess = wordsWithoutSentences.slice(0, batchSize);

    this.sentenceGenRunning.set(true);
    this.sentenceGenProgress.set(0);
    this.sentenceGenTotal.set(wordsToProcess.length);
    this.sentenceGenStatus.set(`Generating sentences for ${wordsToProcess.length} word(s)...`);
    this.sentenceGenError.set(null);

    let successCount = 0;
    for (let i = 0; i < wordsToProcess.length; i++) {
      const word = wordsToProcess[i];
      try {
        await this.sentenceGen.generateSentences(word);
        successCount++;
      } catch (err) {
        console.error(`Failed to generate sentences for "${word.german}":`, err);
      }
      this.sentenceGenProgress.set(i + 1);
      this.sentenceGenStatus.set(
        `Generated ${i + 1}/${wordsToProcess.length} (${successCount} succeeded)...`
      );
    }

    this.sentenceGenStatus.set(
      `Done! Generated sentences for ${successCount}/${wordsToProcess.length} word${successCount === 1 ? '' : 's'}.`
    );
    this.sentenceGenRunning.set(false);
  }

  async fixMissingPlurals(): Promise<void> {
    if (!this.aiService.hasApiKey()) {
      this.pluralFixError.set('Set your OpenRouter API key first (in AI Assistant field).');
      return;
    }

    const allWords = this.wordService.getWords();
    const nounsWithoutPlural = allWords.filter(
      (w) => w.partOfSpeech === 'noun' && (!w.pluralForm || !w.pluralFormation)
    );

    if (nounsWithoutPlural.length === 0) {
      this.pluralFixStatus.set('All nouns already have plural forms. Nothing to fix.');
      return;
    }

    this.pluralFixRunning.set(true);
    this.pluralFixProgress.set(0);
    this.pluralFixTotal.set(nounsWithoutPlural.length);
    this.pluralFixStatus.set(`Fixing plurals for ${nounsWithoutPlural.length} nouns...`);
    this.pluralFixError.set(null);

    try {
      const batchSize = 10;
      let fixedCount = 0;

      for (let i = 0; i < nounsWithoutPlural.length; i += batchSize) {
        const batch = nounsWithoutPlural.slice(i, i + batchSize);
        const germanWords = batch.map((w) => w.german);

        const suggestions = await this.aiService.analyzeWordsBatch(germanWords);

        for (let j = 0; j < batch.length; j++) {
          const word = batch[j];
          const suggestion = suggestions[j];

          const formation = suggestion.pluralFormation as PluralFormation | undefined;
          if (suggestion.pluralForm || formation) {
            this.wordService.updateWord(word.id, {
              ...word,
              pluralForm: suggestion.pluralForm ?? word.pluralForm,
              pluralFormation: formation ?? word.pluralFormation,
            });
            fixedCount++;
          }
        }

        this.pluralFixProgress.set(Math.min(i + batchSize, nounsWithoutPlural.length));
        this.pluralFixStatus.set(
          `Fixed ${fixedCount}/${nounsWithoutPlural.length} nouns...`
        );
      }

      this.pluralFixStatus.set(
        `Done! Fixed plurals for ${fixedCount} noun${fixedCount === 1 ? '' : 's'}.`
      );
    } catch (err) {
      this.pluralFixError.set(
        err instanceof Error ? err.message : 'Failed to fix plurals.'
      );
    } finally {
      this.pluralFixRunning.set(false);
    }
  }
}
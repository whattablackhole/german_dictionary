import { Component, computed, signal, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSliderModule } from '@angular/material/slider';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subscription } from 'rxjs';
import { Story, StoryConfig } from '../../models/story';
import { StoryService } from '../../services/story.service';
import { AiService, AiSuggestion } from '../../services/ai.service';
import { SettingsService, TTS_MODELS } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { TtsCacheService } from '../../services/tts-cache.service';
import { WordService } from '../../services/word.service';
import { DifficultyLevel, PartOfSpeech } from '../../models/word';

interface WordToken {
  text: string;
  start: number;
  end: number;
}

interface PopupPosition {
  x: number;
  y: number;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

@Component({
  selector: 'app-stories',
  imports: [
    FormsModule,
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSliderModule,
    MatChipsModule,
    MatExpansionModule,
    MatSlideToggleModule,
  ],
  templateUrl: './stories.component.html',
  styleUrl: './stories.component.scss',
})
export class StoriesComponent implements OnDestroy {
  readonly levels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
  readonly wordTypes: PartOfSpeech[] = [
    'noun', 'verb', 'adjective', 'adverb', 'pronoun',
    'preposition', 'conjunction', 'interjection', 'numeral', 'phrase',
  ];
  readonly grammarTopicsList: string[] = [
    'Simple present tense', 'Present perfect (Perfekt)', 'Simple past (Präteritum)',
    'Future tense (Futur I)', 'Modal verbs', 'Separable prefix verbs',
    'Reflexive verbs', 'Dative case', 'Accusative case', 'Genitive case',
    'Prepositions with dative', 'Prepositions with accusative', 'Two-way prepositions',
    'Verbs with fixed prepositions', 'Subordinating conjunctions', 'Word order (subordinate clauses)',
    'Relative clauses', 'Comparative and superlative', 'Adjective endings',
    'Negation (nicht/kein)', 'Imperative', 'Passive voice',
  ];
  readonly speeds = PLAYBACK_SPEEDS;

  // Config inputs
  readonly themeInput = signal('');
  readonly levelInput = signal<DifficultyLevel>('A2');
  readonly selectedWordTypes = signal<PartOfSpeech[]>([]);
  readonly selectedGrammarTopics = signal<string[]>([]);
  readonly sentenceCount = signal(10);

  // State
  readonly stories = computed(() => this.storyService.stories());
  readonly selectedStoryId = signal<string | null>(null);
  readonly isGenerating = signal(false);
  readonly isPlaying = signal(false);
  readonly currentCharIndex = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly audioElement = signal<HTMLAudioElement | null>(null);
  readonly resumePosition = signal(0);
  readonly audioDuration = signal(0);
  readonly audioCurrentTime = signal(0);
  readonly playbackSpeed = signal(1);
  readonly isSeeking = signal(false);
  private isIntentionallyStopping = false;


  // Word lookup
  readonly wordLookupEnabled = signal(false);
  readonly selectedLookupWord = signal<string | null>(null);
  readonly wordSuggestion = signal<AiSuggestion | null>(null);
  readonly wordLookupLoading = signal(false);
  readonly popupPosition = signal<PopupPosition>({ x: 0, y: 0 });
  readonly wordAddedFeedback = signal(false);

  // AI classification correction feedback
  readonly correctionHint = signal('');
  readonly correctionLoading = signal(false);
  readonly correctionError = signal('');

  // Multi-word selection via right-click
  readonly contextMenuVisible = signal(false);
  readonly contextMenuPosition = signal<PopupPosition>({ x: 0, y: 0 });
  readonly contextMenuText = signal('');
  readonly phraseSuggestion = signal<AiSuggestion | null>(null);
  readonly phraseAddedFeedback = signal(false);
  readonly phraseLookupLoading = signal(false);
  readonly phraseLookupError = signal('');
  readonly phrasePopupPosition = signal<PopupPosition>({ x: 0, y: 0 });
  readonly phrasePopupVisible = signal(false);
  readonly phraseLookupWord = signal<string | null>(null);

  // Computed
  readonly selectedStory = computed(() => {
    const id = this.selectedStoryId();
    return id ? this.storyService.getStoryById(id) ?? null : null;
  });

  readonly wordTokens = computed<WordToken[]>(() => {
    const story = this.selectedStory();
    if (!story) return [];
    return this.tokenize(story.german);
  });

  /** Extra per-word padding (in "weight units") to slow down word transitions.
   *  Each word gets this much extra weight on top of its character length,
   *  which gives short words (ich, und, der) proportionally more time.
   *  Higher = slower transitions between words. */
  private readonly WORD_PADDING = 10;

  /** Extra pause after a sentence-ending period in seconds (real time, not a weight). */
  private readonly SENTENCE_PAUSE = 1;

  /**
   * Builds a cumulative time map for each word token using character-length
   * weighting with per-word padding. Longer words take proportionally more time
   * to speak, and every word gets a base padding so short words don't fly by.
   * After words ending with a period, an extra SENTENCE_PAUSE is added in real seconds.
   * The total duration is scaled to match the actual audio duration.
   */
  readonly wordTimeMap = computed<{ wordIndex: number; startTime: number; endTime: number }[]>(() => {
    const tokens = this.wordTokens();
    const duration = this.audioDuration();
    if (tokens.length === 0 || duration <= 0) return [];

    // Calculate total weight (character length + padding per word)
    const totalWeight = tokens.reduce((sum, t) => sum + t.text.length + this.WORD_PADDING, 0);
    if (totalWeight === 0) return [];

    // Calculate total sentence pause time
    const totalSentencePause = tokens.filter(t => t.text.endsWith('.')).length * this.SENTENCE_PAUSE;

    // Available time for word-weighted distribution (audio duration minus sentence pauses)
    const availableTime = duration - totalSentencePause;
    if (availableTime <= 0) return [];

    const map: { wordIndex: number; startTime: number; endTime: number }[] = [];
    let accumulated = 0;
    for (let i = 0; i < tokens.length; i++) {
      const weight = tokens[i].text.length + this.WORD_PADDING;
      const startTime = (accumulated / totalWeight) * availableTime;
      accumulated += weight;
      const endTime = (accumulated / totalWeight) * availableTime;
      map.push({ wordIndex: i, startTime, endTime });
    }

    // Add sentence pauses after period-ending words by shifting subsequent words
    let pauseOffset = 0;
    for (let i = 0; i < tokens.length; i++) {
      map[i] = {
        wordIndex: i,
        startTime: map[i].startTime + pauseOffset,
        endTime: map[i].endTime + pauseOffset,
      };
      if (tokens[i].text.endsWith('.')) {
        pauseOffset += this.SENTENCE_PAUSE;
      }
    }

    return map;
  });

  readonly highlightedGerman = computed(() => {
    const tokens = this.wordTokens();
    const currentIdx = this.currentCharIndex();
    if (currentIdx === null) {
      return tokens.map((t) => t.text).join('');
    }
    return tokens
      .map((t) => {
        const isHighlighted = currentIdx >= t.start && currentIdx < t.end;
        return isHighlighted ? `<mark class="word-highlight">${t.text}</mark>` : t.text;
      })
      .join('');
  });

  readonly lookupTranslation = computed(() => {
    const s = this.wordSuggestion();
    if (!s) return '';
    return this.settingsService.getTranslation({
      translationEn: s.translationEn,
      translationRu: s.translationRu,
    } as any);
  });

  lookupGenderArticle(): string {
    const s = this.wordSuggestion();
    if (!s || s.partOfSpeech !== 'noun' || !s.gender) return '';
    return s.gender + ' ';
  }

  readonly isWordAlreadyInDictionary = computed(() => {
    const word = this.selectedLookupWord();
    const suggestion = this.wordSuggestion();
    if (!word) return false;
    // Check both the clicked word and the infinitive (for verbs)
    const checkWords = [word.toLowerCase()];
    if (suggestion?.infinitive) {
      checkWords.push(suggestion.infinitive.toLowerCase());
    }
    return this.wordService.getWords().some(
      (w) => checkWords.includes(w.german.toLowerCase())
    );
  });

  formattedCurrentTime(): string {
    return this.formatTime(this.audioCurrentTime());
  }
  formattedDuration(): string {
    return this.formatTime(this.audioDuration());
  }

  readonly isMicrosoftTts = computed(() => this.settingsService.ttsEngine() === 'openai');

  readonly hasResumePosition = computed(() => this.resumePosition() > 0);

  private boundarySub: Subscription | null = null;
  private endSub: Subscription | null = null;

  constructor(
    private readonly storyService: StoryService,
    private readonly aiService: AiService,
    readonly settingsService: SettingsService,
    private readonly speechService: SpeechService,
    private readonly wordService: WordService,
    private readonly ttsCacheService: TtsCacheService
  ) {
    this.boundarySub = this.speechService.onBoundary.subscribe((b) => {
      this.currentCharIndex.set(b.charIndex);
    });
    this.endSub = this.speechService.onEnd.subscribe(() => {
      this.isPlaying.set(false);
      this.currentCharIndex.set(null);
    });
  }

  ngOnDestroy(): void {
    this.boundarySub?.unsubscribe();
    this.endSub?.unsubscribe();
    this.stopPlayback();
  }

  toggleWordType(type: PartOfSpeech): void {
    this.selectedWordTypes.update((list) =>
      list.includes(type) ? list.filter((t) => t !== type) : [...list, type]
    );
  }

  toggleGrammarTopic(topic: string): void {
    this.selectedGrammarTopics.update((list) =>
      list.includes(topic) ? list.filter((t) => t !== topic) : [...list, topic]
    );
  }

  onSentenceCountChange(value: string): void {
    this.sentenceCount.set(Number(value));
  }

  async generateStory(): Promise<void> {
    if (!this.themeInput().trim()) return;

    this.isGenerating.set(true);
    this.errorMessage.set('');
    this.selectedStoryId.set(null);

    try {
      const config: StoryConfig = {
        theme: this.themeInput().trim(),
        level: this.levelInput(),
        wordTypes: this.selectedWordTypes(),
        grammarTopics: this.selectedGrammarTopics(),
        sentenceCount: this.sentenceCount(),
      };

      const result = await this.aiService.generateStory(config);

      const wordCount = result.german.split(/\s+/).filter(Boolean).length;

      const story = this.storyService.addStory({
        title: result.title,
        german: result.german,
        translationEn: result.translationEn,
        translationRu: result.translationRu,
        level: config.level,
        domain: config.theme,
        grammarTopics: config.grammarTopics,
        wordCount,
      });

      this.selectedStoryId.set(story.id);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Failed to generate story.'
      );
    } finally {
      this.isGenerating.set(false);
    }
  }

  selectStory(id: string): void {
    this.stopPlayback();
    this.selectedStoryId.set(id);
    this.currentCharIndex.set(null);
    this.resumePosition.set(0);
    this.audioDuration.set(0);
    this.audioCurrentTime.set(0);
    this.closeWordPopup();
  }

  async playStory(): Promise<void> {
    const story = this.selectedStory();
    if (!story) return;

    const engine = this.settingsService.ttsEngine();

    if (engine === 'openai') {
      await this.playWithOpenAI(story);
    } else {
      this.playWithBrowser(story);
    }
  }

  private playWithBrowser(story: Story): void {
    this.isPlaying.set(true);
    this.currentCharIndex.set(0);
    this.speechService.speak(story.german);
  }

  private async playWithOpenAI(story: Story): Promise<void> {
    this.isPlaying.set(true);

    const ttsOptions = {
      model: this.settingsService.ttsModel(),
      voice: this.settingsService.ttsVoice(),
    };

    try {
      // Try the IndexedDB cache first, then the legacy in-memory audioUrl,
      // then generate fresh audio via the API.
      let audioUrl = await this.ttsCacheService.getAudio(story.german, ttsOptions);

      if (!audioUrl && story.audioUrl) {
        // Legacy path: audioUrl was previously embedded in the story object
        // (persisted in localStorage before the IndexedDB migration).
        audioUrl = story.audioUrl;
      }

      if (!audioUrl) {
        const model = TTS_MODELS.find((m) => m.id === ttsOptions.model);
        const defaultVoice = model?.voices[0]?.id;

        try {
          audioUrl = await this.aiService.generateSpeech(story.german, ttsOptions);
        } catch (err) {
          if (defaultVoice && defaultVoice !== ttsOptions.voice) {
            // A provider error (e.g. 502) often means the selected voice is
            // unavailable for this model. Fall back to the model's default.
            audioUrl = await this.aiService.generateSpeech(story.german, {
              ...ttsOptions,
              voice: defaultVoice,
            });
            this.errorMessage.set(
              `The voice "${ttsOptions.voice}" is unavailable for ${ttsOptions.model}. Using "${defaultVoice}" instead.`
            );
          } else {
            throw err;
          }
        }

        // Cache under the selected voice key so subsequent plays are instant,
        // even when the fallback voice was used.
        await this.ttsCacheService.setAudio(story.german, audioUrl, ttsOptions);
      }

      const audio = new Audio(audioUrl);
      audio.playbackRate = this.playbackSpeed();
      this.audioElement.set(audio);

      // If resuming, seek to saved position
      const resumePos = this.resumePosition();
      if (resumePos > 0) {
        // We need metadata first to seek
        audio.addEventListener('loadedmetadata', () => {
          audio.currentTime = resumePos;
          this.updateCharIndexFromTime(resumePos);
        }, { once: true });
      } else {
        this.currentCharIndex.set(0);
      }

      audio.addEventListener('loadedmetadata', () => {
        this.audioDuration.set(audio.duration);
      }, { once: true });

      audio.addEventListener('timeupdate', () => {
        if (this.isSeeking()) return;
        this.audioCurrentTime.set(audio.currentTime);
        if (audio.duration) {
          // Use linear time map to find which word should be highlighted
          const timeMap = this.wordTimeMap();
          const currentTime = audio.currentTime;
          for (let i = 0; i < timeMap.length; i++) {
            if (currentTime >= timeMap[i].startTime && currentTime < timeMap[i].endTime) {
              const tokens = this.wordTokens();
              const token = tokens[timeMap[i].wordIndex];
              if (token) {
                this.currentCharIndex.set(token.start);
              }
              break;
            }
          }
        }
      });

      audio.addEventListener('ended', () => {
        this.isPlaying.set(false);
        this.currentCharIndex.set(null);
        this.audioElement.set(null);
        this.resumePosition.set(0);
        this.audioCurrentTime.set(0);
      });

      audio.addEventListener('error', () => {
        if (this.isIntentionallyStopping) return;
        this.isPlaying.set(false);
        this.currentCharIndex.set(null);
        this.audioElement.set(null);
        this.errorMessage.set('Audio playback failed. Try browser TTS instead.');
      });

      await audio.play();
    } catch (err) {
      this.isPlaying.set(false);
      this.currentCharIndex.set(null);
      this.errorMessage.set(
        err instanceof Error ? err.message : 'TTS playback failed.'
      );
    }
  }

  pausePlayback(): void {
    const audio = this.audioElement();
    if (audio) {
      this.resumePosition.set(audio.currentTime);
      audio.pause();
    }
    this.isPlaying.set(false);
  }

  stopPlayback(): void {
    this.speechService.stop();
    const audio = this.audioElement();
    if (audio) {
      this.isIntentionallyStopping = true;
      audio.pause();
      audio.src = '';
      audio.load();
      this.audioElement.set(null);
      // Reset the flag after a microtask so the error handler won't fire
      setTimeout(() => { this.isIntentionallyStopping = false; });
    }
    this.isPlaying.set(false);
    this.currentCharIndex.set(null);
    this.resumePosition.set(0);
    this.audioCurrentTime.set(0);
    // Keep audioDuration so the controls remain visible
  }

  onSeekStart(): void {
    this.isSeeking.set(true);
  }

  onSeekEnd(value: string): void {
    this.isSeeking.set(false);
    const audio = this.audioElement();
    if (!audio || !audio.duration) return;

    const seekTime = (Number(value) / 100) * audio.duration;
    audio.currentTime = seekTime;
    this.audioCurrentTime.set(seekTime);

    // Update char index using word-weighted time map
    this.updateCharIndexFromTime(seekTime);
  }

  /** Updates currentCharIndex based on the word-weighted time map for a given time position. */
  private updateCharIndexFromTime(time: number): void {
    const timeMap = this.wordTimeMap();
    for (let i = 0; i < timeMap.length; i++) {
      if (time >= timeMap[i].startTime && time < timeMap[i].endTime) {
        const tokens = this.wordTokens();
        const token = tokens[timeMap[i].wordIndex];
        if (token) {
          this.currentCharIndex.set(token.start);
        }
        return;
      }
    }
    // If past the last word, highlight the last word
    if (timeMap.length > 0) {
      const lastEntry = timeMap[timeMap.length - 1];
      const tokens = this.wordTokens();
      const token = tokens[lastEntry.wordIndex];
      if (token) {
        this.currentCharIndex.set(token.start);
      }
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed.set(speed);
    const audio = this.audioElement();
    if (audio) {
      audio.playbackRate = speed;
    }
  }

  async deleteStory(id: string): Promise<void> {
    const story = this.storyService.getStoryById(id);
    this.storyService.deleteStory(id);
    if (story) {
      // Evict cached TTS audio so we don't leave orphaned blobs in IndexedDB.
      await this.ttsCacheService.deleteAudio(story.german, {
        model: this.settingsService.ttsModel(),
        voice: this.settingsService.ttsVoice(),
      });
    }
    if (this.selectedStoryId() === id) {
      this.selectedStoryId.set(null);
    }
  }

  // Word lookup methods

  /** Set of selected word token indices for multi-word selection. */
  readonly selectedWordIndices = signal<Set<number>>(new Set());

  /** Returns true if the required modifier key is held during the event. */
  private isModifierHeld(event: MouseEvent): boolean {
    const mod = this.settingsService.lookupModifierKey();
    switch (mod) {
      case 'alt': return event.altKey;
      case 'ctrl': return event.ctrlKey;
      case 'meta': return event.metaKey;
      case 'shift': return event.shiftKey;
      default: return false;
    }
  }

  isWordSelected(index: number): boolean {
    return this.selectedWordIndices().has(index);
  }

  onWordClick(word: string, index: number, event: MouseEvent): void {
    if (!this.wordLookupEnabled()) return;

    const cleanWord = word.replace(/[.,!?;:()"']+$/, '').replace(/^[.,!?;:()"']+/, '');
    if (!cleanWord) return;

    // If modifier key is held → trigger lookup for all selected words
    if (this.isModifierHeld(event)) {
      // Add this word's index to selection if not already there
      this.selectedWordIndices.update((s) => {
        const next = new Set(s);
        next.add(index);
        return next;
      });

      // Build phrase from selected tokens in order
      const tokens = this.wordTokens();
      const selected = Array.from(this.selectedWordIndices()).sort((a, b) => a - b);
      if (selected.length === 0) return;

      const phrase = selected
        .map((i) => tokens[i].text.replace(/[.,!?;:()"']+$/, '').replace(/^[.,!?;:()"']+/, ''))
        .filter(Boolean)
        .join(' ');

      this.selectedLookupWord.set(phrase);
      this.popupPosition.set({ x: event.clientX, y: event.clientY });
      this.wordSuggestion.set(null);
      this.wordAddedFeedback.set(false);

      // Check if already in dictionary
      const existing = this.wordService.getWords().find(
        (w) => w.german.toLowerCase() === phrase.toLowerCase()
      );
      if (existing) {
        this.wordSuggestion.set({
          translationEn: existing.translationEn,
          translationRu: existing.translationRu,
          partOfSpeech: existing.partOfSpeech,
          gender: existing.gender,
          level: existing.level,
          verbType: existing.verbType,
          presentThirdPerson: existing.presentThirdPerson,
          simplePast: existing.simplePast,
          pastParticiple: existing.pastParticiple,
        });
        return;
      }

      // Call AI to analyze the phrase
      this.wordLookupLoading.set(true);
      this.aiService.analyzeWord(phrase).then((suggestion) => {
        this.wordSuggestion.set(suggestion);
        this.wordLookupLoading.set(false);
      }).catch(() => {
        this.wordLookupLoading.set(false);
      });
      return;
    }

    // Plain left-click → toggle word selection by index
    this.selectedWordIndices.update((s) => {
      const next = new Set(s);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  playLookupWord(): void {
    const word = this.selectedLookupWord();
    if (!word) return;
    this.speechService.speak(word);
  }

  addLookupWordToDictionary(): void {
    const word = this.selectedLookupWord();
    const suggestion = this.wordSuggestion();
    if (!word || !suggestion) return;

    const isNoun = suggestion.partOfSpeech === 'noun';
    const isVerb = suggestion.partOfSpeech === 'verb';

    // Use infinitive for verbs if available, otherwise use the clicked word
    const dictionaryWord = isVerb && suggestion.infinitive ? suggestion.infinitive : word;

    this.wordService.addWord({
      german: dictionaryWord,
      partOfSpeech: suggestion.partOfSpeech,
      gender: isNoun ? suggestion.gender : null,
      translationEn: suggestion.translationEn,
      translationRu: suggestion.translationRu,
      level: suggestion.level,
      mastery: 0,
      usageCount: 0,
      verbType: isVerb ? suggestion.verbType : undefined,
      presentThirdPerson: isVerb ? suggestion.presentThirdPerson : undefined,
      simplePast: isVerb ? suggestion.simplePast : undefined,
      pastParticiple: isVerb ? suggestion.pastParticiple : undefined,
    });

    this.wordAddedFeedback.set(true);
    setTimeout(() => this.wordAddedFeedback.set(false), 2000);
  }

  /** Re-run the AI analysis with a user-provided hint to correct the classification. */
  async reanalyzeWithHint(): Promise<void> {
    const word = this.selectedLookupWord();
    const hint = this.correctionHint().trim();
    if (!word || !hint) return;

    this.correctionLoading.set(true);
    this.correctionError.set('');

    try {
      const suggestion = await this.aiService.reanalyzeWord(word, hint);
      this.wordSuggestion.set(suggestion);
      this.correctionHint.set('');
    } catch (err) {
      this.correctionError.set(
        err instanceof Error ? err.message : 'Re-analysis failed.'
      );
    } finally {
      this.correctionLoading.set(false);
    }
  }

  closeWordPopup(): void {
    this.selectedLookupWord.set(null);
    this.wordSuggestion.set(null);
    this.wordLookupLoading.set(false);
    this.wordAddedFeedback.set(false);
    this.correctionHint.set('');
    this.correctionLoading.set(false);
    this.correctionError.set('');
  }

  // ── Right-click context menu for multi-word selection ──

  onContextMenu(event: MouseEvent): void {
    if (!this.wordLookupEnabled()) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText || selectedText.length === 0) return;

    event.preventDefault();
    this.closeWordPopup();
    this.closePhrasePopup();

    this.contextMenuText.set(selectedText);
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.contextMenuVisible.set(true);
  }

  /** Handles right-click on a single word span — triggers lookup directly. */
  onWordRightClick(word: string, event: MouseEvent): void {
    if (!this.wordLookupEnabled()) return;
    event.preventDefault();

    // Select this word so the user sees what's being looked up
    const selection = window.getSelection();
    if (selection) {
      selection.selectAllChildren(event.currentTarget as Node);
    }

    this.contextMenuText.set(word);
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.closeWordPopup();
    this.closePhrasePopup();
    this.contextMenuVisible.set(true);
  }

  closeContextMenu(): void {
    this.contextMenuVisible.set(false);
  }

  async lookupPhrase(): Promise<void> {
    const phrase = this.contextMenuText();
    if (!phrase) return;

    this.closeContextMenu();
    this.phraseLookupLoading.set(true);
    this.phraseLookupError.set('');
    this.phraseSuggestion.set(null);
    this.phraseAddedFeedback.set(false);

    try {
      const suggestion = await this.aiService.analyzeWord(phrase);
      this.phraseSuggestion.set(suggestion);
      this.phraseLookupWord.set(phrase);
      this.phrasePopupPosition.set({
        x: this.contextMenuPosition().x,
        y: this.contextMenuPosition().y,
      });
      this.phrasePopupVisible.set(true);
    } catch (err) {
      this.phraseLookupError.set(
        err instanceof Error ? err.message : 'Lookup failed.'
      );
    } finally {
      this.phraseLookupLoading.set(false);
    }
  }

  addPhraseToDictionary(): void {
    const phrase = this.phraseLookupWord();
    const suggestion = this.phraseSuggestion();
    if (!phrase || !suggestion) return;

    this.wordService.addWord({
      german: phrase,
      partOfSpeech: suggestion.partOfSpeech,
      gender: suggestion.partOfSpeech === 'noun' ? suggestion.gender : null,
      translationEn: suggestion.translationEn,
      translationRu: suggestion.translationRu,
      level: suggestion.level,
      mastery: 0,
      usageCount: 0,
      verbType: suggestion.verbType,
      presentThirdPerson: suggestion.presentThirdPerson,
      simplePast: suggestion.simplePast,
      pastParticiple: suggestion.pastParticiple,
    });

    this.phraseAddedFeedback.set(true);
    setTimeout(() => this.phraseAddedFeedback.set(false), 2000);
  }

  playPhraseWord(): void {
    const word = this.phraseLookupWord();
    if (!word) return;
    this.speechService.speak(word);
  }

  closePhrasePopup(): void {
    this.phrasePopupVisible.set(false);
    this.phraseLookupWord.set(null);
    this.phraseSuggestion.set(null);
    this.phraseLookupLoading.set(false);
    this.phraseLookupError.set('');
    this.phraseAddedFeedback.set(false);
  }

  /** Helper for template — gets the translation for a phrase suggestion. */
  phraseTranslation(): string {
    const s = this.phraseSuggestion();
    if (!s) return '';
    return this.settingsService.getTranslation({
      translationEn: s.translationEn,
      translationRu: s.translationRu,
    } as any);
  }

  private formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  private tokenize(text: string): WordToken[] {
    const tokens: WordToken[] = [];
    const regex = /[^\s]+/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      tokens.push({
        text: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return tokens;
  }
}
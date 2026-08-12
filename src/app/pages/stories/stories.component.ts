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
import { SettingsService } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
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
    private readonly wordService: WordService
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

    try {
      // Try to use cached audio
      let audioUrl = story.audioUrl;

      if (!audioUrl) {
        audioUrl = await this.aiService.generateSpeechOpenAI(story.german);
        this.storyService.updateAudioUrl(story.id, audioUrl);
      }

      const audio = new Audio(audioUrl);
      audio.playbackRate = this.playbackSpeed();
      this.audioElement.set(audio);

      const totalChars = story.german.length;

      // If resuming, seek to saved position
      const resumePos = this.resumePosition();
      if (resumePos > 0) {
        // We need metadata first to seek
        audio.addEventListener('loadedmetadata', () => {
          audio.currentTime = resumePos;
          const progress = resumePos / audio.duration;
          this.currentCharIndex.set(Math.floor(progress * totalChars));
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
          const progress = audio.currentTime / audio.duration;
          const charIndex = Math.floor(progress * totalChars);
          this.currentCharIndex.set(charIndex);
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

    // Update char index
    const story = this.selectedStory();
    if (story) {
      const progress = seekTime / audio.duration;
      this.currentCharIndex.set(Math.floor(progress * story.german.length));
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.playbackSpeed.set(speed);
    const audio = this.audioElement();
    if (audio) {
      audio.playbackRate = speed;
    }
  }

  deleteStory(id: string): void {
    this.storyService.deleteStory(id);
    if (this.selectedStoryId() === id) {
      this.selectedStoryId.set(null);
    }
  }

  // Word lookup methods

  onWordClick(word: string, event: MouseEvent): void {
    if (!this.wordLookupEnabled()) return;

    // Clean the word: remove trailing punctuation
    const cleanWord = word.replace(/[.,!?;:()"']+$/, '').replace(/^[.,!?;:()"']+/, '');
    if (!cleanWord) return;

    this.selectedLookupWord.set(cleanWord);
    this.popupPosition.set({ x: event.clientX, y: event.clientY });
    this.wordSuggestion.set(null);
    this.wordAddedFeedback.set(false);

    // Check if already in dictionary
    const existing = this.wordService.getWords().find(
      (w) => w.german.toLowerCase() === cleanWord.toLowerCase()
    );
    if (existing) {
      // Show existing word info without AI call
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

    // Call AI to analyze the word
    this.wordLookupLoading.set(true);
    this.aiService.analyzeWord(cleanWord).then((suggestion) => {
      this.wordSuggestion.set(suggestion);
      this.wordLookupLoading.set(false);
    }).catch(() => {
      this.wordLookupLoading.set(false);
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

  closeWordPopup(): void {
    this.selectedLookupWord.set(null);
    this.wordSuggestion.set(null);
    this.wordLookupLoading.set(false);
    this.wordAddedFeedback.set(false);
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
import { Component, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
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
import { StoryExercise } from '../../models/story-exercise';
import { StoryService } from '../../services/story.service';
import { AiService, AiSuggestion, GeneratedStoryExercise } from '../../services/ai.service';
import { StoryExerciseService } from '../../services/story-exercise.service';
import { SettingsService, TTS_MODELS } from '../../services/settings.service';
import { SpeechService } from '../../services/speech.service';
import { TtsCacheService } from '../../services/tts-cache.service';
import { WordService } from '../../services/word.service';
import { DifficultyLevel, PartOfSpeech } from '../../models/word';
import { GrammarNotesService } from '../../services/grammar-notes.service';
import { SentenceNotesService } from '../../services/sentence-notes.service';
import { StoryExerciseHistoryService } from '../../services/story-exercise-history.service';
import { StoryExerciseHistoryEntry } from '../../models/story-exercise-history';
import { StoryQuestion } from '../../models/story-question';
import { StoryQuestionHistoryEntry } from '../../models/story-question-history';
import { StoryQuestionService } from '../../services/story-question.service';
import { StoryQuestionHistoryService } from '../../services/story-question-history.service';
import { toStoryExercise as toStoryExerciseShared } from '../../services/story-exercise-builder';

interface WordToken {
  text: string;
  start: number;
  end: number;
}

interface SentenceToken {
  text: string;
  start: number;
  end: number;
  wordIndices: number[];
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
export class StoriesComponent implements OnInit, OnDestroy {
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
    'Receptive modal particles (doch/ja/denn)', 'Infinitives with/without zu', 'Verb + infinitive',
    'Participle clauses', 'Subjunctive II (Konjunktiv II)', 'Subjunctive I (Konjunktiv I)',
    'Conditional sentences (wenn/würde)', 'Nouns with dative/accusative verbs (sie/ihn)',
    'Possessive pronouns (mein/dein/sein)', 'Demonstrative pronouns (dieser/jener)',
    'Interrogative pronouns (wer/was/welch)',
    'Nominative case', 'Possessive articles', 'Noun plural forms',
    'Compound nouns', 'Compound verbs', 'Cognates',
    'Word formation (prefixes/suffixes)', 'Diminuitive (chen/lein)',
    'Adjectival nouns', 'Adverbs of time/manner/place', 'Prepositional adverbs (dafür/damit)',
    'Interrogative particles (denn/nur/etwa)', 'Collocations', 'Idioms and expressions',
    'Intensifiers and degree adverbs', 'Colloquial structures', 'Formal writing structures',
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

  // Vocabulary exercise word selection
  readonly exerciseSelectionMode = signal(false);
  /** Ordered list of selected word groups. Each group is an ordered array of token indices
   *  (single words = length 1; Ctrl+click groups contiguous words into one unit, e.g. "mache an"). */
  readonly exerciseSelectedGroups = signal<number[][]>([]);
  readonly exerciseGenerating = signal(false);
  readonly exerciseError = signal('');

  // Story Questions (active recall) mode
  readonly storyQuestionsGenerating = signal(false);
  readonly storyQuestionsError = signal('');

  /** Ordered list of German word units selected for exercises (groups joined with a space). */
  readonly selectedExerciseWords = computed<string[]>(() => {
    const tokens = this.wordTokens();
    return this.exerciseSelectedGroups()
      .map((g) =>
        g
          .map((i) => tokens[i] ? this.cleanWordToken(tokens[i].text) : '')
          .filter((w) => w.length > 0)
          .join(' ')
      )
      .filter((w) => w.length > 0);
  });

  /** Number of exercises shown on the Generate button.
   *  Toggle OFF: words × 3 (mc + cloze + sentence).
   *  Toggle ON: no count — the AI determines how many form exercises each word gets,
   *  so any exact number could be wrong. */
  readonly exerciseGenerationCount = computed(() => {
    if (!this.settingsService.storyOnlyMcExercises()) {
      return this.selectedExerciseWords().length * 3;
    }
    return null;
  });

  // Sentence Notes Mode
  readonly sentenceNotesMode = signal(false);
  readonly selectedSentenceIndex = signal<number | null>(null);
  readonly sentenceNotePopupVisible = signal(false);
  readonly sentenceNotePopupPosition = signal<PopupPosition>({ x: 0, y: 0 });
  readonly sentenceNoteText = signal('');
  readonly sentenceNoteLoading = signal(false);
  readonly sentenceNoteError = signal('');

  readonly sentenceTokens = computed<SentenceToken[]>(() => {
    const story = this.selectedStory();
    if (!story) return [];

    const text = story.german;
    const tokens: SentenceToken[] = [];
    // Split by sentence-ending punctuation followed by space or end of string
    const regex = /[^.!?]+[.!?]+(?:\s+|$)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const sentenceText = match[0].trim();
      if (sentenceText.length === 0) continue;

      // Find which word tokens belong to this sentence
      const wordTokens = this.wordTokens();
      const wordIndices: number[] = [];
      for (let i = 0; i < wordTokens.length; i++) {
        const wt = wordTokens[i];
        if (wt.start >= match.index && wt.end <= match.index + match[0].length) {
          wordIndices.push(i);
        }
      }

      tokens.push({
        text: sentenceText,
        start: match.index,
        end: match.index + match[0].length,
        wordIndices,
      });
    }
    return tokens;
  });

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

  lookupDisplayWord(): string {
    const word = this.selectedLookupWord();
    const s = this.wordSuggestion();
    if (!word) return '';
    // For verbs, show the infinitive (if available) with the original word in parentheses
    if (s?.partOfSpeech === 'verb' && s.infinitive && s.infinitive !== word) {
      return `${s.infinitive} (${word})`;
    }
    // For nouns, show the base form (singular) with the original word in parentheses.
    // The article is already prefixed via lookupGenderArticle() in the template.
    if (s?.partOfSpeech === 'noun' && s.baseForm && s.baseForm !== word) {
      return `${s.baseForm} (${word})`;
    }
    // For any other part of speech (e.g. pronoun, adjective), show the base form if it differs
    if (s?.baseForm && s.baseForm !== word) {
      return `${s.baseForm} (${word})`;
    }
    return word;
  }

  /** Returns the German word form for a numeric string like "1949" or null if not a number. */
  numberSpokenForm(): string | null {
    const word = this.selectedLookupWord();
    if (!word) return null;
    const n = Number(word.replace(/[.,\s]/g, ''));
    if (!Number.isFinite(n) || n < 0 || n > 999999999 || !/^[\d.,\s]+$/.test(word)) {
      return null;
    }
    return this.numberToGermanWords(n);
  }

  private numberToGermanWords(n: number): string {
    if (n === 0) return 'null';

    const ones = ['', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];
    const teens = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
    const tens = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

    function threeDigits(num: number): string {
      const parts: string[] = [];
      const h = Math.floor(num / 100);
      const rest = num % 100;
      if (h > 0) {
        parts.push(ones[h] + 'hundert');
      }
      if (rest > 0) {
        if (rest < 10) {
          parts.push(rest === 1 && num >= 100 ? 'eins' : ones[rest]);
        } else if (rest < 20) {
          parts.push(teens[rest - 10]);
        } else {
          const t = Math.floor(rest / 10);
          const o = rest % 10;
          if (o === 1) parts.push('einund' + tens[t]);
          else if (o > 0) parts.push(ones[o] + 'und' + tens[t]);
          else parts.push(tens[t]);
        }
      }
      return parts.join('');
    }

    const milliarden = Math.floor(n / 1_000_000_000);
    const millionen = Math.floor((n % 1_000_000_000) / 1_000_000);
    const tausender = Math.floor((n % 1_000_000) / 1_000);
    const rest = n % 1_000;

    const parts: string[] = [];
    if (milliarden > 0) {
      parts.push((milliarden === 1 ? 'eine' : threeDigits(milliarden)) + ' Milliarde' + (milliarden > 1 ? 'n' : ''));
    }
    if (millionen > 0) {
      parts.push((millionen === 1 ? 'eine' : threeDigits(millionen)) + ' Million' + (millionen > 1 ? 'en' : ''));
    }
    if (tausender > 0) {
      parts.push((tausender === 1 ? 'eintausend' : threeDigits(tausender) + 'tausend'));
    }
    if (rest > 0) {
      parts.push(threeDigits(rest));
    }
    return parts.join(' ');
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
  private routeSub: Subscription | null = null;

  constructor(
    private readonly storyService: StoryService,
    private readonly aiService: AiService,
    readonly settingsService: SettingsService,
    private readonly speechService: SpeechService,
    private readonly wordService: WordService,
    private readonly ttsCacheService: TtsCacheService,
    private readonly storyExerciseService: StoryExerciseService,
    private readonly grammarNotesService: GrammarNotesService,
    private readonly sentenceNotesService: SentenceNotesService,
    private readonly historyService: StoryExerciseHistoryService,
    private readonly storyQuestionService: StoryQuestionService,
    private readonly questionHistoryService: StoryQuestionHistoryService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.boundarySub = this.speechService.onBoundary.subscribe((b) => {
      this.currentCharIndex.set(b.charIndex);
    });
    this.endSub = this.speechService.onEnd.subscribe(() => {
      this.isPlaying.set(false);
      this.currentCharIndex.set(null);
    });
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('storyId');
      if (id) {
        this.selectStory(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.boundarySub?.unsubscribe();
    this.endSub?.unsubscribe();
    this.routeSub?.unsubscribe();
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

      const story = await this.storyService.addStory({
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
      this.router.navigate([`/stories/${story.id}`], { replaceUrl: true });
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
    this.closeSentenceNotePopup();
    this.exerciseSelectionMode.set(false);
    this.exerciseSelectedGroups.set([]);
    this.exerciseError.set('');
    this.sentenceNotesMode.set(false);
    this.selectedSentenceIndex.set(null);

    // Keep the story id in the route so the story reopens on refresh.
    const targetUrl = `/stories/${id}`;
    if (!this.router.url.startsWith(targetUrl)) {
      this.router.navigate([targetUrl], { replaceUrl: true });
    }
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
    await this.storyService.deleteStory(id);
    if (story) {
      // Evict cached TTS audio so we don't leave orphaned blobs in IndexedDB.
      await this.ttsCacheService.deleteAudio(story.german, {
        model: this.settingsService.ttsModel(),
        voice: this.settingsService.ttsVoice(),
      });
    }
    // Drop any saved exercise sessions tied to this story.
    this.clearSessionHistory(id);
    if (this.selectedStoryId() === id) {
      this.selectedStoryId.set(null);
      // Remove the story id from the route when the selected story is deleted.
      this.router.navigate(['/stories'], { replaceUrl: true });
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
    // Exercise selection mode takes priority over word lookup
    if (this.exerciseSelectionMode()) {
      if (event.ctrlKey) {
        this.groupExerciseSelection(index);
      } else {
        this.toggleExerciseSelection(index);
      }
      return;
    }

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
    this.selectedWordIndices.set(new Set());
  }

  // ── Vocabulary exercise word selection ──

  isExerciseWordSelected(index: number): boolean {
    return this.exerciseSelectedGroups().some((g) => g.includes(index));
  }

  /** Plain left-click: toggle a single word (or remove its whole group if already selected). */
  toggleExerciseSelection(index: number): void {
    const groups = this.exerciseSelectedGroups();
    const groupIdx = groups.findIndex((g) => g.includes(index));
    if (groupIdx >= 0) {
      // Remove the entire group this word belongs to
      this.exerciseSelectedGroups.set(groups.filter((_, i) => i !== groupIdx));
    } else {
      this.exerciseSelectedGroups.set([...groups, [index]]);
    }
    this.exerciseError.set('');
  }

  /** Ctrl+left-click: group this word with the previously selected one as a single unit. */
  groupExerciseSelection(index: number): void {
    const groups = this.exerciseSelectedGroups().map((g) => [...g]);
    if (groups.length > 0) {
      const last = groups[groups.length - 1];
      const adjacent =
        last[last.length - 1] + 1 === index || last[0] - 1 === index;
      if (!last.includes(index) && adjacent) {
        groups[groups.length - 1] = [...last, index].sort((a, b) => a - b);
        this.exerciseSelectedGroups.set(groups);
        this.exerciseError.set('');
        return;
      }
    }
    // Not adjacent to the last group → start a new single-word group
    this.exerciseSelectedGroups.set([...groups, [index]]);
    this.exerciseError.set('');
  }

  toggleExerciseSelectionMode(): void {
    const enabled = !this.exerciseSelectionMode();
    this.exerciseSelectionMode.set(enabled);
    if (!enabled) {
      this.exerciseSelectedGroups.set([]);
    }
    this.exerciseError.set('');
  }

  clearExerciseSelection(): void {
    this.exerciseSelectedGroups.set([]);
    this.exerciseError.set('');
  }

  /** Removes a word group by its index in the selection. */
  removeExerciseGroup(groupIndex: number): void {
    this.exerciseSelectedGroups.update((groups) =>
      groups.filter((_, i) => i !== groupIndex)
    );
    this.exerciseError.set('');
  }

  /** Builds the display label for a group of token indices (e.g. "mache an"). */
  groupLabel(group: number[]): string {
    const tokens = this.wordTokens();
    return group
      .map((i) => tokens[i] ? this.cleanWordToken(tokens[i].text) : '')
      .filter((w) => w.length > 0)
      .join(' ');
  }

  private cleanWordToken(word: string): string {
    return word
      .replace(/^[.,!?;:()"'\u201C\u201D\u2018\u2019]+/, '')
      .replace(/[.,!?;:()"'\u201C\u201D\u2018\u2019]+$/, '')
      .trim();
  }

  // ── Sentence Notes Mode ──

  /** Toggles the sentence notes mode on/off. */
  toggleSentenceNotesMode(): void {
    const enabled = !this.sentenceNotesMode();
    this.sentenceNotesMode.set(enabled);
    if (!enabled) {
      this.selectedSentenceIndex.set(null);
      this.closeSentenceNotePopup();
    }
  }

  /** Checks if a sentence is currently selected. */
  isSentenceSelected(index: number): boolean {
    return this.selectedSentenceIndex() === index;
  }

  /** Handles click on a sentence span. */
  onSentenceClick(sentenceIndex: number, event: MouseEvent): void {
    if (!this.sentenceNotesMode()) return;

    event.preventDefault();
    event.stopPropagation();

    // Toggle selection
    if (this.selectedSentenceIndex() === sentenceIndex) {
      this.selectedSentenceIndex.set(null);
      this.closeSentenceNotePopup();
    } else {
      this.selectedSentenceIndex.set(sentenceIndex);
      this.openSentenceNotePopup(sentenceIndex, event);
    }
  }

  /** Opens the sentence note popup for the given sentence. */
  private openSentenceNotePopup(sentenceIndex: number, event: MouseEvent): void {
    const sentenceTokens = this.sentenceTokens();
    const sentence = sentenceTokens[sentenceIndex];
    if (!sentence) return;

    const story = this.selectedStory();
    if (!story) return;

    // Load existing note from service
    const note = this.sentenceNotesService.getNote(story.id, sentence.text);
    this.sentenceNoteText.set(note ?? '');

    // Position popup near the click
    this.sentenceNotePopupPosition.set({ x: event.clientX, y: event.clientY });
    this.sentenceNotePopupVisible.set(true);
    this.sentenceNoteError.set('');
  }

  /** Closes the sentence note popup. */
  closeSentenceNotePopup(): void {
    this.sentenceNotePopupVisible.set(false);
    this.sentenceNoteText.set('');
    this.sentenceNoteLoading.set(false);
    this.sentenceNoteError.set('');
  }

  /** Saves the note for the currently selected sentence. */
  async saveSentenceNote(): Promise<void> {
    const sentenceIndex = this.selectedSentenceIndex();
    if (sentenceIndex === null) return;

    const sentenceTokens = this.sentenceTokens();
    const sentence = sentenceTokens[sentenceIndex];
    if (!sentence) return;

    const story = this.selectedStory();
    if (!story) return;

    const noteText = this.sentenceNoteText().trim();

    this.sentenceNoteLoading.set(true);
    this.sentenceNoteError.set('');

    try {
      this.sentenceNotesService.setNote(story.id, sentence.text, noteText);
      this.closeSentenceNotePopup();
      this.selectedSentenceIndex.set(null);
    } catch (err) {
      this.sentenceNoteError.set('Failed to save note.');
    } finally {
      this.sentenceNoteLoading.set(false);
    }
  }

  /** Deletes the note for the currently selected sentence. */
  async deleteSentenceNote(): Promise<void> {
    const sentenceIndex = this.selectedSentenceIndex();
    if (sentenceIndex === null) return;

    const sentenceTokens = this.sentenceTokens();
    const sentence = sentenceTokens[sentenceIndex];
    if (!sentence) return;

    const story = this.selectedStory();
    if (!story) return;

    try {
      this.sentenceNotesService.deleteNote(story.id, sentence.text);
      this.sentenceNoteText.set('');
    } catch (err) {
      this.sentenceNoteError.set('Failed to delete note.');
    }
  }

  /** Checks if a sentence has a saved note. */
  hasSentenceNote(sentenceIndex: number): boolean {
    const sentenceTokens = this.sentenceTokens();
    const sentence = sentenceTokens[sentenceIndex];
    if (!sentence) return false;

    const story = this.selectedStory();
    if (!story) return false;

    return this.sentenceNotesService.hasNote(story.id, sentence.text);
  }

  /** Gets the note text for a sentence (for display). */
  getSentenceNoteText(sentenceIndex: number): string {
    const sentenceTokens = this.sentenceTokens();
    const sentence = sentenceTokens[sentenceIndex];
    if (!sentence) return '';

    const story = this.selectedStory();
    if (!story) return '';

    const note = this.sentenceNotesService.getNote(story.id, sentence.text);
    return note ?? '';
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async generateExercises(): Promise<void> {
    const story = this.selectedStory();
    const words = this.selectedExerciseWords();
    if (!story || words.length === 0) return;

    if (!this.aiService.hasApiKey()) {
      this.exerciseError.set('No API key set. Add your OpenRouter API key in Settings.');
      return;
    }

    this.exerciseGenerating.set(true);
    this.exerciseError.set('');
    try {
      const dictionary = this.wordService.getWords();
      const enriched = words.map((w) => {
        const found = dictionary.find((d) => d.german.toLowerCase() === w.toLowerCase());
        return {
          german: w,
          translationEn: found?.translationEn,
          translationRu: found?.translationRu,
          partOfSpeech: found?.partOfSpeech,
          pluralForm: found?.pluralForm,
          simplePast: found?.simplePast,
          pastParticiple: found?.pastParticiple,
        };
      });

      const generated = await this.aiService.generateStoryExercises({
        words: enriched,
        storyLevel: story.level,
        storyDomain: story.domain,
        storyText: story.german,
        translationLanguage: this.settingsService.translationLanguage(),
        onlyMc: this.settingsService.storyOnlyMcExercises(),
      });

      const exercises = generated
        .map((g) => this.toStoryExercise(g, story.id, story.level))
        .filter((e): e is StoryExercise => e !== null);

      if (exercises.length === 0) {
        this.exerciseError.set('No valid exercises could be generated. Try again.');
        return;
      }

      this.storyExerciseService.setSession(story, this.shuffleArray(exercises));
      this.router.navigate(['/stories-exercises']);
    } catch (err) {
      this.exerciseError.set(
        err instanceof Error ? err.message : 'Failed to generate exercises.'
      );
    } finally {
      this.exerciseGenerating.set(false);
    }
  }

  // ── Story Questions (active recall) ──

  /** Generates comprehension questions about the selected story and starts the
   *  AI-graded active-recall session. Question count scales with story length
   *  (roughly one per ~40 words), clamped to 5-10. */
  async startStoryQuestions(): Promise<void> {
    const story = this.selectedStory();
    if (!story) return;

    if (!this.aiService.hasApiKey()) {
      this.storyQuestionsError.set('No API key set. Add your OpenRouter API key in Settings.');
      return;
    }

    this.storyQuestionsGenerating.set(true);
    this.storyQuestionsError.set('');
    try {
      const count = Math.min(10, Math.max(5, Math.ceil(story.wordCount / 40)));

      const generated = await this.aiService.generateStoryQuestions({
        storyTitle: story.title,
        storyGerman: story.german,
        level: story.level,
        translationLanguage: this.settingsService.translationLanguage(),
        count,
      });

      if (generated.length === 0) {
        this.storyQuestionsError.set('No valid questions could be generated. Try again.');
        return;
      }

      const questions: StoryQuestion[] = generated.map((g) => ({
        id: crypto.randomUUID(),
        storyId: story.id,
        question: g.question.trim(),
        questionTranslation: (g.translation ?? '').trim(),
        answer: g.answer.trim(),
        hint: (g.hint ?? '').trim() || undefined,
      }));

      this.storyQuestionService.setSession(story, questions);
      this.router.navigate(['/story-questions']);
    } catch (err) {
      this.storyQuestionsError.set(
        err instanceof Error ? err.message : 'Failed to generate questions.'
      );
    } finally {
      this.storyQuestionsGenerating.set(false);
    }
  }

  // ── Exercise history & replay ──

  /** Completed/quit exercise sessions for the currently selected story, newest first. */
  readonly exerciseHistory = computed<StoryExerciseHistoryEntry[]>(() => {
    const id = this.selectedStoryId();
    if (!id) return [];
    return this.historyService.getForStory(id);
  });

  /** Computes a display date for a history entry. */
  formatSessionDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' ' + d.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /** Loads a saved session into the story exercise service and replays it. */
  replaySession(entryId: string): void {
    const entry = this.historyService.getEntryById(entryId);
    if (!entry || entry.exercises.length === 0) return;

    const story = this.storyService.getStoryById(entry.storyId) ?? {
      id: entry.storyId,
      title: entry.storyTitle,
      german: '',
      translationEn: '',
      translationRu: '',
      level: entry.level,
      domain: '',
      grammarTopics: [],
      wordCount: entry.exercises.length,
      createdAt: entry.completedAt,
    };

    this.stopPlayback();
    this.closeWordPopup();
    this.closeSentenceNotePopup();
    this.storyExerciseService.setSession(story, this.shuffleArray(entry.exercises));
    this.router.navigate(['/stories-exercises']);
  }

  /** Deletes a single history entry. */
  deleteSessionEntry(entryId: string): void {
    this.historyService.deleteEntry(entryId);
  }

  /** Deletes all saved history for a story (called when the story is deleted). */
  clearSessionHistory(storyId: string): void {
    this.historyService.deleteForStory(storyId);
    this.questionHistoryService.deleteForStory(storyId);
  }

  // ── Question history & replay ──

  /** Completed/quit question sessions for the currently selected story, newest first. */
  readonly questionHistory = computed<StoryQuestionHistoryEntry[]>(() => {
    const id = this.selectedStoryId();
    if (!id) return [];
    return this.questionHistoryService.getForStory(id);
  });

  /** Loads a saved question session into the story question service and replays it. */
  replayQuestionSession(entryId: string): void {
    const entry = this.questionHistoryService.getEntryById(entryId);
    if (!entry || entry.questions.length === 0) return;

    const story = this.storyService.getStoryById(entry.storyId) ?? {
      id: entry.storyId,
      title: entry.storyTitle,
      german: '',
      translationEn: '',
      translationRu: '',
      level: entry.level,
      domain: '',
      grammarTopics: [],
      wordCount: entry.questions.length,
      createdAt: entry.completedAt,
    };

    this.stopPlayback();
    this.closeWordPopup();
    this.closeSentenceNotePopup();
    this.storyQuestionService.setSession(story, [...entry.questions]);
    this.router.navigate(['/story-questions']);
  }

  /** Deletes a single question history entry. */
  deleteQuestionEntry(entryId: string): void {
    this.questionHistoryService.deleteEntry(entryId);
  }

  private toStoryExercise(
    g: GeneratedStoryExercise,
    storyId: string,
    level: DifficultyLevel
  ): StoryExercise | null {
    return toStoryExerciseShared(g, storyId, level);
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
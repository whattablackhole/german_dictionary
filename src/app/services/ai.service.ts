import { Injectable, signal, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Gender, DifficultyLevel, PartOfSpeech } from '../models/word';
import { SentenceFeedback } from '../models/sentence-pattern';
import { DiaryFeedback } from '../models/diary';
import { SettingsService } from './settings.service';

export interface AiSuggestion {
  translationEn: string;
  translationRu: string;
  partOfSpeech: PartOfSpeech;
  gender: Gender | null;
  level: DifficultyLevel;
  /** The dictionary/base form of the word (e.g. "sein" for "seine", "gut" for "gute") */
  baseForm?: string;
  // Verb-specific fields (only when partOfSpeech is 'verb')
  verbType?: 'strong' | 'weak' | 'mixed';
  infinitive?: string;
  presentThirdPerson?: string;
  simplePast?: string;
  pastParticiple?: string;
  // Noun-specific fields (only when partOfSpeech is 'noun')
  pluralForm?: string;
  pluralFormation?: string;
}

export interface TranslationError {
  errorId: number;
  startIndex: number;
  endIndex: number;
  explanation: string;
}

export interface TranslationResult {
  correct: boolean;
  score: number;
  errors: TranslationError[];
  feedback: string;
  /** The corrected/fixed German sentence */
  correctedText: string;
}

export interface GeneratedSentence {
  german: string;
  translationEn: string;
  translationRu: string;
  level: DifficultyLevel;
  domain: string;
}

export interface GeneratedWordExercise {
  fullSentence: string;
  targetWord: string;
  wordHint: string;
  /** The exact word(s) from fullSentence that should be blanked.
   *  Each entry is a substring of fullSentence (preserving case and punctuation).
   *  For a single noun like "Schuhe" in "Ich möchte die Schuhe anprobieren": ["Schuhe"]
   *  For a separable verb like "abholen" in "Ich hole dich ab": ["hole", "ab"] */
  blankWords: string[];
  /** Whether the blanked part is preceded by an article (der/die/das) */
  hasArticle: boolean;
  level: DifficultyLevel;
  domain: string;
  grammarTopics: string[];
}

export interface GeneratedPrepositionExercise {
  sentenceWithBlank: string;
  correctPreposition: string;
  correctCase: 'accusative' | 'dative' | 'genitive' | 'nominative';
  hintEn: string;
  hintRu: string;
  explanation: string;
  options: string[];
}

export interface GeneratedDeclensionExercise {
  sentenceWithBlank: string;
  correctAnswer: string;
  caseReq: 'nominative' | 'accusative' | 'dative' | 'genitive';
  genderLabel: string;
  focusType: 'article' | 'adjective' | 'noun' | 'phrase';
  baseForm?: string;
  hintEn: string;
  hintRu: string;
  explanation: string;
  note?: string;
  options: string[];
}

export interface GeneratedStoryExercise {
  /** The German target word this exercise trains */
  word: string;
  type: 'mc' | 'cloze' | 'sentence';

  // mc — multiple choice translation
  mcPrompt?: string;
  mcOptions?: string[];
  mcCorrect?: string;

  // cloze — word in a sentence
  clozeSentence?: string;
  clozeBlankWords?: string[];
  clozeHint?: string;

  // sentence — translate the whole sentence
  sentenceGerman?: string;
  sentenceNative?: string;
}

export interface DeclensionAnswerResult {
  correct: boolean;
  expectedAnswer: string;
  explanation: string;
  alternative?: string;
  score: number;
}

export interface TextModelOption {
  id: string;
  label: string;
  description: string;
}

const API_KEY_STORAGE = 'german-dictionary-openrouter-key';
const CREDIT_ERROR_KEY = 'german-dictionary-credit-error';

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly settingsService = inject(SettingsService);

  /** True when the last API call returned 402 (insufficient credits). */
  readonly creditError = signal<boolean>(false);

  /** Available text models fetched from OpenRouter */
  readonly availableTextModels = signal<TextModelOption[]>([]);

  constructor() {
    // Restore persisted credit error state
    try {
      if (localStorage.getItem(CREDIT_ERROR_KEY) === 'true') {
        this.creditError.set(true);
      }
    } catch {
      // ignore
    }
  }

  getApiKey(): string {
    return localStorage.getItem(API_KEY_STORAGE) || environment.openRouterApiKey;
  }

  hasApiKey(): boolean {
    return this.getApiKey().trim().length > 0;
  }

  setApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE, key.trim());
    // Clearing the key may resolve a credit issue (new account)
    this.setCreditError(false);
  }

  /**
   * Returns the OpenRouter `provider` routing object when throughput-based
   * routing is enabled, otherwise an empty object (spread no-op). Setting
   * `provider.sort` to "throughput" prioritizes the highest-throughput provider
   * instead of the default price-based load balancing.
   */
  private throughputProviderField(): { provider?: { sort: 'throughput' } } {
    return this.settingsService.throughputRouting()
      ? { provider: { sort: 'throughput' } }
      : {};
  }

  /**
   * Fetch available text/chat models from OpenRouter API.
   * Filters for models that support chat completions.
   */
  async fetchAvailableModels(): Promise<TextModelOption[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return [];
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn('Failed to fetch models from OpenRouter:', response.status);
      return [];
    }

    const data = await response.json();
    const models: TextModelOption[] = [];

    for (const model of data.data ?? []) {
      const id: string = model.id ?? '';
      if (!id) continue;

      // Only include models that can do text chat (text or multimodal modality)
      const modality = model.architecture?.modality ?? '';
      if (modality === 'image') continue;

      models.push({
        id,
        label: model.name ?? id,
        description: model.description
          ? model.description.replace(/<[^>]*>/g, '').substring(0, 120)
          : (model.pricing?.prompt ? `$${model.pricing.prompt}/tok prompt` : ''),
      });
    }

    // Sort: free models first, then by label
    models.sort((a, b) => {
      const aFree = a.id.includes(':free') ? 0 : 1;
      const bFree = b.id.includes(':free') ? 0 : 1;
      if (aFree !== bFree) return aFree - bFree;
      return a.label.localeCompare(b.label);
    });

    this.availableTextModels.set(models);
    return models;
  }

  /** Dismiss the credit warning banner — the user acknowledges the problem. */
  dismissCreditError(): void {
    this.setCreditError(false);
  }

  private setCreditError(value: boolean): void {
    this.creditError.set(value);
    try {
      if (value) {
        localStorage.setItem(CREDIT_ERROR_KEY, 'true');
      } else {
        localStorage.removeItem(CREDIT_ERROR_KEY);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Classify multiple German words in a single API call.
   * Returns AiSuggestion objects in the same order as the input array.
   */
  async analyzeWordsBatch(germanWords: string[]): Promise<AiSuggestion[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'No API key set. Add your OpenRouter API key in the AI Assistant field above.'
      );
    }

    const wordsJson = JSON.stringify(germanWords);

    const prompt = `You are a German language expert. Given an array of German words or phrases, classify each one and respond with JSON only (no markdown) as an object with a single key "words" containing an array of objects. Each object must correspond to the word at the same index in the input array.

Each object must have exactly these fields:
- "german": the original German word (copy it exactly from the input)
- "translationEn": the English translation
- "translationRu": the Russian translation
- "partOfSpeech": exactly one of "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "numeral" or "phrase"
- "gender": exactly one of "der", "die" or "das", OR null if the word is NOT a noun
- "level": exactly one of "A1", "A2", "B1", "B2" or "C1"
- "baseForm": the dictionary/base form of the word. For declined/inflected forms (e.g. "seine" → "sein", "gute" → "gut", "hat" → "haben", "schmeckt" → "schmecken"), provide the base form. If the input is already the base form, set this to the same value as the input word.
- "verbType": (only if partOfSpeech is "verb") exactly one of "strong", "weak" or "mixed". For other parts of speech, set to null.
- "infinitive": (only if partOfSpeech is "verb") the infinitive form. For other parts of speech, set to null.
- "presentThirdPerson": (only if partOfSpeech is "verb") the 3rd person singular present tense. For other parts of speech, set to null.
- "simplePast": (only if partOfSpeech is "verb") the simple past (Präteritum) form. For other parts of speech, set to null.
- "pastParticiple": (only if partOfSpeech is "verb") the past participle (Partizip II) form. For other parts of speech, set to null.
- "pluralForm": (only if partOfSpeech is "noun") the plural form. For other parts of speech, set to null.
- "pluralFormation": (only if partOfSpeech is "noun") the plural formation pattern, exactly one of "-e", "-en", "-er", "-s", "-n", "-", "umlaut", "umlaut + -e", "umlaut + -er", "umlaut + -en" or "foreign". For other parts of speech, set to null.

Rules:
- For nouns: gender is required. If the noun is plural-only, gender is "die". For compound nouns, use the gender of the last component.
- For nouns: always provide the pluralForm and pluralFormation.
- For any non-noun (verb, adjective, adverb, etc.): gender MUST be null.
- For verb infinitives (e.g. "gehen", "essen"), partOfSpeech is "verb".
- For adjectives (e.g. "schnell", "schön"), partOfSpeech is "adjective".
- Capitalize translations properly (nouns in English are lowercase, but proper names are capitalized).
- Common everyday words are typically A1-A2, less common words are B1-B2, specialized/formal words are C1.
- If the input is not a recognizable German word, still provide your best guess for all fields.
- IMPORTANT: If the input is a conjugated verb form (e.g. "schmeckt", "geht", "ist"), set "infinitive" to the infinitive form (e.g. "schmecken", "gehen", "sein").
- IMPORTANT: The output array MUST have exactly the same number of items as the input array, in the same order.

Input words: ${wordsJson}

Example response format:
{"words":[{"german":"Botschaft","translationEn":"message","translationRu":"посольство","partOfSpeech":"noun","gender":"die","level":"A2","baseForm":"Botschaft","verbType":null,"infinitive":null,"presentThirdPerson":null,"simplePast":null,"pastParticiple":null,"pluralForm":"Botschaften","pluralFormation":"-en"}]}`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          'API key rejected. Check your OpenRouter key at openrouter.ai/keys.'
        );
      }
      if (response.status === 402) {
        throw new Error(
          'OpenRouter account has insufficient credits. Add credits at openrouter.ai.'
        );
      }
      if (response.status === 429) {
        throw new Error('Rate limit reached. Try again in a moment.');
      }
      throw new Error(`AI request failed (HTTP ${response.status})`);
    }

    // On any successful API call, clear the credit error
    this.setCreditError(false);

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    interface BatchWordItem {
      german?: string;
      translationEn?: string;
      translationRu?: string;
      partOfSpeech?: string;
      gender?: string | null;
      level?: string;
      baseForm?: string | null;
      verbType?: string | null;
      infinitive?: string | null;
      presentThirdPerson?: string | null;
      simplePast?: string | null;
      pastParticiple?: string | null;
      pluralForm?: string | null;
      pluralFormation?: string | null;
    }

    let parsed: { words?: BatchWordItem[] };
    try {
      parsed = JSON.parse(jsonText) as typeof parsed;
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const rawWords = parsed.words;
    if (!Array.isArray(rawWords) || rawWords.length !== germanWords.length) {
      throw new Error(
        `AI returned ${rawWords?.length ?? 0} results, expected ${germanWords.length}.`
      );
    }

    const validParts: PartOfSpeech[] = [
      'noun', 'verb', 'adjective', 'adverb', 'pronoun',
      'preposition', 'conjunction', 'interjection', 'numeral', 'phrase',
    ];
    const validGender = ['der', 'die', 'das'];
    const validLevels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const validVerbTypes = ['strong', 'weak', 'mixed'];
    const validPluralFormations = ['-e', '-en', '-er', '-s', '-n', '-', 'umlaut', 'umlaut + -e', 'umlaut + -er', 'umlaut + -en', 'foreign'];

    return rawWords.map((item) => {
      const rawPart = (item.partOfSpeech ?? '').trim().toLowerCase() as PartOfSpeech;
      const partOfSpeech = validParts.includes(rawPart) ? rawPart : 'noun';
      const isNoun = partOfSpeech === 'noun';
      const isVerb = partOfSpeech === 'verb';

      const genderRaw = item.gender ? String(item.gender).trim() : '';
      const gender: Gender | null =
        isNoun && validGender.includes(genderRaw)
          ? (genderRaw as Gender)
          : null;

      const level = (item.level ?? '').trim().toUpperCase() as DifficultyLevel;
      const finalLevel = validLevels.includes(level) ? level : 'A1';

      const verbTypeRaw = (item.verbType ?? '').trim().toLowerCase();
      const verbType = isVerb && validVerbTypes.includes(verbTypeRaw) ? verbTypeRaw as 'strong' | 'weak' | 'mixed' : undefined;

      const pluralFormationRaw = (item.pluralFormation ?? '').trim();
      const pluralFormation = isNoun && validPluralFormations.includes(pluralFormationRaw) ? pluralFormationRaw : undefined;

      return {
        baseForm: (item.baseForm ?? '').trim() || undefined,
        translationEn: (item.translationEn ?? '').trim(),
        translationRu: (item.translationRu ?? '').trim(),
        partOfSpeech,
        gender,
        level: finalLevel,
        verbType,
        infinitive: isVerb ? ((item.infinitive ?? '').trim() || undefined) : undefined,
        presentThirdPerson: isVerb ? ((item.presentThirdPerson ?? '').trim() || undefined) : undefined,
        simplePast: isVerb ? ((item.simplePast ?? '').trim() || undefined) : undefined,
        pastParticiple: isVerb ? ((item.pastParticiple ?? '').trim() || undefined) : undefined,
        pluralForm: isNoun ? ((item.pluralForm ?? '').trim() || undefined) : undefined,
        pluralFormation,
      };
    });
  }

  /**
   * Re-analyze a German word with a user-provided hint to correct the AI's classification.
   * The hint is included in the prompt to guide the AI toward the correct result.
   */
  async reanalyzeWord(german: string, hint: string): Promise<AiSuggestion> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'No API key set. Add your OpenRouter API key in the AI Assistant field above.'
      );
    }

    const prompt = `You are a German language expert. A user has provided a hint about the word "${german}" to help you classify it correctly.

User's hint: "${hint}"

Please re-analyze the word "${german}" with this hint in mind. Respond with JSON only (no markdown) using exactly these fields:
- "translationEn": the English translation
- "translationRu": the Russian translation
- "partOfSpeech": the part of speech, exactly one of "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "numeral" or "phrase"
- "gender": the grammatical gender, exactly one of "der", "die" or "das", OR null if the word is NOT a noun
- "level": the CEFR difficulty level, exactly one of "A1", "A2", "B1", "B2" or "C1"
- "baseForm": the dictionary/base form of the word
- "verbType": (only if partOfSpeech is "verb") exactly one of "strong", "weak" or "mixed". For other parts of speech, set to null.
- "infinitive": (only if partOfSpeech is "verb") the infinitive form. For other parts of speech, set to null.
- "presentThirdPerson": (only if partOfSpeech is "verb") the 3rd person singular present tense. For other parts of speech, set to null.
- "simplePast": (only if partOfSpeech is "verb") the simple past (Präteritum) form. For other parts of speech, set to null.
- "pastParticiple": (only if partOfSpeech is "verb") the past participle (Partizip II) form. For other parts of speech, set to null.
- "pluralForm": (only if partOfSpeech is "noun") the plural form. For other parts of speech, set to null.
- "pluralFormation": (only if partOfSpeech is "noun") the plural formation pattern. For other parts of speech, set to null.

IMPORTANT: Consider the user's hint carefully. If the hint says "it's a verb" or similar, prioritize classifying it as a verb with appropriate verb fields.

Word: "${german}"`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API key rejected. Check your OpenRouter key at openrouter.ai/keys.');
      }
      if (response.status === 402) {
        throw new Error('OpenRouter account has insufficient credits. Add credits at openrouter.ai.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit reached. Try again in a moment.');
      }
      throw new Error(`AI request failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: {
      translationEn?: string;
      translationRu?: string;
      partOfSpeech?: string;
      gender?: string | null;
      level?: string;
      baseForm?: string | null;
      verbType?: string | null;
      infinitive?: string | null;
      presentThirdPerson?: string | null;
      simplePast?: string | null;
      pastParticiple?: string | null;
      pluralForm?: string | null;
      pluralFormation?: string | null;
    };
    try {
      parsed = JSON.parse(jsonText) as typeof parsed;
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const translationEn = parsed.translationEn?.trim() ?? '';
    const translationRu = parsed.translationRu?.trim() ?? '';
    const rawPart = (parsed.partOfSpeech ?? '').trim().toLowerCase() as PartOfSpeech;
    const genderRaw = parsed.gender ? String(parsed.gender).trim() : '';
    const level = (parsed.level ?? '').trim().toUpperCase() as DifficultyLevel;

    if (!translationEn || !translationRu) {
      throw new Error('AI could not classify this word. Try another hint.');
    }

    const validParts: PartOfSpeech[] = [
      'noun', 'verb', 'adjective', 'adverb', 'pronoun',
      'preposition', 'conjunction', 'interjection', 'numeral', 'phrase',
    ];
    const partOfSpeech = validParts.includes(rawPart) ? rawPart : 'noun';

    const validGender = ['der', 'die', 'das'];
    const isNoun = partOfSpeech === 'noun';
    const gender: Gender | null =
      isNoun && validGender.includes(genderRaw)
        ? (genderRaw as Gender)
        : null;

    const validLevels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const finalLevel = validLevels.includes(level) ? level : 'A1';

    const isVerb = partOfSpeech === 'verb';
    const validVerbTypes = ['strong', 'weak', 'mixed'];
    const verbTypeRaw = parsed.verbType?.trim().toLowerCase() ?? '';
    const verbType = isVerb && validVerbTypes.includes(verbTypeRaw) ? verbTypeRaw as 'strong' | 'weak' | 'mixed' : undefined;

    const validPluralFormations = ['-e', '-en', '-er', '-s', '-n', '-', 'umlaut', 'umlaut + -e', 'umlaut + -er', 'umlaut + -en', 'foreign'];
    const pluralFormationRaw = parsed.pluralFormation?.trim() ?? '';
    const pluralFormation = isNoun && validPluralFormations.includes(pluralFormationRaw) ? pluralFormationRaw : undefined;

    return {
      baseForm: parsed.baseForm?.trim() || undefined,
      translationEn,
      translationRu,
      partOfSpeech,
      gender,
      level: finalLevel,
      verbType,
      infinitive: isVerb ? (parsed.infinitive?.trim() || undefined) : undefined,
      presentThirdPerson: isVerb ? (parsed.presentThirdPerson?.trim() || undefined) : undefined,
      simplePast: isVerb ? (parsed.simplePast?.trim() || undefined) : undefined,
      pastParticiple: isVerb ? (parsed.pastParticiple?.trim() || undefined) : undefined,
      pluralForm: isNoun ? (parsed.pluralForm?.trim() || undefined) : undefined,
      pluralFormation,
    };
  }

  async analyzeWord(german: string): Promise<AiSuggestion> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'No API key set. Add your OpenRouter API key in the AI Assistant field above.'
      );
    }

    const prompt = `You are a German language expert. Given a German word or phrase, respond with JSON only (no markdown) using exactly these fields:
- "translationEn": the English translation
- "translationRu": the Russian translation
- "partOfSpeech": the part of speech, exactly one of "noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "interjection", "numeral" or "phrase"
- "gender": the grammatical gender, exactly one of "der", "die" or "das", OR null if the word is NOT a noun
- "level": the CEFR difficulty level of the word, exactly one of "A1", "A2", "B1", "B2" or "C1"
- "baseForm": the dictionary/base form of the word. For declined/inflected forms (e.g. "seine" → "sein", "gute" → "gut", "hat" → "haben", "schmeckt" → "schmecken"), provide the base form. If the input is already the base form, set this to the same value as the input word.
- "verbType": (only if partOfSpeech is "verb") the verb conjugation type, exactly one of "strong", "weak" or "mixed". For other parts of speech, omit this field or set to null.
- "infinitive": (only if partOfSpeech is "verb") the infinitive form of the verb, e.g. "schmecken" for "schmeckt", "sein" for "ist", "gehen" for "geht". For other parts of speech, omit.
- "presentThirdPerson": (only if partOfSpeech is "verb") the 3rd person singular present tense form, e.g. "fliegt" for "fliegen", "ist" for "sein". For other parts of speech, omit.
- "simplePast": (only if partOfSpeech is "verb") the simple past (Präteritum) form, e.g. "flog" for "fliegen", "war" for "sein". For other parts of speech, omit.
- "pastParticiple": (only if partOfSpeech is "verb") the past participle (Partizip II) form, e.g. "geflogen" for "fliegen", "gewesen" for "sein". For other parts of speech, omit.
- "pluralForm": (only if partOfSpeech is "noun") the plural form of the noun, e.g. "Hunde" for "Hund", "Katze" for "Katze", "Häuser" for "Haus", "Autos" for "Auto". For other parts of speech, omit.
- "pluralFormation": (only if partOfSpeech is "noun") the plural formation pattern, exactly one of "-e", "-en", "-er", "-s", "-n", "-", "umlaut", "umlaut + -e", "umlaut + -er", "umlaut + -en" or "foreign". For other parts of speech, omit.

Rules:
- For nouns: gender is required. If the noun is plural-only, gender is "die". For compound nouns, use the gender of the last component.
- For nouns: always provide the pluralForm and pluralFormation.
- For any non-noun (verb, adjective, adverb, etc.): gender MUST be null.
- For verb infinitives (e.g. "gehen", "essen"), partOfSpeech is "verb".
- For adjectives (e.g. "schnell", "schön"), partOfSpeech is "adjective".
- Capitalize translations properly (nouns in English are lowercase, but proper names are capitalized).
- Common everyday words are typically A1-A2, less common words are B1-B2, specialized/formal words are C1.
- If the input is not a recognizable German word, still provide your best guess for all fields.
- IMPORTANT: If the input is a conjugated verb form (e.g. "schmeckt", "geht", "ist"), set "infinitive" to the infinitive form (e.g. "schmecken", "gehen", "sein").

Word: "${german}"`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error(
          'API key rejected. Check your OpenRouter key at openrouter.ai/keys.'
        );
      }
      if (response.status === 402) {
        throw new Error(
          'OpenRouter account has insufficient credits. Add credits at openrouter.ai.'
        );
      }
      if (response.status === 429) {
        throw new Error('Rate limit reached. Try again in a moment.');
      }
      throw new Error(`AI request failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: {
      translationEn?: string;
      translationRu?: string;
      partOfSpeech?: string;
      gender?: string | null;
      level?: string;
      baseForm?: string | null;
      verbType?: string | null;
      infinitive?: string | null;
      presentThirdPerson?: string | null;
      simplePast?: string | null;
      pastParticiple?: string | null;
      pluralForm?: string | null;
      pluralFormation?: string | null;
    };
    try {
      parsed = JSON.parse(jsonText) as typeof parsed;
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const translationEn = parsed.translationEn?.trim() ?? '';
    const translationRu = parsed.translationRu?.trim() ?? '';
    const rawPart = (parsed.partOfSpeech ?? '').trim().toLowerCase() as PartOfSpeech;
    const genderRaw = parsed.gender ? String(parsed.gender).trim() : '';
    const level = (parsed.level ?? '').trim().toUpperCase() as DifficultyLevel;

    if (!translationEn || !translationRu) {
      throw new Error('AI could not classify this word. Try another word.');
    }

    const validParts: PartOfSpeech[] = [
      'noun', 'verb', 'adjective', 'adverb', 'pronoun',
      'preposition', 'conjunction', 'interjection', 'numeral', 'phrase',
    ];
    const partOfSpeech = validParts.includes(rawPart) ? rawPart : 'noun';

    const validGender = ['der', 'die', 'das'];
    const isNoun = partOfSpeech === 'noun';
    const gender: Gender | null =
      isNoun && validGender.includes(genderRaw)
        ? (genderRaw as Gender)
        : null;

    const validLevels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const finalLevel = validLevels.includes(level) ? level : 'A1';

    // Extract verb-specific fields
    const isVerb = partOfSpeech === 'verb';
    const validVerbTypes = ['strong', 'weak', 'mixed'];
    const verbTypeRaw = parsed.verbType?.trim().toLowerCase() ?? '';
    const verbType = isVerb && validVerbTypes.includes(verbTypeRaw) ? verbTypeRaw as 'strong' | 'weak' | 'mixed' : undefined;

    // Extract noun-specific fields
    const validPluralFormations = ['-e', '-en', '-er', '-s', '-n', '-', 'umlaut', 'umlaut + -e', 'umlaut + -er', 'umlaut + -en', 'foreign'];
    const pluralFormationRaw = parsed.pluralFormation?.trim() ?? '';
    const pluralFormation = isNoun && validPluralFormations.includes(pluralFormationRaw) ? pluralFormationRaw : undefined;

    return {
      baseForm: parsed.baseForm?.trim() || undefined,
      translationEn,
      translationRu,
      partOfSpeech,
      gender,
      level: finalLevel,
      verbType,
      infinitive: isVerb ? (parsed.infinitive?.trim() || undefined) : undefined,
      presentThirdPerson: isVerb ? (parsed.presentThirdPerson?.trim() || undefined) : undefined,
      simplePast: isVerb ? (parsed.simplePast?.trim() || undefined) : undefined,
      pastParticiple: isVerb ? (parsed.pastParticiple?.trim() || undefined) : undefined,
      pluralForm: isNoun ? (parsed.pluralForm?.trim() || undefined) : undefined,
      pluralFormation,
    };
  }

  async generateSentences(
    level: DifficultyLevel,
    knownWords: string[],
    count: number,
    domain?: string,
    grammarTopics?: string[],
    wordDetails?: { german: string; partOfSpeech: string; gender?: string | null; pluralForm?: string; verbType?: string; presentThirdPerson?: string; simplePast?: string; pastParticiple?: string }
  ): Promise<GeneratedSentence[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const wordsList = knownWords.length > 0 ? knownWords.join(', ') : 'common German words';
    const domainInstruction = domain
      ? `All sentences must be about the theme: "${domain}".`
      : 'Vary the domains across sentences.';
    const grammarInstruction =
      grammarTopics && grammarTopics.length > 0
        ? `Each sentence must demonstrate at least one of these grammar topics: ${grammarTopics.join(', ')}.`
        : '';

    let partOfSpeechInstructions = '';
    if (wordDetails) {
      const wd = wordDetails;
      if (wd.partOfSpeech === 'noun') {
        const genderLabel = wd.gender ? ` (${wd.gender})` : '';
        const pluralInfo = wd.pluralForm ? ` (plural: ${wd.pluralForm})` : '';
        partOfSpeechInstructions = `The target word is the noun "${wd.german}"${genderLabel}${pluralInfo}.
- Show both singular and plural forms in different sentences when the plural exists.
- Vary the grammatical cases (nominative, accusative, dative) across examples.
- Include articles (der/die/das, ein/eine, dem/den/der etc.) naturally.`;
      } else if (wd.partOfSpeech === 'verb') {
        const verbInfo = [
          wd.presentThirdPerson ? `3rd person present: "${wd.presentThirdPerson}"` : '',
          wd.simplePast ? `simple past (Präteritum): "${wd.simplePast}"` : '',
          wd.pastParticiple ? `past participle (Partizip II): "${wd.pastParticiple}"` : '',
          wd.verbType ? `type: ${wd.verbType}` : '',
        ].filter(Boolean).join(', ');
        partOfSpeechInstructions = `The target word is the verb "${wd.german}"${verbInfo ? ` (${verbInfo})` : ''}.
- Use different subjects: "ich", "du", "er/sie/es", "wir", "sie" in different sentences.
- Include at least one example in Präsens, one in Präteritum, and one with Partizip II (Perfekt) when these forms are provided.
- For separable verbs: correctly separate the prefix in Präsens and Präteritum, but keep it attached in the Partizip II.`;
      } else if (wd.partOfSpeech === 'adjective') {
        partOfSpeechInstructions = `The target word is the adjective "${wd.german}".
- Include its comparative form (e.g. "größer", "besser", "schneller") in at least one sentence.
- Include its superlative form (e.g. "größte", "beste", "schnellste") in at least one sentence if natural.
- Show the adjective with different endings (e.g. after "der/die/das", after "ein/eine", without article).`;
      } else if (wd.partOfSpeech === 'adverb') {
        partOfSpeechInstructions = `The target word is the adverb "${wd.german}".
- Include its comparative form (e.g. "häufiger", "besser", "mehr") in at least one sentence.
- Include its superlative form (e.g. "am häufigsten", "am besten", "am meisten") in at least one sentence if natural.
- Show the adverb in different positions within the sentence (beginning, middle, end).`;
      } else {
        partOfSpeechInstructions = `The target word is "${wd.german}" (${wd.partOfSpeech}).
- Use the word naturally in different sentence positions and contexts.`;
      }
    }

    const prompt = `You are a German language teacher. Generate ${count} German sentences at CEFR level ${level}.
Respond with JSON only (no markdown) as an object with a single key "sentences" containing an array of objects. Each object must have exactly these fields:
- "german": the German sentence
- "translationEn": the English translation
- "translationRu": the Russian translation
- "level": "${level}"
- "domain": the topic domain (e.g. "Family", "Travel", "Food", "Work", "Nature", "Education", "Technology")
- "grammarTopics": array of strings listing which grammar topics this sentence demonstrates

Rules:
- Prioritize using words from this list: ${wordsList}
- Each sentence should include as many of these words as possible.
- Only use words NOT in the list if absolutely necessary for the sentence to make sense.
- Sentences should be realistic and natural for ${level} level.
- Keep sentences concise (5-15 words).
- ${domainInstruction}
- ${grammarInstruction}
${partOfSpeechInstructions ? `\n${partOfSpeechInstructions}` : ''}

Generate exactly ${count} sentences.

Example format:
{"sentences":[{"german":"...","translationEn":"...","translationRu":"...","level":"${level}","domain":"...","grammarTopics":["..."]}]}`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: GeneratedSentence[] | { sentences: GeneratedSentence[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const sentences = Array.isArray(parsed)
      ? parsed
      : (parsed as { sentences: GeneratedSentence[] }).sentences ?? [];

    if (!Array.isArray(sentences) || sentences.length === 0) {
      throw new Error('AI could not generate sentences. Try again.');
    }

    return sentences.map((s) => ({
      ...s,
      level: level,
    }));
  }

  async generateWordExercises(
    level: DifficultyLevel,
    targetWords: { german: string; translationEn: string; translationRu: string }[],
    count: number,
    domain?: string,
    grammarTopics?: string[],
    avoidSentences?: string[],
    levelRange?: DifficultyLevel[]
  ): Promise<GeneratedWordExercise[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const wordsJson = JSON.stringify(targetWords);
    const domainInstruction = domain
      ? `All sentences must be about the theme: "${domain}".`
      : 'Vary the domains across sentences.';
    const grammarInstruction =
      grammarTopics && grammarTopics.length > 0
        ? `Each sentence must demonstrate at least one of these grammar topics: ${grammarTopics.join(', ')}.`
        : '';
    const avoidInstruction = avoidSentences && avoidSentences.length > 0
      ? `\n- Do NOT generate any of these exact sentences: ${avoidSentences.join('; ')}. Create different sentences using the same words.`
      : '';

    const levelInstruction = levelRange && levelRange.length > 1
      ? `Generate sentences at a variety of CEFR levels between ${levelRange[0]} and ${levelRange[levelRange.length - 1]}, mixing easier and harder sentences.`
      : `Generate sentences at CEFR level ${level}.`;

    const prompt = `You are a German language teacher. Generate ${count} German cloze (fill-in-the-blank) exercises. ${levelInstruction}
Respond with JSON only (no markdown) as an object with a single key "exercises" containing an array of objects. Each object must have exactly these fields:
- "fullSentence": the complete German sentence without blanks
- "targetWord": the German word(s) the student must type (WITHOUT the article for nouns, e.g. "Hund"; for separable verbs the full verb form, e.g. "abholen")
- "wordHint": the English translation of the target word (for the student to know what word to fill in)
- "blankWords": array of the EXACT substrings from fullSentence that should be replaced with "___". Each entry must be a verbatim substring of fullSentence (preserving case and any surrounding punctuation). For a single noun like "Schuhe" in "Ich möchte die Schuhe anprobieren": ["Schuhe"]. For a separable verb like "abholen" in "Ich hole dich ab": ["hole", "ab"]. For a verb like "sieht aus" in "Er sieht gut aus": ["sieht", "aus"]. NEVER include the article.
- "hasArticle": boolean — true ONLY if there is a German article (der/die/das, or declined form like dem/den/ein/eine) immediately before the blanked noun in the sentence
- "level": "${level}"
- "domain": the topic domain (e.g. "Family", "Travel", "Food", "Work", "Nature", "Education", "Technology")
- "grammarTopics": array of strings listing which grammar topics this sentence demonstrates

Rules:
- Each exercise must target exactly one word from this list: ${wordsJson}
- For nouns: blankWords contains ONLY the noun string, never the article. hasArticle is true if an article precedes it.
- For separable verbs: blankWords contains BOTH parts (the conjugated part and the separable prefix). hasArticle is always false.
- For other verbs/adjectives/adverbs: blankWords contains the single word string. hasArticle is always false.
- Important: multiple blankWords does NOT automatically mean gender+noun. hasArticle explicitly tells us whether an article is present before the noun.
- The wordHint must be the English translation of the target word.
- Sentences should be realistic and natural for ${level} level.
- Keep sentences concise (5-15 words).
- Vary the sentence structures and topics — do not repeat the same sentence pattern.
- ${domainInstruction}
- ${grammarInstruction}
- Do NOT add any hints about gender or word endings.
- ${avoidInstruction}

Generate exactly ${count} exercises.

Example format:
{"exercises":[{"fullSentence":"...","targetWord":"...","wordHint":"...","blankWordIndices":[0,3],"hasArticle":false,"level":"${level}","domain":"...","grammarTopics":["..."]}]}`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: GeneratedWordExercise[] | { exercises: GeneratedWordExercise[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const exercises = Array.isArray(parsed)
      ? parsed
      : (parsed as { exercises: GeneratedWordExercise[] }).exercises ?? [];

    if (!Array.isArray(exercises) || exercises.length === 0) {
      throw new Error('AI could not generate exercises. Try again.');
    }

    return exercises.map((e) => ({
      ...e,
      level: level,
      grammarTopics: e.grammarTopics ?? [],
    }));
  }

  async verifySentenceWriting(
    sentence: string,
    patternId: string,
    patternDescription: string,
    patternTips: string
  ): Promise<SentenceFeedback> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const prompt = `You are a German language teacher. A student has written a German sentence to practice a specific grammar pattern.

Analyze the sentence and respond with JSON only (no markdown) using exactly these fields:
- "patternCorrect": boolean — does the sentence follow the required grammar pattern?
- "patternErrors": array of strings — specific errors in the grammar pattern (e.g. "Verb should be at the end of the subordinate clause", "Modal verb should be in position 2"). Empty array if none.
- "tips": array of strings — encouraging, actionable tips to improve the sentence
- "masteryDelta": number — how much the student's mastery of this pattern should change: +5 if perfectly correct, +2 if mostly correct with minor issues, 0 if partially correct, -5 if pattern is wrong, -10 if completely wrong

Pattern to practice: "${patternId}"
Pattern description: ${patternDescription}
Pattern tips: ${patternTips}

Student's sentence: "${sentence}"

Rules:
- Check if the sentence follows the grammar pattern correctly (word order, verb position, etc.)
- Be encouraging but honest. The goal is to teach, not just criticize.
- Ignore punctuation and capitalization differences.
- For separable verbs: check if the prefix is correctly separated and moved to the end.`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    interface ParsedFeedback {
      patternCorrect?: boolean;
      patternErrors?: string[] | string;
      vocabCorrect?: boolean;
      unknownWords?: string[] | string;
      tips?: string[] | string;
      masteryDelta?: number;
    }

    let parsed: ParsedFeedback;
    try {
      parsed = JSON.parse(jsonText) as ParsedFeedback;
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const normalizeList = (value: string[] | string | undefined): string[] => {
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => item.length > 0);
      }
      if (typeof value === 'string' && value.trim()) {
        // AI sometimes returns a single string instead of an array — split into sentences/period-separated tips
        const trimmed = value.trim();
        // If it looks like a single sentence, return as one tip. If it has multiple sentences, split on periods.
        const sentences = trimmed.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
        return sentences.length > 0 ? sentences : [trimmed];
      }
      return [];
    };

    return {
      patternCorrect: parsed.patternCorrect ?? false,
      patternErrors: normalizeList(parsed.patternErrors),
      vocabCorrect: parsed.vocabCorrect ?? false,
      unknownWords: normalizeList(parsed.unknownWords),
      tips: normalizeList(parsed.tips),
      masteryDelta: parsed.masteryDelta ?? 0,
    };
  }

  /**
   * Analyzes a free-form German diary entry, providing grammar corrections,
   * an improved version, study suggestions, unknown words, follow-up questions,
   * and a rough CEFR level estimate.
   */
  async analyzeDiaryEntry(
    text: string,
    vocabList: { german: string; translationEn: string; translationRu: string }[],
    conversationHistory?: { role: 'user' | 'assistant'; text: string }[]
  ): Promise<DiaryFeedback> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const historyBlock = conversationHistory && conversationHistory.length > 0
      ? `\n\nThis is a continuation of a conversation. Here is the history so far:\n${conversationHistory.map((m) => `[${m.role === 'user' ? 'Student' : 'Teacher'}]: ${m.text}`).join('\n')}\n\nThe student's new message above is a response to the teacher's last question. Analyze it in the context of this ongoing conversation.`
      : '';

    const prompt = `You are a German language teacher. A student has written a free-form diary entry in German as a language learning exercise.

Analyze the diary entry and respond with JSON only (no markdown) using exactly these fields:
- "overall": string — a short, encouraging overall assessment of the entry (2-3 sentences in English)
- "corrections": array of objects, each with:
  - "startIndex": number — character index in the ORIGINAL text where the error starts (inclusive)
  - "endIndex": number — character index in the ORIGINAL text where the error ends (exclusive)
  - "original": string — the exact original text segment (as written, including spaces if part of the error)
  - "corrected": string — the corrected text segment
  - "explanation": string — a brief English explanation of the grammar/usage error
  Empty array if there are no errors.
- "correctedText": string — the FULL corrected version of the diary entry (same content, with all corrections applied and natural phrasing preserved). If no corrections, this equals the original text.
- "suggestions": array of strings — 2-4 actionable study suggestions based on errors or patterns noticed (e.g. "Review dative prepositions", "Practice separable verb word order"). Empty array if nothing to suggest.
- "unknownWords": array of strings — any words in the entry that are uncommon or likely unknown to a learner at the student's level. Include conjugated verb forms but list the base/infinitive form. Empty array if all words are common.
- "followUpQuestions": array of objects, each with:
  - "de": string — a follow-up question in German encouraging the student to continue writing (natural, level-appropriate)
  - "en": string — the English translation of the question
  3-5 questions in total.
- "cefrEstimate": string — the rough CEFR level of the writing, exactly one of "A1", "A2", "B1", "B2" or "C1"
- "encouragements": string — a final encouraging sentence in English, celebrating what the student did well

Diary entry: "${text}"${historyBlock}

Rules:
- Be encouraging above all. The goal is to motivate the student to keep writing, not to overwhelm with corrections.
- Only flag genuinely incorrect German (grammar, word choice, spelling, word order). Do NOT correct stylistic preferences.
- For correction indices, count characters carefully against the ORIGINAL text.
- "correctedText" must preserve the student's meaning and natural voice, while fixing all flagged errors.
- For "unknownWords": flag any words that are uncommon or likely beyond A2/B1 level. Use your judgement as a German teacher. Allow conjugated forms of common verbs. Empty array if all words are common.
- Follow-up questions should be simple enough for the student to answer at their level, and should relate to the content of the entry (e.g. ask for more details about what they wrote about).
- The cefrEstimate should be based on sentence complexity, vocabulary range, and error frequency.`;
 
    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text2: string | undefined = data.choices?.[0]?.message?.content;
    if (!text2) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text2.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text2;

    let parsed: Partial<DiaryFeedback>;
    try {
      parsed = JSON.parse(jsonText) as Partial<DiaryFeedback>;
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const validLevels: DifficultyLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const rawLevel = (parsed.cefrEstimate ?? '').trim().toUpperCase() as DifficultyLevel;
    const cefrEstimate = validLevels.includes(rawLevel) ? rawLevel : 'A1';

    return {
      overall: parsed.overall ?? '',
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      correctedText: parsed.correctedText ?? text,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      unknownWords: Array.isArray(parsed.unknownWords) ? parsed.unknownWords : [],
      followUpQuestions: Array.isArray(parsed.followUpQuestions) ? parsed.followUpQuestions : [],
      cefrEstimate,
      encouragements: parsed.encouragements ?? '',
    };
  }

  async generateGrammarNote(userQuery: string): Promise<{
    title: string;
    category: string;
    content: string;
    examples: string[];
    relatedTopics: string[];
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const prompt = `You are a German language expert and teacher. A student has asked about a German grammar topic. Based on their query, generate a comprehensive, well-structured grammar note.

Respond with JSON only (no markdown) as an object with exactly these fields:
- "title": a clear, concise title for the note (e.g. "Verbs with the Preposition 'auf'")
- "category": the broad category this belongs to, exactly one of: "Prepositions & Cases", "Verb Conjugation & Tenses", "Sentence Structure & Word Order", "Articles & Nouns", "Adjectives & Adverbs", "Pronouns", "Negation & Questions", "Numbers & Time", "Modal Particles & Connectors", "Special Topics & Idioms"
- "content": a detailed explanation in English, formatted with markdown for readability (use **bold** for key terms, bullet points for lists, etc.)
- "examples": an array of 3-5 German example sentences with English translations, formatted as "German: ... — English: ..."
- "relatedTopics": an array of related grammar topic strings (e.g. "Dative case (Dativ)", "Prepositions with dative") — use the exact topic names from this list if applicable: Prepositions with accusative, Prepositions with dative, Prepositions with genitive, Two-way prepositions, Verbs with fixed prepositions, Dative case, Accusative case, Separable prefix verbs, Modal verbs, Subordinating conjunctions, Word order (subordinate clauses)

Rules:
- The explanation should be thorough but accessible for a language learner.
- Include practical usage tips and common mistakes to avoid.
- Examples must be realistic and natural.
- If the query is about a specific verb-preposition combination, explain the pattern and list other common verbs with the same preposition.

Student's query: "${userQuery}"`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: {
      title?: string;
      category?: string;
      content?: string;
      examples?: string[];
      relatedTopics?: string[];
    };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    return {
      title: parsed.title ?? 'Untitled Note',
      category: parsed.category ?? 'Special Topics & Idioms',
      content: parsed.content ?? '',
      examples: parsed.examples ?? [],
      relatedTopics: parsed.relatedTopics ?? [],
    };
  }

  async verifyTranslation(
    userInput: string,
    correctGerman: string
  ): Promise<TranslationResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const prompt = `You are a German language teacher. Compare the student's translation with the correct German sentence.
Respond with JSON only (no markdown) using exactly these fields:
- "correct": boolean (true if the translation is essentially correct)
- "score": number (0-100, how accurate the translation is)
- "errors": array of error objects, each with:
  - "errorId": number (sequential starting from 1)
  - "startIndex": number (character index in the student's input where the error starts)
  - "endIndex": number (character index in the student's input where the error ends)
  - "explanation": string (explanation of the error in English)
- "feedback": string (overall encouraging feedback in English)
- "correctedText": string (the student's translation with all errors corrected into a natural, grammatically correct German sentence. If correct is true, this equals the student's input.)

Rules:
- Minor spelling mistakes that don't change meaning should reduce score but not count as errors.
- Wrong articles, wrong verb conjugations, wrong word order are errors.
- Missing words are errors (point to the position where the word should be).
- If the student's input is empty or completely wrong, set correct to false and score to 0.
- "correctedText" must preserve the student's intended meaning while fixing all errors, and be natural German.

Correct sentence: "${correctGerman}"
Student's translation: "${userInput}"`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: {
      correct?: boolean;
      score?: number;
      errors?: TranslationError[];
      feedback?: string;
      correctedText?: string;
    };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    return {
      correct: parsed.correct ?? false,
      score: parsed.score ?? 0,
      errors: parsed.errors ?? [],
      feedback: parsed.feedback ?? '',
      correctedText: parsed.correctedText?.trim() || correctGerman,
    };
  }

  async generateStory(config: {
    theme: string;
    level: DifficultyLevel;
    wordTypes: string[];
    grammarTopics: string[];
    sentenceCount: number;
  }): Promise<{ title: string; german: string; translationEn: string; translationRu: string }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const wordTypesInstruction = config.wordTypes.length > 0
      ? `Prioritize using these word types: ${config.wordTypes.join(', ')}.`
      : '';
    const grammarInstruction = config.grammarTopics.length > 0
      ? `The story must demonstrate these grammar topics: ${config.grammarTopics.join(', ')}.`
      : '';

    const prompt = `You are a German language teacher. Generate a cohesive German story at CEFR level ${config.level}.
Respond with JSON only (no markdown) as an object with these fields:
- "title": a short, engaging title for the story
- "german": the complete German story text (${config.sentenceCount} sentences, all in one paragraph or with line breaks)
- "translationEn": the complete English translation
- "translationRu": the complete Russian translation

Rules:
- The story must be about the theme: "${config.theme}".
- ${wordTypesInstruction}
- ${grammarInstruction}
- The story should be natural and coherent, not a list of isolated sentences.
- Use vocabulary and grammar appropriate for ${config.level} level.
- Generate exactly ${config.sentenceCount} sentences.
- The German text must use proper punctuation and capitalization.

Generate exactly ${config.sentenceCount} sentences.`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: { title?: string; german?: string; translationEn?: string; translationRu?: string };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    if (!parsed.german || !parsed.translationEn || !parsed.translationRu) {
      throw new Error('AI could not generate a complete story. Try again.');
    }

    return {
      title: parsed.title ?? 'Untitled Story',
      german: parsed.german,
      translationEn: parsed.translationEn,
      translationRu: parsed.translationRu,
    };
  }

  /**
   * Generate vocabulary exercises (3 per word) for words from an AI-generated story:
   * multiple-choice translation, fill-in-the-blank (word in a sentence), and whole-sentence translation.
   * Words are processed in chunks to keep each AI response a manageable size.
   */
  async generateStoryExercises(config: {
    words: { german: string; translationEn?: string; translationRu?: string }[];
    storyLevel: DifficultyLevel;
    storyDomain: string;
    storyText?: string;
    translationLanguage: 'en' | 'ru';
  }): Promise<GeneratedStoryExercise[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }
    if (config.words.length === 0) {
      throw new Error('No words selected.');
    }

    const langName = config.translationLanguage === 'ru' ? 'Russian' : 'English';
    const storyBlock = config.storyText
      ? `The student has read the following German story at CEFR level ${config.storyLevel} about "${config.storyDomain}":\n"""\n${config.storyText}\n"""\n`
      : `The student is at CEFR level ${config.storyLevel} and the story theme is "${config.storyDomain}".\n`;

    const allExercises: GeneratedStoryExercise[] = [];
    const CHUNK_SIZE = 8;

    for (let i = 0; i < config.words.length; i += CHUNK_SIZE) {
      const chunk = config.words.slice(i, i + CHUNK_SIZE);
      const wordsJson = JSON.stringify(chunk);
      const count = chunk.length * 3;

      const prompt = `You are a German language teacher. ${storyBlock}
For EACH word in the list below, generate EXACTLY 3 vocabulary exercises (3 exercises per word):
1. "mc" — multiple choice: show the German word and provide exactly 4 answer options — its translation in ${langName} plus 3 plausible distractor translations.
2. "cloze" — word in a sentence: a German sentence containing the word, where the target word is blanked with "___". The student must type the German word. Provide the hint = the word's translation in ${langName}.
3. "sentence" — translate the sentence: a German sentence containing the word and its ${langName} translation. The student must type the German sentence.

Words: ${wordsJson}

Respond with JSON only (no markdown) as an object with a single key "exercises" containing an array of objects. Each object must have exactly these fields:
- "word": the target German word (copy it exactly from the input list)
- "type": exactly "mc", "cloze" or "sentence"
- "mcPrompt": (only for type "mc") the German word to translate, with the article for nouns (e.g. "der Apfel")
- "mcOptions": (only for type "mc") array of exactly 4 translations in ${langName}, including the correct one, in random order
- "mcCorrect": (only for type "mc") the correct translation
- "clozeSentence": (only for type "cloze") the full German sentence with the word
- "clozeBlankWords": (only for type "cloze") array of the EXACT substrings of clozeSentence that should be replaced with "___" (e.g. ["Schuhe"]; for a separable verb like "Ich hole dich ab" use ["hole", "ab"]; never include the article for nouns)
- "clozeHint": (only for type "cloze") the ${langName} translation of the target word
- "sentenceGerman": (only for type "sentence") the German sentence the student must type
- "sentenceNative": (only for type "sentence") the ${langName} translation of that sentence

Rules:
- Prefer using sentences from the provided story when the target word appears there; otherwise write a short natural sentence (5-15 words) at CEFR level ${config.storyLevel}.
- The three exercises for a word may reuse a story sentence; otherwise vary the sentences.
- Keep sentences concise, natural and level-appropriate.
- The mc options must be translations in ${langName} (not German words). Distractors must be plausible (similar meaning area or part of speech, similar difficulty).
- For nouns in "mcPrompt" include the article and the base form.
- Generate exactly ${count} exercises.

Example format:
{"exercises":[{"word":"Apfel","type":"mc","mcPrompt":"der Apfel","mcOptions":["apple","pear","banana","orange"],"mcCorrect":"apple","clozeSentence":"","clozeBlankWords":[],"clozeHint":"","sentenceGerman":"","sentenceNative":""}]}`;

      const response = await fetch(environment.openRouterApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.settingsService.textModel(),
          messages: [{ role: 'user', content: prompt }],
          ...(this.throughputProviderField()),
          response_format: { type: 'json_object' },
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        this.handleError(response);
      }

      const data = await response.json();
      const text: string | undefined = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('AI returned no result.');
      }

      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;

      let parsed: GeneratedStoryExercise[] | { exercises: GeneratedStoryExercise[] };
      try {
        parsed = JSON.parse(jsonText);
      } catch {
        throw new Error('AI returned an invalid response.');
      }

      const exercises = Array.isArray(parsed)
        ? parsed
        : (parsed as { exercises: GeneratedStoryExercise[] }).exercises ?? [];

      if (!Array.isArray(exercises) || exercises.length === 0) {
        throw new Error('AI could not generate exercises. Try again.');
      }

      allExercises.push(...exercises);
    }

    // Validate: keep only well-formed exercises
    const valid = allExercises.filter((e) => {
      if (!e.word || !['mc', 'cloze', 'sentence'].includes(e.type)) return false;
      if (e.type === 'mc') {
        return !!e.mcPrompt && !!e.mcCorrect && Array.isArray(e.mcOptions) && e.mcOptions.length >= 2;
      }
      if (e.type === 'cloze') {
        return !!e.clozeSentence && Array.isArray(e.clozeBlankWords) && e.clozeBlankWords.length > 0;
      }
      return !!e.sentenceGerman && !!e.sentenceNative;
    });

    if (valid.length < config.words.length) {
      throw new Error('AI could not generate complete exercises. Try again.');
    }

    return valid;
  }

  async generatePrepositionExercise(
    ruleId: string,
    ruleName: string,
    rulePrepositions: string[],
    knownWords: string[],
    level: DifficultyLevel
  ): Promise<GeneratedPrepositionExercise> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const wordsList =
      knownWords.length > 0
        ? knownWords.slice(0, 40).join(', ')
        : 'common German words';
    const prepositionsList = rulePrepositions.join(', ');

    const prompt = `You are a German language teacher. Generate ONE German sentence that practices this grammar rule:
Rule: "${ruleName}"
Relevant prepositions: ${prepositionsList}

Respond with JSON only (no markdown) using exactly these fields:
- "sentenceWithBlank": the full German sentence where the preposition is replaced by "___" (e.g. "Ich warte ___ den Bus."). The blank must ONLY replace the preposition, not the article after it.
- "correctPreposition": the preposition that fills the blank (lowercase, e.g. "auf")
- "correctCase": the grammatical case this preposition governs, exactly one of "accusative", "dative", "genitive", "nominative"
- "hintEn": the English translation of the full sentence (the blank as "(preposition)")
- "hintRu": the Russian translation of the full sentence (the blank as "(предлог)")
- "explanation": a short English explanation of WHY this preposition + case is used here, including a note if the preposition is omitted or different in Russian
- "options": an array of exactly 4 strings of possible prepositions including the correct one (e.g. ["auf", "an", "mit", "für"])

Rules:
- The sentence must be natural and realistic for CEFR level ${level}.
- Keep the sentence concise (5-15 words).
- Prioritize using words from this list: ${wordsList}
- Use a preposition from the listed relevant prepositions.
- The blank MUST exactly replace a single preposition word (including contractions if applicable like "im", "am", "zum").
- The options array must be 4 items and include the correct preposition.
- The explanation should highlight when the preposition is invisible/different in Russian (e.g. "warten auf" = «ждать» with no preposition in Russian).
- Respond with valid JSON only.`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: Partial<GeneratedPrepositionExercise>;
    try {
      parsed = JSON.parse(jsonText) as Partial<GeneratedPrepositionExercise>;
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const validCases = ['accusative', 'dative', 'genitive', 'nominative'];
    const correctCase = validCases.includes(parsed.correctCase ?? '')
      ? (parsed.correctCase as GeneratedPrepositionExercise['correctCase'])
      : 'accusative';

    return {
      sentenceWithBlank: parsed.sentenceWithBlank ?? '',
      correctPreposition: (parsed.correctPreposition ?? '').trim(),
      correctCase,
      hintEn: parsed.hintEn ?? '',
      hintRu: parsed.hintRu ?? '',
      explanation: parsed.explanation ?? '',
      options:
        Array.isArray(parsed.options) && parsed.options.length === 4
          ? parsed.options.map((o) => String(o).trim())
          : [this.extractPrepositionFromBlank(parsed.sentenceWithBlank ?? ''), 'an', 'in', 'für'],
    };
  }

  /** Best-effort extraction of the preposition from a blanked sentence like "Ich warte ___ den Bus." */
  private extractPrepositionFromBlank(sentence: string): string {
    // We cannot know the correct preposition; fall back to a common one.
    return 'auf';
  }

  // ── DECLENSION EXERCISES ──

  /**
   * Generate declension exercises using AI.
   * The AI creates sentences with blanks targeting article/adjective/noun/phrase declension.
   */
  async generateDeclensionExercises(config: {
    questionType: 'article' | 'adjective' | 'noun' | 'phrase' | 'mixed';
    selectedCases?: string[];
    theme?: string;
    count: number;
  }): Promise<GeneratedDeclensionExercise[]> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const caseFilter = config.selectedCases && config.selectedCases.length > 0
      ? `Only use these German cases: ${config.selectedCases.join(', ')}.`
      : 'Use all four cases (nominative, accusative, dative, genitive).';

    const typeInstruction = config.questionType === 'mixed'
      ? 'Mix all types: articles, adjective endings, noun forms, and full phrases.'
      : config.questionType === 'article'
        ? 'Focus on article declension (der/die/das, ein/eine, kein/keine, mein/meine, dieser/diese/dieses).'
        : config.questionType === 'adjective'
          ? 'Focus on adjective endings (strong, weak, mixed declension).'
          : config.questionType === 'noun'
            ? 'Focus on noun forms (genitive -s/-es, dative plural -n, n-Deklination).'
            : 'Focus on full phrases (article + adjective + noun together).';

    const themeInstruction = config.theme && config.theme.trim()
      ? `All sentences must be about the theme: "${config.theme.trim()}".`
      : 'Vary the themes across sentences.';

    const prompt = `You are a German language teacher. Generate ${config.count} German declension exercises (multiple choice).

Respond with JSON only (no markdown) as an object with a single key "exercises" containing an array of objects. Each object must have exactly these fields:
- "sentenceWithBlank": the German sentence with the target word replaced by "___" (e.g. "Ich sehe ___ Hund." for article exercise, "Ich sehe den groß___ Hund." for adjective exercise)
- "correctAnswer": the correct word or ending that fills the blank (e.g. "den" for article, "großen" for adjective, "Hundes" for noun genitive, "den großen Hund" for phrase)
- "caseReq": the grammatical case required, exactly one of "nominative", "accusative", "dative", "genitive"
- "genderLabel": the gender label, exactly one of "Maskulin", "Feminin", "Neutrum", "Plural"
- "focusType": the type of exercise, exactly one of "article", "adjective", "noun", "phrase"
- "baseForm": (optional) the base form of the word being tested (e.g. "Hund" for noun, "groß" for adjective)
- "hintEn": the English translation of the full sentence (the blank as "___")
- "hintRu": the Russian translation of the full sentence (the blank as "___")
- "explanation": a short English explanation of WHY this is the correct form, referencing the case, gender, and declension rule
- "note": (optional) an additional grammar note or tip
- "options": an array of exactly 4 strings of possible answers including the correct one (e.g. ["den", "dem", "der", "des"])

Rules:
- ${typeInstruction}
- ${caseFilter}
- ${themeInstruction}
- Keep sentences concise (5-12 words) and natural.
- The blank must be exactly one word or one phrase (for phrase exercises).
- For article exercises: blank ONLY the article, not the noun after it.
- For adjective exercises: blank the adjective WITH its ending (e.g. "großen" not just "en").
- For noun exercises: blank ONLY the noun form.
- For phrase exercises: blank the entire phrase (article + adjective + noun).
- The options array must have exactly 4 items and include the correct answer.
- The explanation should be helpful for a language learner.
- Use realistic, everyday German sentences.
- Vary the nouns, adjectives, and sentence structures across exercises.

Generate exactly ${config.count} exercises.

Example format:
{"exercises":[{"sentenceWithBlank":"Ich sehe ___ Hund.","correctAnswer":"den","caseReq":"accusative","genderLabel":"Maskulin","focusType":"article","baseForm":"Hund","hintEn":"I see ___ dog.","hintRu":"Я вижу ___ собаку.","explanation":"'Hund' is masculine. After 'sehen' (to see) we use accusative. Masculine 'der' changes to 'den' in accusative.","note":"Only masculine changes in accusative.","options":["den","dem","der","des"]}]}`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: GeneratedDeclensionExercise[] | { exercises: GeneratedDeclensionExercise[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    const exercises = Array.isArray(parsed)
      ? parsed
      : (parsed as { exercises: GeneratedDeclensionExercise[] }).exercises ?? [];

    if (!Array.isArray(exercises) || exercises.length === 0) {
      throw new Error('AI could not generate exercises. Try again.');
    }

    const validCases = ['nominative', 'accusative', 'dative', 'genitive'];
    const validFocusTypes = ['article', 'adjective', 'noun', 'phrase'];

    return exercises.slice(0, config.count).map((e) => ({
      sentenceWithBlank: e.sentenceWithBlank ?? '',
      correctAnswer: (e.correctAnswer ?? '').trim(),
      caseReq: validCases.includes(e.caseReq ?? '') ? e.caseReq as GeneratedDeclensionExercise['caseReq'] : 'nominative',
      genderLabel: e.genderLabel ?? '',
      focusType: validFocusTypes.includes(e.focusType ?? '') ? e.focusType as GeneratedDeclensionExercise['focusType'] : 'article',
      baseForm: e.baseForm?.trim(),
      hintEn: e.hintEn ?? '',
      hintRu: e.hintRu ?? '',
      explanation: e.explanation ?? '',
      note: e.note?.trim(),
      options: Array.isArray(e.options) && e.options.length >= 2
        ? e.options.map((o) => String(o).trim())
        : [e.correctAnswer ?? ''],
    }));
  }

  /**
   * Verify a user's answer to a declension exercise using AI.
   * Returns detailed feedback including whether the answer is correct and an explanation.
   */
  async verifyDeclensionAnswer(
    userAnswer: string,
    correctAnswer: string,
    context: {
      sentenceWithBlank: string;
      caseReq: string;
      genderLabel: string;
      focusType: string;
      explanation: string;
    }
  ): Promise<DeclensionAnswerResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const prompt = `You are a German language teacher. A student answered a declension exercise. Evaluate their answer.

Respond with JSON only (no markdown) using exactly these fields:
- "correct": boolean — is the student's answer correct?
- "expectedAnswer": string — the correct answer
- "explanation": string — a helpful explanation in English explaining why the answer is right or wrong, referencing the case, gender, and declension rules
- "alternative": string or null — if the student's answer is also acceptable (e.g. alternative form), provide it here. Otherwise null.
- "score": number — 0-100, how accurate the answer is (100 for exact match, partial credit for close answers)

Exercise context:
- Sentence: "${context.sentenceWithBlank}"
- Required case: ${context.caseReq}
- Gender: ${context.genderLabel}
- Focus type: ${context.focusType}
- Correct answer: "${correctAnswer}"

Student's answer: "${userAnswer}"

Rules:
- Be encouraging but honest.
- If the answer is exactly correct, set correct to true and score to 100.
- If the answer is close but has minor errors (e.g. wrong ending, wrong article), set correct to false but give partial score.
- If the answer is completely wrong, set correct to false and score to 0.
- The explanation should teach the student WHY their answer was right or wrong.
- If the student's answer is an acceptable alternative (e.g. "dem" vs "den" in some dialects), set alternative to the student's answer.`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: Partial<DeclensionAnswerResult>;
    try {
      parsed = JSON.parse(jsonText) as Partial<DeclensionAnswerResult>;
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    return {
      correct: parsed.correct ?? false,
      expectedAnswer: parsed.expectedAnswer ?? correctAnswer,
      explanation: parsed.explanation ?? '',
      alternative: parsed.alternative ?? undefined,
      score: parsed.score ?? 0,
    };
  }

  /**
   * Generates speech audio for the given text using the selected TTS model.
   *
   * All models (Microsoft MAI, Google Gemini, Fish Audio) use the dedicated
   * /audio/speech endpoint and return raw MP3 bytes (converted to a base64
   * data URL).
   */
  async generateSpeech(
    text: string,
    options: { model: string; voice: string }
  ): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    if (options.model.startsWith('microsoft/') || options.model.startsWith('fish-audio/')) {
      return this.generateSpeechAudioEndpoint(text, options.model, options.voice, 'mp3');
    }
    if (options.model.startsWith('google/')) {
      return this.generateSpeechAudioEndpoint(text, options.model, options.voice, 'pcm');
    }
    throw new Error(`Unsupported TTS model: ${options.model}`);
  }

  /** TTS via the dedicated /audio/speech endpoint (Microsoft MAI, Google Gemini, Fish Audio). */
  private async generateSpeechAudioEndpoint(
    text: string,
    model: string,
    voice: string,
    responseFormat: 'mp3' | 'pcm' = 'mp3'
  ): Promise<string> {
    const apiKey = this.getApiKey();

    const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: responseFormat,
      }),
    });

    if (!response.ok) {
      await this.throwAudioError(response, 'TTS');
    }

    // Response is raw audio bytes — convert to a base64 data URL for caching.
    const blob = await response.blob();

    if (responseFormat === 'pcm') {
      // Gemini returns raw PCM (24kHz, 16-bit, mono). Wrap in a WAV container.
      const arrayBuffer = await blob.arrayBuffer();
      const pcmData = new Int16Array(arrayBuffer);
      const wavBlob = this.encodePcmToWav(pcmData, 24000);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to encode audio data.'));
        reader.readAsDataURL(wavBlob);
      });
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to encode audio data.'));
      reader.readAsDataURL(blob);
    });
  }

  /** Wraps raw 16-bit PCM samples in a WAV container. */
  private encodePcmToWav(samples: Int16Array, sampleRate: number): Blob {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = samples.byteLength;
    const headerSize = 44;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true);  // PCM format
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // PCM samples
    new Int16Array(buffer, headerSize, samples.length).set(samples);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  private async throwAudioError(response: Response, label: string): Promise<never> {
    // OpenRouter wraps provider errors as {"error":{"message":"...","code":502}}.
    // Surfacing that message is far more actionable than a bare status code.
    let providerMessage = '';
    try {
      const body = await response.json();
      const raw = body?.error?.message;
      if (typeof raw === 'string' && raw.trim().length > 0) {
        providerMessage = raw.trim();
      }
    } catch {
      // No JSON body — fall through to status-based handling.
    }

    if (providerMessage) {
      throw new Error(`${label} failed: ${providerMessage}`);
    }

    if (response.status === 401) {
      throw new Error('API key rejected. Check your OpenRouter key.');
    }
    if (response.status === 402) {
      throw new Error('OpenRouter account has insufficient credits for TTS.');
    }
    if (response.status === 404) {
      throw new Error(
        `TTS model or voice not found (${label}). Try another model or voice.`
      );
    }
    if (response.status === 429) {
      throw new Error('Rate limit reached. Try again in a moment.');
    }
    if (response.status === 502 || response.status === 503) {
      throw new Error(
        `TTS provider error (${response.status}). The selected voice may not be available for this model — try another voice.`
      );
    }
    throw new Error(`${label} request failed (HTTP ${response.status})`);
  }

  /**
   * Corrects misheard words in live caption text.
   * Parses raw caption text (with timestamps), identifies likely mishearings,
   * and returns corrected text with explanations for each correction.
   */
  async correctCaptions(rawText: string): Promise<{
    correctedText: string;
    corrections: { original: string; corrected: string; explanation: string }[];
    segments: { timestamp: string; text: string }[];
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const prompt = `You are a German language expert. Below is raw live caption text from a German streamer. The captions may contain misheard words (e.g. "stehe" instead of "stelle").

Your task:
1. Parse the text into segments based on timestamps (lines starting with [YYYY-MM-DD HH:MM:SS.mmm]).
2. Identify and correct any misheard or incorrectly transcribed words/phrases.
3. Provide a brief explanation for each correction in English.

Respond with JSON only (no markdown) as an object with these fields:
- "correctedText": the FULL corrected version of the entire caption text, preserving timestamps and line structure
- "corrections": an array of objects, each with:
  - "original": the original misheard word/phrase
  - "corrected": the corrected word/phrase
  - "explanation": a brief English explanation of why the correction was made (e.g. "Misheard 'stehe' as 'stelle' — 'stellen' means 'to put/place'")
- "segments": an array of objects, each with:
  - "timestamp": the timestamp string (e.g. "[2026-08-17 14:57:55.618]")
  - "text": the corrected text for that segment (without the timestamp)

Rules:
- Preserve ALL timestamps exactly as they appear.
- Only correct genuine mishearings or transcription errors. Do NOT change grammar or style.
- If a word is already correct, leave it unchanged.
- The "correctedText" must include all timestamps and line breaks, same as the input.
- Empty array for corrections if no changes are needed.

Raw caption text:
${rawText}`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const finishReason: string | undefined = data.choices?.[0]?.finish_reason;
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('AI returned no result.');
    }

    if (finishReason === 'length') {
      throw new Error(
        'The caption text is too long for the AI to process in one request. Try splitting it into smaller parts.'
      );
    }

    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    let parsed: {
      correctedText?: string;
      corrections?: { original: string; corrected: string; explanation: string }[];
      segments?: { timestamp: string; text: string }[];
    };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    return {
      correctedText: parsed.correctedText ?? rawText,
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      segments: Array.isArray(parsed.segments) ? parsed.segments : [],
    };
  }

  /**
   * Explains the grammar and structure of a selected German text segment.
   * Returns translation, sentence structure breakdown, grammar notes, and word-level explanations.
   */
  async explainGrammar(text: string): Promise<{
    translation: string;
    sentenceStructure: string;
    grammarNotes: string[];
    wordExplanations: { word: string; explanation: string }[];
  }> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const prompt = `You are a German language teacher. A student has selected the following German text and wants a detailed grammar explanation.

Selected text: "${text}"

Respond with JSON only (no markdown) as an object with these fields:
- "translation": the full English translation of the selected text
- "sentenceStructure": a breakdown of the sentence structure in English (e.g. "Main clause with verb in position 2, followed by a subordinate clause with verb at the end", "Question with verb first", "Modal verb construction with infinitive at the end")
- "grammarNotes": an array of strings, each explaining a specific grammar point visible in the text (e.g. "The verb 'stellen' is a weak verb — 'ich stelle' is correct present tense conjugation", "The accusative object 'mein iPad' shows the direct object", "The preposition 'mit' requires the dative case — 'mit Musik' not 'mit Musik'")
- "wordExplanations": an array of objects, each with:
  - "word": the German word (or short phrase)
  - "explanation": a brief explanation including part of speech, meaning, and any relevant grammar (e.g. "stellen — verb, 'to put/place', regular conjugation", "das iPad — noun, neuter, 'the iPad'")

Rules:
- Be thorough but accessible for a language learner.
- Focus on grammar patterns that are visible in the selected text.
- If the text contains multiple sentences, explain each one.
- Include case information for nouns (nominative/accusative/dative/genitive).
- Include verb position information (position 2, end of clause, etc.).
- If the text is a single word, explain its meaning, part of speech, and any grammatical properties.`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settingsService.textModel(),
        messages: [{ role: 'user', content: prompt }],
        ...(this.throughputProviderField()),
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      this.handleError(response);
    }

    const data = await response.json();
    const resultText: string | undefined = data.choices?.[0]?.message?.content;
    if (!resultText) {
      throw new Error('AI returned no result.');
    }

    const jsonMatch = resultText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonText = jsonMatch ? jsonMatch[1] : resultText;

    let parsed: {
      translation?: string;
      sentenceStructure?: string;
      grammarNotes?: string[];
      wordExplanations?: { word: string; explanation: string }[];
    };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('AI returned an invalid response.');
    }

    return {
      translation: parsed.translation ?? '',
      sentenceStructure: parsed.sentenceStructure ?? '',
      grammarNotes: Array.isArray(parsed.grammarNotes) ? parsed.grammarNotes : [],
      wordExplanations: Array.isArray(parsed.wordExplanations) ? parsed.wordExplanations : [],
    };
  }

  private handleError(response: Response): never {
    if (response.status === 401) {
      throw new Error(
        'API key rejected. Check your OpenRouter key at openrouter.ai/keys.'
      );
    }
    if (response.status === 402) {
      this.setCreditError(true);
      throw new Error(
        'OpenRouter account has insufficient credits. Add credits at openrouter.ai.'
      );
    }
    if (response.status === 429) {
      throw new Error('Rate limit reached. Try again in a moment.');
    }
    throw new Error(`AI request failed (HTTP ${response.status})`);
  }
}
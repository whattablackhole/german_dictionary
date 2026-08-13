import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Gender, DifficultyLevel, PartOfSpeech } from '../models/word';

export interface AiSuggestion {
  translationEn: string;
  translationRu: string;
  partOfSpeech: PartOfSpeech;
  gender: Gender | null;
  level: DifficultyLevel;
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
  /** Character ranges in fullSentence that should be blanked (e.g., [{start:4, end:8}]) */
  blankRanges: { start: number; end: number }[];
  /** Whether the blanked part is preceded by an article (der/die/das) */
  hasArticle: boolean;
  level: DifficultyLevel;
  domain: string;
  grammarTopics: string[];
}

const API_KEY_STORAGE = 'german-dictionary-openrouter-key';

@Injectable({ providedIn: 'root' })
export class AiService {
  getApiKey(): string {
    return localStorage.getItem(API_KEY_STORAGE) || environment.openRouterApiKey;
  }

  hasApiKey(): boolean {
    return this.getApiKey().trim().length > 0;
  }

  setApiKey(key: string): void {
    localStorage.setItem(API_KEY_STORAGE, key.trim());
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
        model: environment.openRouterModel,
        messages: [{ role: 'user', content: prompt }],
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
    grammarTopics?: string[]
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
        model: environment.openRouterModel,
        messages: [{ role: 'user', content: prompt }],
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
- "blankRanges": array of { "start": number, "end": number } character index ranges (inclusive start, exclusive end) in fullSentence that must be blanked out. For a noun: blank ONLY the noun, NOT the article. For a separable verb like "abholen" in "Ich hole dich ab": two ranges needed — one for "hole" and one for "ab". The indices are character positions in the fullSentence string.
- "hasArticle": boolean — true ONLY if there is a German article (der/die/das, or declined form like dem/den/ein/eine) immediately before the blanked noun in the sentence
- "level": "${level}"
- "domain": the topic domain (e.g. "Family", "Travel", "Food", "Work", "Nature", "Education", "Technology")
- "grammarTopics": array of strings listing which grammar topics this sentence demonstrates

Rules:
- Each exercise must target exactly one word from this list: ${wordsJson}
- For nouns: blankRanges covers ONLY the noun, never the article. hasArticle is true if an article precedes it.
- For separable verbs: blankRanges covers BOTH parts (the conjugated part and the separable prefix). hasArticle is always false.
- For other verbs/adjectives/adverbs: blankRanges covers the single word. hasArticle is always false.
- Important: two blankRanges does NOT automatically mean gender+noun. hasArticle explicitly tells us whether an article is present before the noun.
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
{"exercises":[{"fullSentence":"...","targetWord":"...","wordHint":"...","blankRanges":[{"start":0,"end":5}],"hasArticle":false,"level":"${level}","domain":"...","grammarTopics":["..."]}]}`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: environment.openRouterModel,
        messages: [{ role: 'user', content: prompt }],
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
        model: environment.openRouterModel,
        messages: [{ role: 'user', content: prompt }],
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

Rules:
- Minor spelling mistakes that don't change meaning should reduce score but not count as errors.
- Wrong articles, wrong verb conjugations, wrong word order are errors.
- Missing words are errors (point to the position where the word should be).
- If the student's input is empty or completely wrong, set correct to false and score to 0.

Correct sentence: "${correctGerman}"
Student's translation: "${userInput}"`;

    const response = await fetch(environment.openRouterApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: environment.openRouterModel,
        messages: [{ role: 'user', content: prompt }],
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
        model: environment.openRouterModel,
        messages: [{ role: 'user', content: prompt }],
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

  async generateSpeechOpenAI(text: string): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'microsoft/mai-voice-2-flash',
        input: text,
        voice: 'de-DE-Klaus:MAI-Voice-2',
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API key rejected. Check your OpenRouter key.');
      }
      if (response.status === 402) {
        throw new Error('OpenRouter account has insufficient credits for TTS.');
      }
      throw new Error(`TTS request failed (HTTP ${response.status})`);
    }

    // Response is raw audio bytes — convert to a base64 data URL for persistence
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to encode audio data.'));
      reader.readAsDataURL(blob);
    });
  }

  private handleError(response: Response): never {
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
}
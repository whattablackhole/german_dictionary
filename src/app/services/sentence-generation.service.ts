import { Injectable } from '@angular/core';
import { AiService, GeneratedSentence } from './ai.service';
import { SentenceCacheService } from './sentence-cache.service';
import { Word, ExampleSentence } from '../models/word';
import { WordService } from './word.service';

@Injectable({ providedIn: 'root' })
export class SentenceGenerationService {
  constructor(
    private readonly aiService: AiService,
    private readonly sentenceCache: SentenceCacheService,
    private readonly wordService: WordService
  ) {}

  /**
   * Generates example sentences for a single word using AI.
   * Caches the result in IndexedDB. Returns the cached sentences
   * if they already exist.
   */
  async generateSentences(word: Word): Promise<ExampleSentence[]> {
    const existing = await this.sentenceCache.getSentences(word.id);
    if (existing) return existing;

    if (!this.aiService.hasApiKey()) {
      throw new Error('No API key set. Add your OpenRouter API key first.');
    }

    // Generate 3 example sentences at the word's level, using the word itself
    const knownWords = [word.german];
    // Add a few more known words for better sentence variety
    const allWords = this.wordService.getWords();
    const extraWords = allWords
      .filter((w) => w.id !== word.id && w.level === word.level)
      .slice(0, 10)
      .map((w) => w.german);
    knownWords.push(...extraWords);

    let result: GeneratedSentence[];
    try {
      result = await this.aiService.generateSentences(
        word.level,
        knownWords,
        3,
        undefined,
        undefined,
        {
          german: word.german,
          partOfSpeech: word.partOfSpeech,
          gender: word.gender,
          pluralForm: word.pluralForm,
          verbType: word.verbType,
          presentThirdPerson: word.presentThirdPerson,
          simplePast: word.simplePast,
          pastParticiple: word.pastParticiple,
        }
      );
    } catch (err) {
      throw new Error(
        `Failed to generate sentences for "${word.german}": ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }

    // Map AI response to our simple ExampleSentence model
    const examples: ExampleSentence[] = result.map((s) => ({
      german: s.german,
      translationEn: s.translationEn,
      translationRu: s.translationRu,
    }));

    // Cache in IndexedDB
    await this.sentenceCache.storeSentences(word.id, examples);

    return examples;
  }
}
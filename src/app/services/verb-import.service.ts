import { Injectable } from '@angular/core';
import { GermanVerbEntry } from '../data/german-verbs';
import { Word } from '../models/word';
import { normalizeGermanText } from '../utils/german';
import { AiService } from './ai.service';
import { WordService } from './word.service';

export type VerbImportStatus = 'new' | 'loading' | 'in-dictionary';

/**
 * Lazy ("on-demand") import of the ~2000 German verbs from the catalog.
 *
 * A verb only gets AI-enriched and added to the dictionary when the user
 * actually starts learning or training it — no bulk background runs and no
 * thousands of API calls at page load. Concurrent requests for the same verb
 * share a single in-flight promise, so double-clicks cannot create duplicates.
 */
@Injectable({ providedIn: 'root' })
export class VerbImportService {
  private readonly inFlight = new Map<string, Promise<Word | null>>();

  constructor(
    private readonly aiService: AiService,
    private readonly wordService: WordService
  ) {}

  /** Finds a verb in the dictionary by its lemma (case/ß-insensitive). */
  findInDictionary(infinitive: string): Word | undefined {
    const target = normalizeGermanText(infinitive);
    return this.wordService.getWords().find((w) => {
      if (normalizeGermanText(w.german) === target) return true;
      if (w.infinitive && normalizeGermanText(w.infinitive) === target) return true;
      return false;
    });
  }

  /** 'in-dictionary' → 'loading' → 'new' for a catalog entry. */
  getStatus(entry: GermanVerbEntry): VerbImportStatus {
    if (this.findInDictionary(entry.infinitive)) return 'in-dictionary';
    if (this.inFlight.has(entry.infinitive)) return 'loading';
    return 'new';
  }

  /** Lazily ensures the verb exists in the dictionary. Reuses in-flight work. */
  async ensureVerbInDictionary(entry: GermanVerbEntry): Promise<Word | null> {
    const existing = this.findInDictionary(entry.infinitive);
    if (existing) return existing;

    const running = this.inFlight.get(entry.infinitive);
    if (running) return running;

    const promise = this.analyzeAndAdd(entry);
    this.inFlight.set(entry.infinitive, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(entry.infinitive);
    }
  }

  private async analyzeAndAdd(entry: GermanVerbEntry): Promise<Word | null> {
    const suggestion = await this.aiService.analyzeWord(entry.infinitive);
    if (!suggestion.translationEn) {
      throw new Error(`AI returned no data for "${entry.infinitive}".`);
    }

    const isVerb = suggestion.partOfSpeech === 'verb';
    const dictionaryWord =
      isVerb && suggestion.infinitive ? suggestion.infinitive : entry.infinitive;

    // A parallel import may have won the race while we waited on the AI.
    const raced = this.findInDictionary(dictionaryWord);
    if (raced) return raced;

    this.wordService.addWord({
      german: dictionaryWord,
      partOfSpeech: suggestion.partOfSpeech,
      gender: suggestion.gender,
      translationEn: suggestion.translationEn,
      translationRu: suggestion.translationRu || suggestion.translationEn,
      level: suggestion.level,
      mastery: 0,
      usageCount: 0,
      verbType: isVerb ? suggestion.verbType : undefined,
      infinitive: isVerb ? (suggestion.infinitive ?? dictionaryWord) : undefined,
      presentThirdPerson: isVerb ? suggestion.presentThirdPerson : undefined,
      simplePast: isVerb ? suggestion.simplePast : undefined,
      pastParticiple: isVerb ? suggestion.pastParticiple : undefined,
    });

    return this.findInDictionary(dictionaryWord) ?? null;
  }
}
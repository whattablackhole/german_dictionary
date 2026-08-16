import { Injectable } from '@angular/core';
import { AiService, AiSuggestion } from './ai.service';
import { WordService } from './word.service';

export interface DuolingoImportResult {
  added: number;
  skipped: number;
  errors: string[];
  total: number;
}

export interface ParsedDuolingoEntry {
  german: string;
  translationRu: string;
}

export interface ImportProgress {
  currentChunk: number;
  totalChunks: number;
  processedWords: number;
  totalWords: number;
}

@Injectable({ providedIn: 'root' })
export class DuolingoImportService {
  private readonly DELAY_MS = 200;

  constructor(
    private aiService: AiService,
    private wordService: WordService
  ) {}

  /**
   * Parse raw Duolingo text into {german, translationRu} pairs.
   * Format: "GermanWord - RussianTranslation" per line.
   * Lines without " - " separator are skipped (category headers, noise).
   */
  parseRawText(raw: string): ParsedDuolingoEntry[] {
    const entries: ParsedDuolingoEntry[] = [];
    const lines = raw.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Find the first " - " separator
      const separatorIndex = trimmed.indexOf(' - ');
      if (separatorIndex === -1) continue; // skip lines without separator

      const german = trimmed.substring(0, separatorIndex).trim();
      const translationRu = trimmed.substring(separatorIndex + 3).trim();

      if (!german || !translationRu) continue;

      entries.push({ german, translationRu });
    }

    return entries;
  }

  /**
   * Filter out words that already exist in the vocabulary (case-insensitive).
   */
  filterExisting(entries: ParsedDuolingoEntry[]): ParsedDuolingoEntry[] {
    const existingGerman = new Set(
      this.wordService.getWords().map((w) => w.german.toLowerCase())
    );
    return entries.filter((e) => !existingGerman.has(e.german.toLowerCase()));
  }

  /**
   * Import Duolingo words: parse, filter existing, classify via AI in batches, add to vocab.
   * @param rawText pasted Duolingo text
   * @param chunkSize number of words per AI request (default 10)
   * @param onProgress optional callback fired after each chunk completes
   * Returns a summary of what was added, skipped, and any errors.
   */
  async importWords(
    rawText: string,
    chunkSize = 10,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<DuolingoImportResult> {
    const allEntries = this.parseRawText(rawText);
    const newEntries = this.filterExisting(allEntries);
    const skipped = allEntries.length - newEntries.length;
    const errors: string[] = [];

    if (newEntries.length === 0) {
      return { added: 0, skipped, errors, total: allEntries.length };
    }

    const totalChunks = Math.ceil(newEntries.length / chunkSize);
    let added = 0;

    // Process in chunks
    for (let i = 0; i < newEntries.length; i += chunkSize) {
      const currentChunk = Math.floor(i / chunkSize) + 1;
      const chunk = newEntries.slice(i, i + chunkSize);
      const germanWords = chunk.map((e) => e.german);

      const progress: ImportProgress = {
        currentChunk,
        totalChunks,
        processedWords: i,
        totalWords: newEntries.length,
      };
      onProgress?.(progress);

      try {
        const suggestions = await this.aiService.analyzeWordsBatch(germanWords);

        for (let j = 0; j < chunk.length; j++) {
          const entry = chunk[j];
          const suggestion = suggestions[j];

          if (!suggestion || !suggestion.translationEn) {
            errors.push(`AI returned no data for "${entry.german}"`);
            continue;
          }

          const wordData: Parameters<typeof this.wordService.addWord>[0] = {
            german: entry.german,
            translationEn: suggestion.translationEn,
            // Use the Duolingo Russian translation (user's input) as priority
            translationRu: entry.translationRu,
            partOfSpeech: suggestion.partOfSpeech,
            gender: suggestion.gender,
            level: suggestion.level,
            mastery: 0,
            usageCount: 0,
          } as any;

          // Add optional verb/noun fields
          if (suggestion.verbType) (wordData as any).verbType = suggestion.verbType;
          if (suggestion.infinitive) (wordData as any).infinitive = suggestion.infinitive;
          if (suggestion.presentThirdPerson) (wordData as any).presentThirdPerson = suggestion.presentThirdPerson;
          if (suggestion.simplePast) (wordData as any).simplePast = suggestion.simplePast;
          if (suggestion.pastParticiple) (wordData as any).pastParticiple = suggestion.pastParticiple;
          if (suggestion.pluralForm) (wordData as any).pluralForm = suggestion.pluralForm;
          if (suggestion.pluralFormation) (wordData as any).pluralFormation = suggestion.pluralFormation;

          this.wordService.addWord(wordData as any);

          added++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(
          `Chunk ${currentChunk} failed: ${message}`
        );
      }

      // Report progress after chunk completes (including failures)
      onProgress?.({
        currentChunk,
        totalChunks,
        processedWords: Math.min(i + chunk.length, newEntries.length),
        totalWords: newEntries.length,
      });

      // Small delay between chunks to avoid rate limiting
      if (i + chunkSize < newEntries.length) {
        await this.delay(this.DELAY_MS);
      }
    }

    return { added, skipped, errors, total: allEntries.length };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
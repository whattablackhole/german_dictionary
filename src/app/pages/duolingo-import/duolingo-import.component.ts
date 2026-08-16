import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  DuolingoImportService,
  DuolingoImportResult,
  ParsedDuolingoEntry,
  ImportProgress,
} from '../../services/duolingo-import.service';
import { AiService } from '../../services/ai.service';

@Component({
  selector: 'app-duolingo-import',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './duolingo-import.component.html',
  styleUrls: ['./duolingo-import.component.scss'],
})
export class DuolingoImportComponent {
  rawText = signal('');
  isImporting = signal(false);
  progress = signal('');
  result = signal<DuolingoImportResult | null>(null);
  hasApiKey = false;

  /** Chunk size control */
  chunkSize = signal(10);
  readonly chunkSizeOptions = [5, 10, 15, 20, 25, 50];

  /** Real-time progress */
  importProgress = signal<ImportProgress | null>(null);

  /** Preview of parsed entries (shown before import) */
  previewEntries = signal<ParsedDuolingoEntry[]>([]);
  previewSkippedLines = signal(0);

  constructor(
    private importService: DuolingoImportService,
    private aiService: AiService
  ) {
    this.hasApiKey = this.aiService.hasApiKey();
  }

  onTextChange(value: string): void {
    this.rawText.set(value);
    this.result.set(null);

    // Update preview
    if (value.trim()) {
      const lines = value.split('\n').filter((l) => l.trim().length > 0);
      const parsed = this.importService.parseRawText(value);
      this.previewEntries.set(parsed);
      this.previewSkippedLines.set(lines.length - parsed.length);
    } else {
      this.previewEntries.set([]);
      this.previewSkippedLines.set(0);
    }
  }

  onChunkSizeChange(value: string): void {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      this.chunkSize.set(num);
    }
  }

  async startImport(): Promise<void> {
    const text = this.rawText().trim();
    if (!text) return;

    this.isImporting.set(true);
    this.progress.set('Parsing text...');
    this.result.set(null);
    this.importProgress.set(null);

    try {
      const parsed = this.importService.parseRawText(text);
      const filtered = this.importService.filterExisting(parsed);
      const totalChunks = Math.ceil(filtered.length / this.chunkSize());

      this.progress.set(
        `Found ${parsed.length} words, ${parsed.length - filtered.length} already in vocab. ` +
          `Processing ${filtered.length} new words in ${totalChunks} chunks...`
      );

      const result = await this.importService.importWords(
        text,
        this.chunkSize(),
        (p) => {
          this.importProgress.set(p);
          this.progress.set(
            `Chunk ${p.currentChunk}/${p.totalChunks} — ${p.processedWords}/${p.totalWords} words processed`
          );
        }
      );

      this.result.set(result);
      this.progress.set('Import complete!');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.result.set({
        added: 0,
        skipped: 0,
        errors: [message],
        total: 0,
      });
      this.progress.set('Import failed.');
    } finally {
      this.isImporting.set(false);
      this.importProgress.set(null);
    }
  }
}

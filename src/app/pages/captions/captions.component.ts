import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiService } from '../../services/ai.service';
import { CaptionsService } from '../../services/captions.service';
import { CorrectedCaption } from '../../models/captions';
import { GrammarPopupComponent, GrammarPopupData } from './grammar-popup.component';

@Component({
  selector: 'app-captions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './captions.component.html',
  styleUrl: './captions.component.scss',
})
export class CaptionsComponent {
  private readonly aiService = inject(AiService);
  private readonly captionsService = inject(CaptionsService);
  private readonly dialog = inject(MatDialog);

  // Input
  readonly rawInput = signal('');

  // Processing state
  readonly correcting = signal(false);
  readonly aiError = signal('');

  // Current correction result
  readonly currentResult = signal<CorrectedCaption | null>(null);

  // Saved dialogues
  readonly savedCaptions = signal<CorrectedCaption[]>([]);
  readonly loadingSaved = signal(false);

  // Viewing a saved dialogue
  readonly viewingId = signal<string | null>(null);
  readonly viewingCaption = signal<CorrectedCaption | null>(null);

  // Grammar explanation toggle
  readonly grammarMode = signal(false);

  constructor() {
    this.loadSaved();
  }

  async loadSaved(): Promise<void> {
    this.loadingSaved.set(true);
    try {
      const captions = await this.captionsService.getAll();
      this.savedCaptions.set(captions);
    } catch (err) {
      console.error('Failed to load saved captions:', err);
    } finally {
      this.loadingSaved.set(false);
    }
  }

  async correctCaptions(): Promise<void> {
    const text = this.rawInput().trim();
    if (!text) return;

    this.correcting.set(true);
    this.aiError.set('');
    this.currentResult.set(null);

    try {
      const result = await this.aiService.correctCaptions(text);
      const caption: CorrectedCaption = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        rawText: text,
        correctedText: result.correctedText,
        corrections: result.corrections,
        segments: result.segments,
      };
      this.currentResult.set(caption);
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to correct captions.');
    } finally {
      this.correcting.set(false);
    }
  }

  async saveCurrent(): Promise<void> {
    const result = this.currentResult();
    if (!result) return;

    try {
      await this.captionsService.save(result);
      this.currentResult.set(null);
      this.rawInput.set('');
      await this.loadSaved();
    } catch (err) {
      this.aiError.set(err instanceof Error ? err.message : 'Failed to save.');
    }
  }

  discardCurrent(): void {
    this.currentResult.set(null);
    this.aiError.set('');
  }

  viewCaption(id: string): void {
    this.viewingId.set(id);
    this.captionsService.get(id).then((caption) => {
      this.viewingCaption.set(caption ?? null);
    });
  }

  closeView(): void {
    this.viewingId.set(null);
    this.viewingCaption.set(null);
  }

  async deleteCaption(id: string): Promise<void> {
    try {
      await this.captionsService.delete(id);
      if (this.viewingId() === id) {
        this.closeView();
      }
      await this.loadSaved();
    } catch (err) {
      console.error('Failed to delete caption:', err);
    }
  }

  formatDate(ts: number): string {
    return new Date(ts).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  /** Handle alt+click on text in the corrected view */
  onAltClick(event: MouseEvent): void {
    if (!this.grammarMode()) return;
    if (!event.altKey) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selectedText) return;

    event.preventDefault();

    // Open the grammar popup
    const dialogRef = this.dialog.open<
      GrammarPopupComponent,
      GrammarPopupData,
      void
    >(GrammarPopupComponent, {
      data: { selectedText },
      width: '600px',
      maxHeight: '80vh',
      disableClose: false,
    });

    const instance = dialogRef.componentInstance;

    // Call AI for grammar explanation
    this.aiService.explainGrammar(selectedText).then(
      (explanation) => {
        instance.setResult(explanation);
      },
      (err) => {
        instance.setError(err instanceof Error ? err.message : 'Failed to analyze grammar.');
      }
    );
  }
}
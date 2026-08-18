import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GrammarExplanation } from '../../models/captions';

export interface GrammarPopupData {
  selectedText: string;
}

@Component({
  selector: 'app-grammar-popup',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>Grammar Explanation</h2>
    <mat-dialog-content>
      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="32" />
          <p>Analyzing grammar...</p>
        </div>
      } @else if (error()) {
        <div class="error-container">
          <mat-icon color="warn">error</mat-icon>
          <p>{{ error() }}</p>
        </div>
      } @else if (explanation(); as exp) {
        <div class="selected-text">
          <strong>Selected text:</strong>
          <blockquote>{{ data.selectedText }}</blockquote>
        </div>

        <div class="section">
          <h3>
            <mat-icon>translate</mat-icon>
            Translation
          </h3>
          <p>{{ exp.translation }}</p>
        </div>

        <div class="section">
          <h3>
            <mat-icon>account_tree</mat-icon>
            Sentence Structure
          </h3>
          <p>{{ exp.sentenceStructure }}</p>
        </div>

        @if (exp.grammarNotes.length > 0) {
          <div class="section">
            <h3>
              <mat-icon>school</mat-icon>
              Grammar Notes
            </h3>
            <ul>
              @for (note of exp.grammarNotes; track note) {
                <li>{{ note }}</li>
              }
            </ul>
          </div>
        }

        @if (exp.wordExplanations.length > 0) {
          <div class="section">
            <h3>
              <mat-icon>menu_book</mat-icon>
              Word Explanations
            </h3>
            <div class="word-list">
              @for (item of exp.wordExplanations; track item.word) {
                <div class="word-item">
                  <span class="word">{{ item.word }}</span>
                  <span class="word-explanation">{{ item.explanation }}</span>
                </div>
              }
            </div>
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
    .loading-container, .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px;
    }
    .error-container {
      color: var(--mat-warn-color, #f44336);
    }
    .selected-text {
      margin-bottom: 16px;
    }
    .selected-text blockquote {
      margin: 8px 0;
      padding: 8px 12px;
      background: rgba(0,0,0,0.04);
      border-left: 3px solid var(--mat-primary-color, #1976d2);
      border-radius: 4px;
      font-style: italic;
    }
    .section {
      margin-bottom: 20px;
    }
    .section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      margin: 0 0 8px 0;
      color: var(--mat-primary-color, #1976d2);
    }
    .section ul {
      margin: 0;
      padding-left: 20px;
    }
    .section li {
      margin-bottom: 6px;
      line-height: 1.5;
    }
    .word-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .word-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 12px;
      background: rgba(0,0,0,0.02);
      border-radius: 6px;
      border: 1px solid rgba(0,0,0,0.08);
    }
    .word {
      font-weight: 600;
      font-size: 15px;
      color: var(--mat-primary-color, #1976d2);
    }
    .word-explanation {
      font-size: 13px;
      color: rgba(0,0,0,0.7);
      line-height: 1.4;
    }
    `,
  ],
})
export class GrammarPopupComponent {
  readonly data: GrammarPopupData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<GrammarPopupComponent>);

  readonly explanation = signal<GrammarExplanation | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  /** Called by the parent component to set the result after AI call completes */
  setResult(explanation: GrammarExplanation): void {
    this.explanation.set(explanation);
    this.loading.set(false);
  }

  setError(msg: string): void {
    this.error.set(msg);
    this.loading.set(false);
  }
}
import { Component } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { SettingsService, TtsEngine } from '../../services/settings.service';
import { BackupService } from '../../services/backup.service';
import { TranslationLanguage } from '../../models/word';

@Component({
  selector: 'app-settings',
  imports: [MatRadioModule, MatSlideToggleModule, MatCardModule, MatSelectModule, MatFormFieldModule, MatButtonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly languages: { key: TranslationLanguage; label: string }[] = [
    { key: 'ru', label: 'Russian' },
    { key: 'en', label: 'English' },
  ];

  backupStatus: string | null = null;
  backupError: string | null = null;

  constructor(
    readonly settingsService: SettingsService,
    private readonly backupService: BackupService
  ) {}

  setLanguage(language: TranslationLanguage): void {
    this.settingsService.setTranslationLanguage(language);
  }

  toggleShowArticle(show: boolean): void {
    this.settingsService.setShowArticleInPractice(show);
  }

  setTtsEngine(engine: TtsEngine): void {
    this.settingsService.setTtsEngine(engine);
  }

  onExport(): void {
    this.backupService.exportBackup();
    this.backupStatus = 'Backup file downloaded. Store it somewhere safe.';
    this.backupError = null;
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const confirmed = window.confirm(
      'This will overwrite all current app data (words, sentences, stories, notes, settings, API key) with the backup contents. Continue?'
    );
    if (!confirmed) {
      input.value = '';
      return;
    }

    this.backupService.importBackup(file).then((result) => {
      if (result.ok) {
        this.backupStatus = 'Data restored successfully. Reloading...';
        this.backupError = null;
        setTimeout(() => window.location.reload(), 1200);
      } else {
        this.backupError = result.error;
        this.backupStatus = null;
      }
      input.value = '';
    });
  }
}

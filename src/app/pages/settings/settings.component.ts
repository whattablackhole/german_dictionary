import { Component } from '@angular/core';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SettingsService, TtsEngine } from '../../services/settings.service';
import { TranslationLanguage } from '../../models/word';

@Component({
  selector: 'app-settings',
  imports: [MatRadioModule, MatSlideToggleModule, MatCardModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  readonly languages: { key: TranslationLanguage; label: string }[] = [
    { key: 'ru', label: 'Russian' },
    { key: 'en', label: 'English' },
  ];

  constructor(readonly settingsService: SettingsService) {}

  setLanguage(language: TranslationLanguage): void {
    this.settingsService.setTranslationLanguage(language);
  }

  toggleShowArticle(show: boolean): void {
    this.settingsService.setShowArticleInPractice(show);
  }

  setTtsEngine(engine: TtsEngine): void {
    this.settingsService.setTtsEngine(engine);
  }
}

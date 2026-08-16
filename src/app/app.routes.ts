import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'review',
    pathMatch: 'full',
  },
  {
    path: 'review',
    loadComponent: () =>
      import('./pages/review/review.component').then((m) => m.ReviewComponent),
  },
  {
    path: 'game',
    loadComponent: () =>
      import('./pages/game/game.component').then((m) => m.GameComponent),
  },
  {
    path: 'manage',
    loadComponent: () =>
      import('./pages/manage/manage.component').then((m) => m.ManageComponent),
  },
  {
    path: 'exercise',
    loadComponent: () =>
      import('./pages/exercise/exercise.component').then(
        (m) => m.ExerciseComponent
      ),
  },
  {
    path: 'practice-word',
    loadComponent: () =>
      import('./pages/practice-word/practice-word.component').then(
        (m) => m.PracticeWordComponent
      ),
  },
  {
    path: 'grammar-notes',
    loadComponent: () =>
      import('./pages/grammar-notes/grammar-notes.component').then(
        (m) => m.GrammarNotesComponent
      ),
  },
  {
    path: 'stories',
    loadComponent: () =>
      import('./pages/stories/stories.component').then(
        (m) => m.StoriesComponent
      ),
  },
  {
    path: 'sentence-builder',
    loadComponent: () =>
      import('./pages/sentence-builder/sentence-builder.component').then(
        (m) => m.SentenceBuilderComponent
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then(
        (m) => m.SettingsComponent
      ),
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./pages/duolingo-import/duolingo-import.component').then(
        (m) => m.DuolingoImportComponent
      ),
  },
  {
    path: 'prepositions',
    loadComponent: () =>
      import('./pages/preposition-trainer/preposition-trainer.component').then(
        (m) => m.PrepositionTrainerComponent
      ),
  },
  {
    path: 'declension',
    loadComponent: () =>
      import('./pages/declension-trainer/declension-trainer.component').then(
        (m) => m.DeclensionTrainerComponent
      ),
  },
];

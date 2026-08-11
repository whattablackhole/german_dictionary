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
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then(
        (m) => m.SettingsComponent
      ),
  },
];

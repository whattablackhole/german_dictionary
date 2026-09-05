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
    path: 'stories/:storyId',
    loadComponent: () =>
      import('./pages/stories/stories.component').then(
        (m) => m.StoriesComponent
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
    path: 'stories-exercises',
    loadComponent: () =>
      import('./pages/story-exercises/story-exercises.component').then(
        (m) => m.StoryExercisesComponent
      ),
  },
  {
    path: 'story-questions',
    loadComponent: () =>
      import('./pages/story-questions/story-questions.component').then(
        (m) => m.StoryQuestionsComponent
      ),
  },
  {
    path: 'story-cloze',
    loadComponent: () =>
      import('./pages/story-cloze/story-cloze.component').then(
        (m) => m.StoryClozeComponent
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
    path: 'diary',
    loadComponent: () =>
      import('./pages/diary/diary.component').then((m) => m.DiaryComponent),
  },
  {
    path: 'verbs',
    loadComponent: () =>
      import('./pages/verbs/verbs.component').then((m) => m.VerbsComponent),
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
  {
    path: 'captions',
    loadComponent: () =>
      import('./pages/captions/captions.component').then(
        (m) => m.CaptionsComponent
      ),
  },
  {
    path: 'review-session',
    loadComponent: () =>
      import('./pages/review-session/review-session.component').then(
        (m) => m.ReviewSessionComponent
      ),
  },
];

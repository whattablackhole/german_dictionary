# GermanDictionary

An interactive German language learning application built with [Angular CLI](https://github.com/angular/angular-cli) version 22.1.3.

## Features

- **Word Management** — Add, edit, and organize German vocabulary with translations, parts of speech, gender, verb forms, and difficulty levels
- **AI-Powered Analysis** — Uses OpenRouter AI to analyze German words (translation, gender, part of speech, verb conjugation types, CEFR level)
- **Sentence Generation** — Generate practice sentences at your CEFR level (A1-C1) with specific word types and grammar topics
- **Fill-in-the-Blank Exercises** — AI-generated cloze exercises targeting specific words with smart blank ranges (nouns exclude articles, separable verbs split into two blanks); supports forced word selection and adjustable sentence count
- **Translation Verification** — Get AI feedback on your translations with error highlighting and scoring
- **Local Translation** — Optional LibreTranslate integration for on-the-fly translations
- **Text-to-Speech** — Multiple TTS options:
  - **Browser SpeechSynthesis** — free, works offline
  - **Microsoft MAI-Voice-2 Flash** — fast German TTS with the Klaus voice via OpenRouter (requires API key with credits)
  - **Google Gemini 3.1 Flash TTS** — premium TTS with 70+ languages, 200+ inline audio tags for emotion/pacing, supports up to 2 speakers, 30 voices (Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat) (requires API key with credits)
  - **Fish Audio S2.1 Pro (Free)** — free TTS for testing and prototyping
  - Audio is cached in IndexedDB to avoid re-generating repeated phrases
- **Story Generator** — Generate cohesive German stories with AI, listen with word-by-word highlighting, progress slider, speed control, and pause/resume; includes search filters (theme, level, word types, grammar topics, sentence count)
- **Word Lookup Mode** — Click any word in a story to see its translation, part of speech, verb forms, hear pronunciation, and add to dictionary (conjugated verbs auto-convert to infinitive)
- **Grammar Notes** — AI-generated grammar explanations with examples and related topics
- **Sentence Builder** — Practice writing German sentences by picking a grammar pattern and building sentences from your word box, with:
  - AI feedback on word order, pattern correctness, and vocabulary usage (conjugated forms of known verbs are accepted)
  - Mastery tracking per grammar pattern with a progress bar
  - One-click add unknown words to your vocabulary with AI classification
  - Smart normalization — verbs auto-convert to their infinitive (e.g., "hat" → "haben") and declined forms to their base form (e.g., "seine" → "sein")
  - Confirmation dialog with per-word checkboxes and duplicate detection (checks verb forms already in vocabulary)
  - Per-pattern history stored in localStorage
- **Diary** — Freestyle German writing with AI feedback:
  - Corrections with character-level highlighting (original → corrected with explanation)
  - Full corrected version of your entry
  - Study suggestions and a rough CEFR level estimate
  - Follow-up questions (German + English) that you can click to use as the next entry
  - Unknown word detection with one-click add to vocabulary
  - Entry history stored in localStorage, with expandable details and delete
- **Preposition Trainer** — AI-generated multiple-choice exercises for German prepositions with case selection (accusative/dative/genitive), hints in English/Russian, and rule explanations
- **Declension Trainer** — AI-generated declension exercises for articles, adjective endings, nouns, and full phrases across all four cases, with AI-verified answers
- **Word Practice** — Practice words with cloze-style sentence completion (optionally forced to selected words)
- **Review** — Flashcard-style review of learned words with mastery tracking
- **Word Matching Game** — Match German words with their translations in a timed game
- **Duolingo Import** — Import vocabulary from a Duolingo export file
- **Backup & Export** — Export/import all app data (vocabulary, stories, diary, grammar notes, sentence history) as a JSON backup
- **Settings** — Configure translation language (English/Russian), article display, TTS engine, and AI API key

## Prerequisites

- [Node.js](https://nodejs.org/) (v22 or later recommended)
- npm (comes with Node.js)
- (Optional) [LibreTranslate](https://libretranslate.com/) for local translation

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Get an OpenRouter API Key

The application uses OpenRouter AI to analyze words, generate sentences, create stories, verify translations, and provide diary feedback. You need an API key:

1. Go to [openrouter.ai/keys](https://openrouter.ai/keys)
2. Sign up or log in
3. Create a new API key
4. Add credits to your OpenRouter account

### 3. Configure Your API Key

There are two ways to set the API key:

#### Option A: Via the Application UI (Recommended)

1. Start the development server: `ng serve`
2. Open the app in your browser
3. Go to the **Settings** page
4. Paste your OpenRouter API key into the **AI Assistant** field
5. The key is stored in your browser's localStorage and persists between sessions

#### Option B: Via Environment Configuration

Edit `src/environments/environment.ts` and set `openRouterApiKey` to your key.

> **Warning:** Do not commit your API key to version control. The `.env` file (see below) is gitignored and can hold your local configuration.

### 4. (Optional) Start LibreTranslate

For inline translations, you can run LibreTranslate locally:

```bash
libretranslate --host 127.0.0.1 --port 5000
```

The app will automatically detect the running service and enable translation features.

> You can change the LibreTranslate URL in `src/environments/environment.ts` or `.env`.

## Environment Variables (`.env`)

The `.env` file at the project root documents the default configuration values:

```env
# OpenRouter AI Configuration
NG_APP_OPENROUTER_API_KEY=your-key-here
NG_APP_OPENROUTER_MODEL=deepseek/deepseek-v4-flash
NG_APP_OPENROUTER_API_URL=https://openrouter.ai/api/v1/chat/completions

# LibreTranslate Configuration
NG_APP_LIBRETRANSLATE_URL=http://localhost:5000/translate
```

Edit `.env` to override defaults for your local environment. This file is ignored by Git.

## Development Server

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The application automatically reloads when you modify source files.

## Build

```bash
ng build
```

Build artifacts are stored in the `dist/` directory.

## Running Tests

```bash
ng test
```

Uses the [Vitest](https://vitest.dev/) test runner.

## Project Structure

```
src/
├── app/
│   ├── models/           # Data models (Word, Story, GrammarNote, SentencePattern, PrepositionRule, CaseDeclension, Diary)
│   ├── pages/            # Page components
│   │   ├── review/             # Flashcard review with mastery tracking
│   │   ├── game/               # Word matching game
│   │   ├── exercise/           # Fill-in-the-blank exercises
│   │   ├── practice-word/      # Word practice with cloze sentences
│   │   ├── sentence-builder/   # Practice writing sentences with grammar patterns
│   │   ├── diary/              # Freestyle German writing diary with AI feedback
│   │   ├── grammar-notes/      # AI-generated grammar explanations
│   │   ├── stories/            # AI story generator with TTS playback
│   │   ├── preposition-trainer/ # AI-generated preposition exercises
│   │   ├── declension-trainer/  # AI-generated declension exercises
│   │   ├── duolingo-import/    # Import vocabulary from Duolingo exports
│   │   ├── manage/             # Word CRUD management
│   │   └── settings/           # Settings (API key, language, TTS engine)
│   ├── pipes/            # Custom pipes (markdown rendering)
│   ├── services/         # Application services
│   │   ├── ai.service.ts            # OpenRouter AI integration
│   │   ├── translation.service.ts   # LibreTranslate integration
│   │   ├── speech.service.ts        # Text-to-speech (browser + word boundary events)
│   │   ├── word.service.ts          # Word data management (localStorage)
│   │   ├── story.service.ts         # Story data management (localStorage)
│   │   ├── diary.service.ts         # Diary entry management (localStorage)
│   │   ├── grammar-notes.service.ts # Grammar notes management (localStorage)
│   │   ├── sentence-pattern.service.ts # Pattern history & mastery tracking
│   │   ├── settings.service.ts      # User settings (language, TTS, article display)
│   │   ├── backup.service.ts        # Export/import all app data as JSON
│   │   ├── tts-cache.service.ts     # IndexedDB audio cache for TTS
│   │   └── ...
│   ├── app.ts            # Root component
│   └── app.config.ts     # Angular app configuration
├── environments/         # Environment configuration
│   └── environment.ts    # Non-sensitive defaults (model, URLs)
└── styles.scss           # Global styles
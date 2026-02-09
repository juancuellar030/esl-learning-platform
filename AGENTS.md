# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

```bash
# Start local development server (port 8080)
node server.js
# Then open http://127.0.0.1:8080/ in browser

# Alternative: Open index.html directly in browser (no server needed for most features)
```

No build system, package manager, or transpilation is used. This is a pure client-side application.

## Architecture Overview

### Module System
The application uses a vanilla JavaScript module pattern where each major feature is a global singleton object. Modules expose themselves on `window` for cross-module communication.

**Core Modules** (loaded in index.html):
- `App` (js/app.js) - Navigation, section management, lesson save/load orchestration
- `VocabModule` (js/vocabulary.js) - Vocabulary bank with category filtering, word selection, exercise generation
- `GrammarModule` (js/grammar.js) - Grammar rule display and annotation tools
- `DictionaryModule` (js/dictionary.js) - English-Spanish dictionary search
- `VirtualBoardModule` (js/virtualboard.js) - Canvas-based drawing board with tools and zoom

**Standalone Pages**:
- `practice.html` + `PracticeModule` (js/practice.js) - Exercise modes (flashcards, matching, wordsearch, crossword, unjumble)
- `board.html` - Full-featured virtual whiteboard
- `color-wheel.html` - Interactive color wheel for teaching colors
- `clock-timer.html` - Teaching clock and timer

### Data Architecture
Vocabulary and grammar content are defined in separate data files as global arrays:

- `vocabularyBank` (js/vocabulary-data.js) - Array of word objects with structure:
  ```javascript
  { id, word, spanish, type, icon, category, subcategory, level, definition, example }
  ```

- `grammarBank` (js/grammar-data.js) - Array of grammar rule objects with structure:
  ```javascript
  { id, rule, category, level, explanation, examples, exercises }
  ```

- `quizData`, `timeQuizData`, `mayMightUnjumbleData` (js/quiz-data.js) - Specialized exercise data

### State Persistence
All persistent state uses `localStorage`:
- `vocabLessons`, `grammarLessons`, `boardLessons` - Saved user lessons
- `activeSection`, `activeLibraryTab` - UI navigation state
- `selectedVocabIds` - Vocabulary selection for practice.html

### CSS Architecture
- Main styles in css/styles.css using CSS custom properties for theming
- Color scheme uses CSS variables (--indigo-velvet, --medium-slate-blue, --amber-flame, etc.)
- Dark mode support via `body.dark-mode` class
- Page-specific styles in separate CSS files (css/practice.css, css/planner.css, etc.)

## Key Patterns

### Adding New Vocabulary
Add entries to `vocabularyBank` array in js/vocabulary-data.js. Required fields: `id`, `word`, `spanish`, `category`, `level`. The `icon` field uses Font Awesome class names.

### Adding New Grammar Rules
Add entries to `grammarBank` array in js/grammar-data.js. Custom HTML rendering for specific rules is handled in GrammarModule.showGrammarLesson().

### Exercise Generation Flow
1. User selects words in VocabModule → stored in `selectedWords` array
2. User clicks "Generate Exercise" → stores IDs in localStorage as `selectedVocabIds`
3. practice.html reads IDs and loads matching words from `vocabularyBank`
4. PracticeModule renders appropriate exercise based on `mode` param

### Audio/Speech
Uses Web Speech API for pronunciation. Audio files can optionally be placed in assets/audio/vocabulary/ as {word}.mp3 for higher quality playback.

### Canvas Drawing (VirtualBoardModule)
- Dual canvas system: background canvas + main canvas
- Element-based architecture: drawings stored as element objects in `elements` array
- Supports pan/zoom via transform matrix
- History stack for undo/redo

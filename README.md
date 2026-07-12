# Irodori Vocabulary Studio

Premium offline vocabulary PWA generated from `wordlist_Y.pdf`.

## Run

Open `index.html` directly, or serve the folder for full PWA install/service-worker behavior:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Install

When served from `localhost` or HTTPS, the browser can install the app from the install button in the header or from the browser menu.

## Folder Structure

- `index.html` - app shell and study views
- `style.css` - responsive light/dark UI and print styles
- `script.js` - filters, flashcards, quizzes, writing mode, progress, export, PWA wiring
- `words.json` - extracted vocabulary data from the PDF
- `assets/words-data.js` - offline data wrapper for direct `index.html` opening
- `assets/html2pdf.bundle.min.js` - local print-to-PDF compatible export shim
- `manifest.json` - PWA manifest
- `service-worker.js` - offline cache
- `icons/` - PWA icons
- `fonts/` - optional local font drop-in folder

## Features

- Instant search across Japanese, kana, romaji, Bangla, and English
- Lesson, word type, JLPT, favorite, learned, unlearned, and review filters
- Lesson sidebar with word counts and completion percentage
- Vocabulary cards with Japanese, furigana, romaji, Bangla, English, JLPT, type, accent, examples, audio, favorites, learned state, and review state
- Verb cards with dictionary, masu, te, and past forms
- Flashcard mode
- Quiz mode: multiple choice, typing, meaning, Japanese, random, and lesson quiz
- Writing mode with revealable answer and handwriting practice canvas
- LocalStorage progress: learned words, review words, favorites, quiz history, daily goal, and streak
- Light mode, dark mode, compact cards, large Japanese font, and field visibility settings
- Print/PDF export with A4 portrait, margins, page breaks, and three-column vocabulary layout

## Customization

Edit `style.css` variables at the top to change colors, spacing, typography, and dark-mode values.

Edit `words.json` to adjust meanings, lesson titles, examples, or JLPT levels. If you change `words.json`, regenerate `assets/words-data.js` so direct file opening still works:

```bash
python -c "from pathlib import Path; data=Path('words.json').read_text(encoding='utf-8'); Path('assets/words-data.js').write_text('window.IRODORI_WORDS = '+data+';\\n', encoding='utf-8')"
```

## PDF Export

Use `Export PDF` or `Print`. The local `html2pdf` shim opens the browser print flow using the app's A4 print stylesheet. Choose "Save as PDF" in the print dialog.

## Adding New Lessons

Add new objects to `words.json` with the same fields:

```json
{
  "id": 2000,
  "lesson": 19,
  "lessonTitle": "New lesson",
  "word": "勉強",
  "furigana": "べんきょう",
  "romaji": "benkyou",
  "bangla": "পড়াশোনা",
  "english": "study",
  "type": "Noun",
  "jlpt": "N5",
  "accent": "べんきょう○",
  "exampleSentence": "これは「勉強」です。",
  "banglaExampleTranslation": "এটি 'পড়াশোনা' বোঝাতে ব্যবহার করা হয়।",
  "favorite": false,
  "learned": false,
  "difficulty": "Easy"
}
```

Keep IDs unique, then regenerate `assets/words-data.js`.

## Data Notes

The source PDF provides Japanese, accent/readings, and English. Bangla glosses were generated locally from the extracted English meanings and remain editable in `words.json`.

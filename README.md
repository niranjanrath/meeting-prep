# Meeting Prep

A guided meeting-preparation app that runs entirely in the browser. Pick a meeting type, answer a few focused questions, and get a structured preparation note you can copy, print or export. No backend, no account, no external services. Data is stored locally in IndexedDB.

Built with plain HTML, CSS and JavaScript (ES modules). There is no build step and no dependencies.

## Run it locally

The app uses JavaScript modules, which browsers will not load from a `file://` page. Serve the folder over HTTP with any static server:

```bash
cd meeting-prep

# Python 3 (nothing to install)
python3 -m http.server 8080

# or Node
npx serve .
```

Then open <http://localhost:8080>.

`localhost` counts as a secure context, so clipboard access works. If you host it elsewhere, use HTTPS.

Works in current Chrome, Edge, Firefox and Safari. Private/incognito windows may block IndexedDB; the app then shows a banner and keeps your work only until the tab closes (you can still export).

## Using the app

1. **New** (sidebar): choose a meeting type, then answer the questions one at a time, each on its own screen. The slim progress bar at the top shows where you are; click any segment to jump to that question, or the last one for the review.
2. The **live note** on the right is laid out like a sheet of paper and updates as you type. The section you are answering is highlighted, and clicking any section jumps to its question. On mobile, use the **Wizard / Preview** tabs.
3. **Back / Next** move between steps, **Save** saves immediately (also `Ctrl/Cmd+S`), **Finish** marks the preparation complete. `Ctrl/Cmd+Enter` goes to the next step without leaving the keyboard.
4. **Need ideas?** under each question opens the helpful prompts and an example answer. **Focus** hides the sidebar and preview so only the question is on screen (`Esc` to exit).
5. **Export** menu: copy to clipboard, print, or download a `.txt` file. Progress **autosaves** (about half a second after you stop typing); if you reload or come back later, the unfinished preparation reopens at the step you left.
6. **Saved** (My Preparations): search, filter (draft/complete), reopen, copy, duplicate and delete saved notes. The header search box searches titles and answers.
7. **Templates**: edit the questions of any meeting type, add or reorder questions, or create your own meeting type. "Reset to default" restores a built-in template.
8. **Settings**: initials, "Prepared by" line, theme, omit-empty-sections option, backup/restore (JSON) and delete-all.

Saved preparations keep their own copy of the template they were started with, so editing a template never changes existing notes.

## Project structure

```
index.html
css/styles.css            design tokens (colour, spacing, type scale), light/dark theme, responsive + print
  css/fonts.css             @font-face for the bundled fonts
fonts/                    Inter and Source Serif 4 (variable, self-hosted) + their OFL licences
js/
  app.js                  boot, hash router, header/sidebar
  templates.js            meeting templates (data only) + validation helpers
  wizard.js               wizard state machine, navigation, autosave (no DOM)
  note.js                 builds the note and renders it to text / print HTML
  db.js                   IndexedDB operations (only module that touches indexedDB)
  store.js                settings + template registry (built-in + saved overrides)
  export.js               copy / print / download with fallbacks
  ui.js                   toasts, banner, dialogs
  icons.js, util.js       inline SVG icons, small helpers
  views/
    prep-view.js          wizard + live preview screen
    preps-view.js         My Preparations
    templates-view.js     template list and editor
    settings-view.js      settings and backup
```

## Adding a meeting type or question in code

Everything the wizard shows comes from the template objects in `js/templates.js`. To add a meeting type, add an entry to `DEFAULT_TEMPLATES` and its id to `TEMPLATE_ORDER`:

```js
retro: {
  id: 'retro',
  name: 'Retrospective',            // card title and list name
  fullName: 'Retrospective',        // used in the note title
  tagline: 'What worked, what to change',
  description: 'For team retrospectives.',
  icon: 'users',                    // any name from js/icons.js
  accent: '#16a34a',
  questions: [
    q('wins', 'Wins', 'What went well?', 'circle-check', 'What Went Well',
      'Which things should we keep doing?',                       // description
      'List the wins...',                                        // placeholder
      ['What are we proud of?', 'What saved us time?'],          // helpful prompts
      'Shipping every Friday kept scope small.'),                // example
    // ...more questions
  ],
},
```

No wizard, preview or export code needs to change: steps, progress, the note sections and the review screen are generated from `questions`. You can also do this without code on the **Templates** screen.

## Data and privacy

Everything is stored in your browser's IndexedDB database `meeting-prep` (stores: `preps`, `templates`, `meta`). Nothing is sent to any server. Clearing site data removes it, so use **Settings > Export backup** to keep a copy.

## Error handling

- IndexedDB unavailable or failing: in-memory fallback plus a visible banner and "not saved" status; save errors surface in the footer and a toast.
- Clipboard blocked: falls back to a selectable text dialog.
- File download blocked: shows the text in a dialog to copy.
- Corrupt or missing saved records are skipped or repaired when opened.
- Empty answers show as "(Not answered yet)" in exports, or can be omitted in Settings; Finish warns about empty sections.

## Design notes

- Interface text uses **Inter**; the preparation note uses **Source Serif 4** so it reads like a document. Both are bundled in `fonts/` (SIL Open Font License), so the app needs no network access.
- All colours, spacing (4/8/12/16/24/32/48), radii and the type scale (13/15/17/22/28 px) are CSS variables at the top of `css/styles.css`. Change `--accent` to re-colour the whole app; the dark theme overrides the same variables.

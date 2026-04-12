# Plan: StudyCards

**Status:** In Progress
**Type:** New App

## Goal

Desktop app that combines LLM-powered flashcard generation from Markdown files with FSRS spaced repetition scheduling — drop your notes, generate cards, study smart.

## Stack

| Layer       | Tech                                    |
| ----------- | --------------------------------------- |
| Shell       | Tauri 2                                 |
| Frontend    | React + TypeScript + Vite               |
| UI          | shadcn/ui + Tailwind CSS + Lucide icons |
| Backend     | Rust (Tauri commands)                   |
| Database    | rusqlite + SQLite                       |
| Spaced Rep  | fsrs-rs v5.2.0                          |
| Package mgr | bun                                     |
| Formatting  | prettier (frontend), rustfmt (backend)  |

## Steps

### Phase 1 — Core (MVP)

- [x] Scaffold: Tauri 2 + React + TS + Vite (manual, create-tauri-app needs TTY)
- [x] Project config: prettier, .gitignore, bun scripts (format, lint, build)
- [x] SQLite schema + Rust CRUD: sources, cards, card_states, reviews tables
- [x] FSRS integration: wire fsrs-rs, schedule/review/state-update commands
- [x] File picker: add individual MDs or folders, store as tracked sources
- [x] MD content preview: render selected file content in-app
- [x] Unified LLM client (Rust): OpenAI-compatible interface for Ollama/OpenAI/Gemini/Claude
- [x] Card generation: send MD → LLM → JSON cards → review screen (accept/reject/edit each)
- [x] Library tab: browse all cards, search, filter, inline edit
- [x] Manual card create/edit/delete: add Q/A or cloze cards by hand, delete from library
- [x] Study session: flip card → rate (Again/Hard/Good/Easy) → FSRS schedules next
- [x] Dashboard: cards due today, overdue count, total cards, current streak
- [x] Settings tab: LLM provider config, API keys, model selector, test connection
- [ ] Settings tab: study config (daily limit, retention target, new cards per session)
- [x] Settings tab: appearance (dark/light/system theme)
- [x] Help tab: basic usage guide, keyboard shortcuts reference
- [x] Nav: Dashboard | Library | Generate | Study | Settings | Help

### Phase 2 — Polish

- [ ] Rule-based card generator (fallback, no LLM): headers→topics, bold→cloze, lists→enumeration
- [ ] File watcher: detect MD changes in tracked folders, prompt re-scan
- [ ] Model recommender panel: Ollama models with VRAM estimates and install commands
- [ ] Stats/graphs: retention over time, cards per source, review heatmap
- [ ] Card meaning-hash (Blake3): edit source text without resetting FSRS progress
- [ ] `/frontend-design` pass on study session + dashboard views
- [ ] Keyboard shortcuts: 1-4 for ratings, Space to flip, arrow keys to navigate
- [ ] Session summary: cards reviewed, accuracy %, time spent

### Phase 3 — Extras

- [ ] Self-update (Tauri updater plugin)
- [ ] Anki .apkg import
- [ ] Export to Anki format (for mobile study)
- [ ] Claude Code skill: `/generate-cards <file>` for Max subscribers
- [ ] Bulk card generation: queue multiple MDs, process sequentially with progress
- [ ] Card tags/decks: organize cards beyond source file grouping

### Final Checks

- [ ] `/deslop` — clean AI artifacts before release
- [ ] `/autoloop` — optimize key metrics (binary size, startup time, study session responsiveness)
- [ ] `/audit-project` — full code review pass

## Architecture

```
┌────────────────────────── Tauri Window ───────────────────────────┐
│                                                                    │
│  React Frontend (Vite + shadcn/ui + Tailwind)                     │
│  ┌──────────┐ ┌───────┐ ┌────────┐ ┌─────┐ ┌────────┐ ┌──────┐ │
│  │Dashboard │ │Library│ │Generate│ │Study│ │Settings│ │ Help │ │
│  └────┬─────┘ └───┬───┘ └───┬────┘ └──┬──┘ └───┬────┘ └──────┘ │
│       └────────────┴─────────┴─────────┴────────┘                 │
│                         invoke()                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Rust Backend (Tauri Commands)                                    │
│  ┌────────────┐ ┌──────────┐ ┌────────┐ ┌───────────────────┐   │
│  │ MD Parser  │ │ FSRS     │ │ SQLite │ │ LLM Client        │   │
│  │ & Watcher  │ │ fsrs-rs  │ │rusqlite│ │ ├─ Ollama (local) │   │
│  └────────────┘ └──────────┘ └────────┘ │ ├─ OpenAI         │   │
│                                          │ ├─ Claude API     │   │
│  ┌────────────────────────────────┐     │ ├─ Gemini         │   │
│  │ Rule-Based Generator (Ph.2)   │     │ └─ Custom URL     │   │
│  │ headers/bold/lists → cards    │     └───────────────────────┘ │
│  └────────────────────────────────┘                               │
└────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
CREATE TABLE sources (
    id          INTEGER PRIMARY KEY,
    path        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    content_hash TEXT,
    last_scanned TEXT,
    is_folder   INTEGER DEFAULT 0
);

CREATE TABLE cards (
    id           INTEGER PRIMARY KEY,
    source_id    INTEGER REFERENCES sources(id) ON DELETE SET NULL,
    type         TEXT NOT NULL CHECK(type IN ('qa', 'cloze')),
    front        TEXT NOT NULL,
    back         TEXT NOT NULL,
    meaning_hash TEXT NOT NULL UNIQUE,
    tags         TEXT DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    manual       INTEGER DEFAULT 0
);

CREATE TABLE card_states (
    card_id     INTEGER PRIMARY KEY REFERENCES cards(id) ON DELETE CASCADE,
    stability   REAL NOT NULL DEFAULT 0,
    difficulty  REAL NOT NULL DEFAULT 0,
    due_date    TEXT NOT NULL DEFAULT (datetime('now')),
    status      TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'learning', 'review', 'relearning')),
    last_review TEXT
);

CREATE TABLE reviews (
    id          INTEGER PRIMARY KEY,
    card_id     INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 4),
    elapsed_days REAL NOT NULL,
    reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## LLM Provider Config

```
Providers (all use OpenAI-compatible chat/completions where possible):
├── Ollama     → http://localhost:11434/v1  (auto-detect on startup)
├── OpenAI     → https://api.openai.com/v1
├── Claude     → https://api.anthropic.com  (thin adapter for messages API)
├── Gemini     → https://generativelanguage.googleapis.com/v1beta/openai (compat mode)
└── Custom     → user-defined base URL + key

Keys stored via tauri-plugin-store with OS keychain backend.
```

## Card Generation Prompt

```
System: You are a flashcard generator. Extract key concepts from the provided
text and create study cards.

Rules:
- Mix of Q/A and cloze deletion cards
- Each card tests ONE concept
- Focus: definitions, relationships, processes, key facts
- Skip trivial content (section titles, dates alone, metadata)
- Cloze: hide the KEY term, not filler words
- Return valid JSON array, nothing else

Format:
[
  {"type": "qa", "question": "...", "answer": "..."},
  {"type": "cloze", "text": "The [hidden term] does X...", "answer": "hidden term"}
]
```

## Local Model Recommendations (≤8GB VRAM)

| Model                | VRAM  | Notes                                            |
| -------------------- | ----- | ------------------------------------------------ |
| Qwen 2.5 7B Q4       | ~5 GB | Best structured JSON output, recommended default |
| Llama 3.1 8B Q4      | ~5 GB | Most popular, well-tested                        |
| Mistral 7B v0.3 Q4   | ~5 GB | Good instruction following                       |
| Gemma 2 9B Q4        | ~6 GB | Slightly better quality, tighter VRAM fit        |
| Phi-3.5 mini 3.8B Q4 | ~3 GB | Minimum viable, fast but lower quality           |

Show these in Settings → Local Models panel with `ollama pull <model>` copy buttons.

## Settings Tab Layout

```
LLM Provider
├── Provider dropdown (Ollama / OpenAI / Claude / Gemini / Custom)
├── API key field (masked)
├── Model selector (auto-populated from provider)
├── Test connection button
│
Local Models (visible when Ollama selected)
├── Detected models list (from ollama list)
├── Recommended models with VRAM + install command
│
Study
├── Daily review limit (default: unlimited)
├── New cards per session (default: 20)
├── Target retention % (default: 90)
│
Appearance
├── Theme (dark / light / system)
```

## Decisions

| Decision          | Choice                           | Why                                                       |
| ----------------- | -------------------------------- | --------------------------------------------------------- |
| Name              | StudyCards                       | User choice                                               |
| GUI-Template      | Skipped                          | User waived — Tauri+React, not PyQt6                      |
| FSRS location     | Rust backend                     | Native crate, no WASM overhead                            |
| Card storage      | SQLite only                      | Cards not written back into source MDs                    |
| Key storage       | tauri-plugin-store + OS keychain | Not plaintext config                                      |
| Versioning        | X.XX format                      | Cross-project convention                                  |
| Package manager   | bun                              | Project standard                                          |
| Default LLM model | Qwen 2.5 7B                      | Best structured output for card gen at ≤8GB VRAM          |
| Card browsing     | Library tab, separate from Study | Users can view cards without affecting FSRS state         |
| Manual cards      | Supported                        | Create/edit/delete cards by hand alongside generated ones |

## Research Gotchas

- **fsrs-rs pulls `burn` ML framework** — first compile ~3 min, normal after
- **Learning step caps needed** — FSRS gives aggressive early intervals. Implement Repeater-style caps (review 1: max 1 min, review 2: pass=10min/fail=1min, review 3: pass=1day/fail=10min, 4+: trust FSRS)
- **Tailwind v4** — CSS-first config, no `tailwind.config.js`. Use `@tailwindcss/vite` plugin
- **Claude API different** — needs custom adapter (system msg handling, auth headers, response format). Other 3 providers share OpenAI-compat format
- **JSON extraction** — LLMs sometimes wrap JSON in markdown fences. Always strip before parsing
- **rusqlite `!Send`** — use `Mutex<Connection>`, not Arc. `unchecked_transaction()` for batch ops through mutex
- **WSL2 deps needed** — `libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev`
- **Tauri capabilities** — must whitelist LLM API URLs in capabilities JSON for HTTP access
- Full reference: `docs/REFERENCE.md`

## Errors

| Error | Attempt | Resolution |
| ----- | ------- | ---------- |
| `http:default` not a valid Tauri permission | Capabilities referenced non-existent plugin | Removed — HTTP calls via reqwest from Rust, not frontend |
| FSRS::default() doesn't exist | Research said it did | Use `FSRS::new(None)` instead |
| `to_latest(&conn)` needs `&mut` | rusqlite_migration v2.5 API | Changed to `let mut conn` |
| MutexGuard not Send across await | std::sync::Mutex in async commands | Switched LlmState to `tokio::sync::Mutex` |
| Icons not RGBA | Generated RGB PNGs | Regenerated with RGBA (color type 6) |
| TS6 deprecation: baseUrl | TypeScript 6 removed baseUrl | Added `ignoreDeprecations: "6.0"` to tsconfig |
| CSS import not found by tsc | Strict TS can't find .css modules | Added `src/vite-env.d.ts` with CSS module declaration |

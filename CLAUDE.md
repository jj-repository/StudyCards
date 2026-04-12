# StudyCards

Tauri 2 desktop flashcard app — LLM-powered card generation from Markdown + FSRS spaced repetition.

## Quick Resume

Read `PLAN.md` for full plan, status, decisions, and errors log.
Read `docs/REFERENCE.md` for tech reference (APIs, patterns, gotchas).

## Stack

| Layer       | Tech                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| Shell       | Tauri 2                                                                  |
| Frontend    | React 19 + TypeScript + Vite 8                                           |
| UI          | Tailwind v4 (CSS-first, no config file) + Lucide icons                   |
| Backend     | Rust (Tauri commands)                                                    |
| Database    | rusqlite 0.39 (bundled) + rusqlite_migration 2.5                         |
| Spaced Rep  | fsrs-rs 5.2.0 (pulls burn ML framework — slow first compile)             |
| LLM         | reqwest → Ollama/OpenAI/Gemini (OpenAI-compat) + Claude (custom adapter) |
| Package mgr | bun (never npm)                                                          |

## Project Structure

```
src/                    # React frontend
  App.tsx               # Router + layout
  main.tsx              # Entry point
  index.css             # Tailwind v4 theme (OKLCH vars)
  components/           # Sidebar, ThemeProvider
  features/             # Dashboard, Library, Generate, Study, Settings, Help
  lib/utils.ts          # cn() helper
src-tauri/              # Rust backend
  src/lib.rs            # Tauri builder + command registration
  src/commands/          # Tauri commands (sources, cards, study, llm_cmds)
  src/db/               # SQLite schema, models, queries
  src/fsrs_engine/      # FSRS scheduler with learning-step caps
  src/llm/              # LlmProvider trait, OpenAI-compat + Claude providers
  capabilities/         # Tauri permission config
  tauri.conf.json       # App config
```

## Build & Run

```bash
bun run tauri dev       # dev mode (Vite HMR + Rust)
bun run tauri build     # release build → src-tauri/target/release/studycards
cargo check             # check Rust only (from src-tauri/)
bun run build           # check frontend only (tsc + vite build)
```

## Key Patterns

- **LlmState** uses `tokio::sync::Mutex` (not std) — needed for async Tauri commands
- **DbState** uses `std::sync::Mutex<Connection>` — rusqlite is !Send
- Batch inserts use `conn.unchecked_transaction()` (takes &self through Mutex)
- FSRS learning-step caps: review 1→10min max, review 2→10min, review 3→1day, 4+→trust FSRS
- Frontend theme: CSS vars in `:root`/`.dark`, toggled via class on `<html>`
- TypeScript 6: needs `ignoreDeprecations: "6.0"` in tsconfig for baseUrl

## Conventions

- Versioning: X.XX display format (v0.01)
- Package manager: bun only
- Formatting: prettier (frontend), rustfmt (backend) — auto-format hooks active
- Rust: clippy pedantic, no unwrap in production paths

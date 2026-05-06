# StudyCards

Desktop flashcard app. Generate cards from Markdown with AI, study with FSRS spaced repetition.

## Features

- **AI Card Generation** — Drop a Markdown file, pick an LLM, get flashcards (Q/A + cloze deletion)
- **FSRS Scheduling** — Same algorithm family as modern Anki. Cards appear right before you'd forget them
- **Multiple LLM Providers** — Ollama (free, local), OpenAI, Gemini (free tier), Claude
- **Manual Cards** — Create, edit, delete cards by hand alongside generated ones
- **Study Config** — Daily review limit, new cards per session, target retention %
- **Dark Theme** — Warm, focused interface designed for late-night study sessions

## Stack

| Layer      | Tech                           |
| ---------- | ------------------------------ |
| Shell      | Tauri 2                        |
| Frontend   | React 19 + TypeScript + Vite 8 |
| UI         | Tailwind v4 + Lucide icons     |
| Backend    | Rust                           |
| Database   | SQLite (rusqlite)              |
| Spaced Rep | fsrs-rs 5.2                    |

## Building from Source

Requires: Rust, Node.js, [bun](https://bun.sh), and [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/jj-repository/StudyCards.git
cd StudyCards
bun install
bun run tauri build
```

The binary is at `src-tauri/target/release/studycards`.

## Usage

1. **Settings** — Configure an LLM provider (Ollama recommended for local/free)
2. **Generate** — Open a Markdown file, click Generate, review cards, save
3. **Study** — Flip cards, rate recall (Again/Hard/Good/Easy), FSRS handles scheduling
4. **Library** — Browse, search, edit, or manually create cards

Keyboard shortcuts during study: `Space` to flip, `1-4` to rate.

## License

[MIT](LICENSE)

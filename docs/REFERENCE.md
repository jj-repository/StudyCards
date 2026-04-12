# StudyCards — Technical Reference

Research findings for implementation. Read before coding each component.

## Tauri 2

### Scaffold

```bash
bun create tauri-app
# Select: project name, identifier, TypeScript, bun, React
```

Structure: `src/` (React/Vite), `src-tauri/` (Rust). Dev: `bun run tauri dev`.

### Commands Pattern

```rust
// Rust
#[tauri::command]
async fn get_cards(db: tauri::State<'_, DbState>) -> Result<Vec<Card>, String> { ... }

// Register
.invoke_handler(tauri::generate_handler![get_cards])
```

```typescript
// TypeScript
import { invoke } from "@tauri-apps/api/core";
const cards = await invoke<Card[]>("get_cards");
```

Args auto-convert camelCase (JS) ↔ snake_case (Rust). Return types need `serde::Serialize`.

### Plugins Needed

```toml
# src-tauri/Cargo.toml
tauri-plugin-dialog = "2"
tauri-plugin-store = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-updater = "2"
```

Register in builder:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
```

### Capabilities (src-tauri/capabilities/default.json)

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "store:default",
    "fs:default",
    "shell:default",
    {
      "identifier": "http:default",
      "allow": [
        { "url": "http://localhost:11434/**" },
        { "url": "https://api.openai.com/**" },
        { "url": "https://api.anthropic.com/**" },
        { "url": "https://generativelanguage.googleapis.com/**" }
      ]
    }
  ]
}
```

### State Management

```rust
pub struct DbState(pub Mutex<Connection>);

// In setup:
app.manage(DbState(Mutex::new(conn)));

// In commands:
fn my_cmd(db: tauri::State<'_, DbState>) -> Result<T, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
}
```

### WSL2 Prerequisites

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libssl-dev libxdo-dev build-essential
```

### Build

```bash
bun run tauri dev          # development
bun run tauri build        # production (deb/AppImage on Linux)
```

---

## shadcn/ui + Tailwind v4

### Setup (after Tauri scaffold)

```bash
bun add tailwindcss @tailwindcss/vite
bun add -d @types/node
```

`vite.config.ts`:

```typescript
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

`tsconfig.json` + `tsconfig.app.json` — add `baseUrl` + `paths`:

```json
{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"] } } }
```

`src/index.css` — replace with: `@import "tailwindcss";`

```bash
bunx shadcn@latest init    # follow prompts, pick new-york style
```

### Components to Add

```bash
bunx shadcn@latest add button card dialog input textarea select tabs table badge progress tooltip switch separator scroll-area dropdown-menu command sheet alert-dialog sidebar field sonner checkbox skeleton
```

### Layout: Sidebar Navigation

Use `Sidebar` component (`collapsible="icon"`). Structure:

```
SidebarProvider > Sidebar + SidebarInset
  Sidebar: SidebarHeader + SidebarContent (SidebarGroup > SidebarMenu > SidebarMenuItem)
  SidebarInset: header (SidebarTrigger + breadcrumb) + main content
```

### Theme: Dark/Light/System

Custom ThemeProvider (not next-themes). Toggle via `.dark` class on `<html>`. CSS vars in `:root` (light) / `.dark` (dark). Store preference in localStorage.

### Forms: react-hook-form + zod

```bash
bun add react-hook-form @hookform/resolvers zod
```

### Table: @tanstack/react-table

```bash
bun add @tanstack/react-table
```

Provides sorting, filtering, pagination, row selection. Wire to shadcn Table component.

### Key: No tailwind.config.js needed (v4 uses CSS-first config)

---

## fsrs-rs

### Crate

```toml
fsrs = "5.2.0"
```

**Warning:** Pulls in `burn` ML framework. Expect 2-3 min first compile.

### Core API

```rust
use fsrs::{FSRS, MemoryState};

let fsrs = FSRS::default();
let desired_retention = 0.9;

// New card: memory_state = None, days_elapsed = 0
let states = fsrs.next_states(None, 0.9, 0)?;

// Returns: states.again / .hard / .good / .easy
// Each has: .memory (MemoryState { stability, difficulty }) + .interval (f32 days)

// Pick based on user rating:
let chosen = &states.good;
let interval_days = chosen.interval.round().max(1.0) as u32;
let new_state = chosen.memory; // store stability + difficulty
```

### Rating Scale

1=Again (forgot), 2=Hard, 3=Good, 4=Easy

### Learning Step Caps (from Repeater — IMPORTANT)

FSRS can give aggressive intervals early. Cap them:

- Review 1: max 1 min
- Review 2: Pass = 10 min, Fail = 1 min
- Review 3: Pass = 1 day, Fail = 10 min
- Review 4+: trust FSRS

### Per-Card State to Store

```
stability: f32, difficulty: f32, due_date: TEXT, status: TEXT, last_review: TEXT, review_count: i32
```

---

## LLM Client

### Provider Matrix

| Provider | Base URL                                          | Auth                              | JSON mode         | Adapter        |
| -------- | ------------------------------------------------- | --------------------------------- | ----------------- | -------------- |
| Ollama   | `localhost:11434/v1`                              | None                              | `response_format` | OpenAI-compat  |
| OpenAI   | `api.openai.com/v1`                               | `Bearer`                          | `response_format` | OpenAI-compat  |
| Gemini   | `generativelanguage.googleapis.com/v1beta/openai` | `Bearer`                          | `response_format` | OpenAI-compat  |
| Claude   | `api.anthropic.com/v1`                            | `x-api-key` + `anthropic-version` | Prompt only       | Custom adapter |

3/4 share OpenAI-compatible format. Only Claude needs custom adapter (system msg → top-level field, different auth headers, response content is array).

### Ollama Detection

`GET http://localhost:11434/` → 200 means running. `GET /api/tags` → list models.

### JSON Extraction (handle markdown-wrapped responses)

Strip ` ```json ... ``` ` fences before parsing. Always try direct parse first.

### Gemini Free Tier

15 RPM, 1500 RPD. Get key at https://aistudio.google.com/apikey. Model: `gemini-2.0-flash`.

---

## rusqlite

### Setup

```toml
rusqlite = { version = "0.39", features = ["bundled"] }
rusqlite_migration = "2.5"
```

### Connection in Tauri

`DbState(Mutex<Connection>)` via `tauri::State`. Use `conn.unchecked_transaction()` for batch ops (takes `&self` not `&mut self`).

### PRAGMAs (set at open)

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
```

### Migrations: `rusqlite_migration`

Uses SQLite `user_version` PRAGMA. Add `M::up("SQL")` entries. `migrations.to_latest(&conn)` on startup.

### DB Location

`app.path().app_data_dir().join("studycards.db")` → `~/.local/share/com.studycards.app/` (Linux)

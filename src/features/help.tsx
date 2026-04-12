import { Keyboard, BookOpen, Sparkles, Settings } from "lucide-react";

const SHORTCUTS = [
  { key: "Space / Enter", action: "Flip card" },
  { key: "1", action: "Rate: Again" },
  { key: "2", action: "Rate: Hard" },
  { key: "3", action: "Rate: Good" },
  { key: "4", action: "Rate: Easy" },
];

export function Help() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Help</h1>
        <p className="text-sm text-muted-foreground">
          Getting started with StudyCards
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
          <BookOpen className="h-4 w-4" /> Quick Start
        </h2>
        <div className="rounded-lg border border-border bg-card p-4 space-y-2 text-sm">
          <p>
            <strong>1.</strong> Set up your LLM provider in{" "}
            <strong>Settings</strong> — Ollama (free, local) or a cloud API.
          </p>
          <p>
            <strong>2.</strong> Go to <strong>Generate</strong>, open a Markdown
            file, and click Generate to create flashcards with AI.
          </p>
          <p>
            <strong>3.</strong> Review the generated cards — accept or reject
            each one, then save.
          </p>
          <p>
            <strong>4.</strong> Go to <strong>Study</strong> to start your
            spaced repetition session.
          </p>
          <p>
            <strong>5.</strong> Use <strong>Library</strong> to browse, search,
            edit, or manually create cards.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
          <Sparkles className="h-4 w-4" /> Spaced Repetition
        </h2>
        <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <p>
            StudyCards uses the <strong>FSRS</strong> algorithm (same family as
            modern Anki) to schedule your reviews optimally.
          </p>
          <p>
            Cards you struggle with appear more often. Cards you know well space
            out to days or weeks. The system targets <strong>90% recall</strong>{" "}
            — you see each card right before you'd forget it.
          </p>
          <p>Rating guide:</p>
          <ul className="ml-4 space-y-1">
            <li>
              <strong className="text-red-400">Again (1)</strong> — Forgot
              completely
            </li>
            <li>
              <strong className="text-orange-400">Hard (2)</strong> — Recalled
              with difficulty
            </li>
            <li>
              <strong className="text-blue-400">Good (3)</strong> — Recalled
              correctly
            </li>
            <li>
              <strong className="text-green-400">Easy (4)</strong> — Instant
              recall
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
          <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
        </h2>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="space-y-1">
            {SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm">{s.action}</span>
                <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
          <Settings className="h-4 w-4" /> LLM Providers
        </h2>
        <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-2">
          <p>
            <strong>Ollama</strong> — Free, runs locally. Install from{" "}
            ollama.com, then pull a model like{" "}
            <code className="rounded bg-muted px-1 text-xs">
              ollama pull qwen2.5:7b
            </code>
          </p>
          <p>
            <strong>Gemini</strong> — Free tier (1500 requests/day). Get an API
            key from Google AI Studio.
          </p>
          <p>
            <strong>OpenAI</strong> — Paid. gpt-4o-mini recommended for card
            generation.
          </p>
          <p>
            <strong>Claude</strong> — Paid. Requires API key from
            console.anthropic.com.
          </p>
        </div>
      </section>
    </div>
  );
}

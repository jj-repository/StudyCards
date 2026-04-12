const SHORTCUTS = [
  { key: "Space", action: "Flip card" },
  { key: "1", action: "Again" },
  { key: "2", action: "Hard" },
  { key: "3", action: "Good" },
  { key: "4", action: "Easy" },
];

export function Help() {
  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Help</h1>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick Start
        </h2>
        <div className="rounded-lg bg-card p-4 space-y-3 text-sm leading-relaxed">
          <p>
            <span className="text-muted-foreground">1.</span> Configure your LLM
            provider in Settings — Ollama runs free and local.
          </p>
          <p>
            <span className="text-muted-foreground">2.</span> Open a Markdown
            file in Generate and let AI create flashcards.
          </p>
          <p>
            <span className="text-muted-foreground">3.</span> Review generated
            cards, accept or reject, then save.
          </p>
          <p>
            <span className="text-muted-foreground">4.</span> Study shows due
            cards. Rate each to schedule the next review.
          </p>
          <p>
            <span className="text-muted-foreground">5.</span> Library lets you
            browse, search, edit, or create cards by hand.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Spaced Repetition
        </h2>
        <div className="rounded-lg bg-card p-4 text-sm space-y-3 leading-relaxed">
          <p>
            StudyCards uses <strong>FSRS</strong> (same algorithm family as
            modern Anki) to schedule reviews. Cards you struggle with appear
            more often. Cards you know well space out to days or weeks.
          </p>
          <p>
            The system targets <strong>90% recall</strong> — each card appears
            right before you'd forget it.
          </p>
          <div className="space-y-1.5 text-sm">
            <div>
              <span className="text-[oklch(0.60_0.14_25)]">Again</span> — Forgot
              completely
            </div>
            <div>
              <span className="text-[oklch(0.75_0.10_65)]">Hard</span> —
              Recalled with difficulty
            </div>
            <div>
              <span className="text-[oklch(0.65_0.10_240)]">Good</span> —
              Recalled correctly
            </div>
            <div>
              <span className="text-[oklch(0.65_0.10_155)]">Easy</span> —
              Instant recall
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Keyboard Shortcuts
        </h2>
        <div className="rounded-lg bg-card p-4">
          <div className="space-y-1">
            {SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between py-1.5"
              >
                <span className="text-sm">{s.action}</span>
                <kbd className="rounded bg-secondary px-2 py-0.5 text-xs font-mono text-muted-foreground">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          LLM Providers
        </h2>
        <div className="rounded-lg bg-card p-4 text-sm space-y-3 leading-relaxed">
          <p>
            <strong>Ollama</strong> — Free, local. Install from ollama.com, then{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-xs">
              ollama pull qwen2.5:7b
            </code>
          </p>
          <p>
            <strong>Gemini</strong> — Free tier, 1500 requests/day. API key from
            Google AI Studio.
          </p>
          <p>
            <strong>OpenAI</strong> — Paid. gpt-4o-mini recommended.
          </p>
          <p>
            <strong>Claude</strong> — Paid. API key from console.anthropic.com.
          </p>
        </div>
      </section>
    </div>
  );
}

import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  Sparkles,
  Check,
  X,
  Loader2,
  FileText,
} from "lucide-react";

interface GeneratedCard {
  cardType: string;
  question: string | null;
  answer: string | null;
  text: string | null;
}

interface PendingCard extends GeneratedCard {
  accepted: boolean;
}

export function Generate() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [model, setModel] = useState("qwen2.5:7b");
  const [pending, setPending] = useState<PendingCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const pickFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "txt"] }],
    });
    if (selected) {
      const path = typeof selected === "string" ? selected : selected;
      setFilePath(path);
      const text = await invoke<string>("read_source_content", { path });
      setContent(text);
      setPending([]);
      setSaved(false);
      setError("");
    }
  };

  const generate = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    setPending([]);
    setSaved(false);
    try {
      const cards = await invoke<GeneratedCard[]>("generate_cards", {
        content,
        model,
      });
      setPending(cards.map((c) => ({ ...c, accepted: true })));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const saveCards = async () => {
    const accepted = pending.filter((c) => c.accepted);
    if (accepted.length === 0) return;

    let sourceId: number | null = null;
    if (filePath) {
      sourceId = await invoke<number>("add_source", {
        path: filePath,
        isFolder: false,
      });
    }

    await invoke("save_generated_cards", {
      sourceId,
      cards: accepted.map((c) => ({
        type: c.cardType,
        question: c.question,
        answer: c.answer,
        text: c.text,
      })),
    });
    setSaved(true);
  };

  const toggleCard = (idx: number) => {
    setPending((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, accepted: !c.accepted } : c)),
    );
  };

  const acceptedCount = pending.filter((c) => c.accepted).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Generate Cards</h1>
        <p className="text-sm text-muted-foreground">
          Create flashcards from your Markdown files using AI
        </p>
      </div>

      {/* File picker + model */}
      <div className="flex gap-3">
        <button
          onClick={pickFile}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <FolderOpen className="h-4 w-4" />
          {filePath
            ? filePath.split("/").pop() || filePath.split("\\").pop()
            : "Open Markdown File"}
        </button>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model name"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm w-48"
        />
        <button
          onClick={generate}
          disabled={loading || !content.trim()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Generate
        </button>
      </div>

      {/* Content preview */}
      {content && !pending.length && !loading && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Preview</span>
            <span className="text-xs text-muted-foreground">
              {content.length} chars
            </span>
          </div>
          <pre className="max-h-48 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap">
            {content.slice(0, 2000)}
            {content.length > 2000 && "..."}
          </pre>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Generated cards review */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Generated {pending.length} cards — {acceptedCount} accepted
            </span>
            {!saved ? (
              <button
                onClick={saveCards}
                disabled={acceptedCount === 0}
                className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Save {acceptedCount} Cards
              </button>
            ) : (
              <span className="flex items-center gap-1 text-sm text-green-400">
                <Check className="h-4 w-4" /> Saved!
              </span>
            )}
          </div>

          {pending.map((card, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 transition-colors ${
                card.accepted
                  ? "border-border bg-card"
                  : "border-border/50 bg-card/50 opacity-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase text-muted-foreground">
                    {card.cardType}
                  </span>
                  <p className="text-sm font-medium mt-0.5">
                    {card.cardType === "qa" ? card.question : card.text}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.answer}
                  </p>
                </div>
                <button
                  onClick={() => toggleCard(idx)}
                  className={`rounded p-1.5 transition-colors ${
                    card.accepted
                      ? "text-green-400 hover:bg-red-500/20 hover:text-red-400"
                      : "text-muted-foreground hover:bg-green-500/20 hover:text-green-400"
                  }`}
                >
                  {card.accepted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm text-muted-foreground">
            Generating cards...
          </span>
        </div>
      )}
    </div>
  );
}

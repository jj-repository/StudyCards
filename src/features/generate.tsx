import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import {
  FolderOpen,
  Sparkles,
  Check,
  X,
  Loader2,
  FileText,
  RefreshCw,
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

type Mode = "ai" | "rules";

export function Generate() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [model, setModel] = useState("qwen2.5:7b");
  const [mode, setMode] = useState<Mode>("ai");
  const [pending, setPending] = useState<PendingCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [changedFile, setChangedFile] = useState<string | null>(null);

  useEffect(() => {
    const unlisten = listen<string>("source-changed", (event) => {
      setChangedFile(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

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
      let cards: GeneratedCard[];
      if (mode === "rules") {
        cards = await invoke<GeneratedCard[]>("generate_cards_rules", {
          content,
        });
      } else {
        cards = await invoke<GeneratedCard[]>("generate_cards", {
          content,
          model,
        });
      }
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
  const fileName = filePath
    ? filePath.split("/").pop() || filePath.split("\\").pop()
    : null;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Generate</h1>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={pickFile}
          className="flex items-center gap-2 rounded-md bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
        >
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          {fileName || "Open file..."}
        </button>

        {/* Mode toggle */}
        <div className="flex rounded-md bg-card text-sm">
          <button
            onClick={() => setMode("ai")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 transition-colors ${
              mode === "ai"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> AI
          </button>
          <button
            onClick={() => setMode("rules")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 transition-colors ${
              mode === "rules"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="h-3.5 w-3.5" /> Rules
          </button>
        </div>

        {mode === "ai" && (
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model"
            className="rounded-md bg-input px-3 py-2 text-sm w-44 placeholder:text-muted-foreground/50"
          />
        )}

        <button
          onClick={generate}
          disabled={loading || !content.trim()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-40 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : mode === "ai" ? (
            <Sparkles className="h-3.5 w-3.5" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          Generate
        </button>
      </div>

      {/* File change notification */}
      {changedFile && (
        <div className="flex items-center justify-between rounded-md bg-card px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">
            Source changed:{" "}
            <span className="text-foreground">
              {changedFile.split("/").pop()}
            </span>
          </span>
          <button
            onClick={async () => {
              setFilePath(changedFile);
              const text = await invoke<string>("read_source_content", {
                path: changedFile,
              });
              setContent(text);
              setPending([]);
              setSaved(false);
              setChangedFile(null);
            }}
            className="flex items-center gap-1.5 text-primary hover:underline"
          >
            <RefreshCw className="h-3 w-3" /> Re-scan
          </button>
        </div>
      )}

      {mode === "rules" && !pending.length && !loading && (
        <p className="text-xs text-muted-foreground">
          Extracts cards from Markdown structure: headings, bold terms,
          definitions, lists. No LLM needed.
        </p>
      )}

      {/* Content preview */}
      {content && !pending.length && !loading && (
        <div className="rounded-lg bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">
              {content.length} characters
            </span>
          </div>
          <pre className="max-h-48 overflow-auto text-xs text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">
            {content.slice(0, 2000)}
            {content.length > 2000 && "..."}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-[oklch(0.20_0.02_25)] px-4 py-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-3 text-sm text-muted-foreground">
            Generating...
          </span>
        </div>
      )}

      {/* Generated cards review */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {pending.length} generated, {acceptedCount} accepted
            </span>
            {!saved ? (
              <button
                onClick={saveCards}
                disabled={acceptedCount === 0}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-40 transition-colors"
              >
                Save {acceptedCount}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-[oklch(0.72_0.10_155)]">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="space-y-1">
            {pending.map((card, idx) => (
              <div
                key={idx}
                className={`group flex items-start justify-between gap-3 rounded-md px-3 py-2.5 transition-colors ${
                  card.accepted ? "bg-card" : "bg-card/30 opacity-40"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
                    {card.cardType}
                  </span>
                  <p className="text-sm mt-0.5">
                    {card.cardType === "qa" ? card.question : card.text}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {card.answer}
                  </p>
                </div>
                <button
                  onClick={() => toggleCard(idx)}
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {card.accepted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

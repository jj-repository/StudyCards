import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, AlertCircle, Loader2 } from "lucide-react";

type Provider = "ollama" | "openai" | "gemini" | "claude";

interface StudyConfig {
  dailyReviewLimit: number;
  newCardsPerSession: number;
  targetRetention: number;
}

const PROVIDERS: { value: Provider; label: string; needsKey: boolean }[] = [
  { value: "ollama", label: "Ollama (Local)", needsKey: false },
  { value: "openai", label: "OpenAI", needsKey: true },
  { value: "gemini", label: "Gemini (Free tier)", needsKey: true },
  { value: "claude", label: "Claude", needsKey: true },
];

const RECOMMENDED_MODELS = [
  {
    name: "Qwen 2.5 7B",
    cmd: "ollama pull qwen2.5:7b",
    vram: "~5 GB",
    note: "Best for card generation",
  },
  {
    name: "Llama 3.1 8B",
    cmd: "ollama pull llama3.1:8b",
    vram: "~5 GB",
    note: "Most popular",
  },
  {
    name: "Mistral 7B",
    cmd: "ollama pull mistral:7b",
    vram: "~5 GB",
    note: "Good instruction following",
  },
  {
    name: "Phi-3.5 mini",
    cmd: "ollama pull phi3.5:3.8b",
    vram: "~3 GB",
    note: "Lightweight, fast",
  },
];

export function Settings() {
  const [provider, setProvider] = useState<Provider>("ollama");
  const [apiKey, setApiKey] = useState("");
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[]>([]);

  const [studyConfig, setStudyConfig] = useState<StudyConfig>({
    dailyReviewLimit: 0,
    newCardsPerSession: 20,
    targetRetention: 0.9,
  });
  const [studySaved, setStudySaved] = useState(false);

  useEffect(() => {
    invoke<boolean>("detect_ollama")
      .then(setOllamaRunning)
      .catch(() => setOllamaRunning(false));

    invoke<StudyConfig>("get_study_config")
      .then(setStudyConfig)
      .catch(console.error);
  }, []);

  const handleSave = async () => {
    setTestResult(null);
    try {
      await invoke("configure_provider", {
        provider,
        apiKey: apiKey || null,
        baseUrl: null,
      });
      setTestResult("saved");
    } catch (e) {
      setTestResult(`Error: ${e}`);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const ok = await invoke<boolean>("test_connection");
      setTestResult(ok ? "connected" : "failed");
      if (ok) {
        const m = await invoke<string[]>("list_models");
        setModels(m);
      }
    } catch (e) {
      setTestResult(`Error: ${e}`);
    } finally {
      setTesting(false);
    }
  };

  const handleStudySave = async () => {
    setStudySaved(false);
    try {
      await invoke("save_study_config", { config: studyConfig });
      setStudySaved(true);
    } catch (e) {
      console.error(e);
    }
  };

  const currentProvider = PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {/* LLM Provider */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          LLM Provider
        </h2>
        <div className="rounded-lg bg-card p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="mt-1 w-full rounded-md bg-input px-3 py-2 text-sm"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {currentProvider?.needsKey && (
            <div>
              <label className="text-xs text-muted-foreground">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key..."
                className="mt-1 w-full rounded-md bg-input px-3 py-2 text-sm placeholder:text-muted-foreground/50"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              {testing && <Loader2 className="h-3 w-3 animate-spin" />}
              Test connection
            </button>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm ${
                testResult === "connected" || testResult === "saved"
                  ? "text-[oklch(0.72_0.10_155)]"
                  : "text-destructive-foreground"
              }`}
            >
              {testResult === "connected" || testResult === "saved" ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {testResult === "connected"
                ? "Connected"
                : testResult === "saved"
                  ? "Saved"
                  : testResult}
            </div>
          )}

          {models.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">
                Available models
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {models.slice(0, 10).map((m) => (
                  <span
                    key={m}
                    className="rounded bg-secondary px-2 py-0.5 text-xs"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Ollama local models */}
      {provider === "ollama" && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Local Models
          </h2>
          <div className="rounded-lg bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`h-1.5 w-1.5 rounded-full ${ollamaRunning ? "bg-[oklch(0.65_0.10_155)]" : "bg-destructive-foreground"}`}
              />
              Ollama {ollamaRunning ? "running" : "not detected"}
            </div>

            <p className="text-xs text-muted-foreground">
              Recommended for card generation (8 GB VRAM or less):
            </p>
            <div className="space-y-1">
              {RECOMMENDED_MODELS.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <span className="text-sm">{m.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {m.vram}
                    </span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(m.cmd)}
                    className="rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Study Config */}
      <section className="space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Study
        </h2>
        <div className="rounded-lg bg-card p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">
              Daily review limit
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={studyConfig.dailyReviewLimit}
                onChange={(e) =>
                  setStudyConfig((c) => ({
                    ...c,
                    dailyReviewLimit: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-24 rounded-md bg-input px-3 py-2 text-sm tabular-nums"
              />
              <span className="text-xs text-muted-foreground">
                0 = unlimited
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              New cards per session
            </label>
            <input
              type="number"
              min={0}
              value={studyConfig.newCardsPerSession}
              onChange={(e) =>
                setStudyConfig((c) => ({
                  ...c,
                  newCardsPerSession: parseInt(e.target.value) || 0,
                }))
              }
              className="mt-1 w-24 rounded-md bg-input px-3 py-2 text-sm tabular-nums"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              Target retention
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0.5}
                max={0.99}
                step={0.01}
                value={studyConfig.targetRetention}
                onChange={(e) =>
                  setStudyConfig((c) => ({
                    ...c,
                    targetRetention: parseFloat(e.target.value) || 0.9,
                  }))
                }
                className="w-24 rounded-md bg-input px-3 py-2 text-sm tabular-nums"
              />
              <span className="text-xs text-muted-foreground">
                {Math.round(studyConfig.targetRetention * 100)}% — higher = more
                frequent reviews
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleStudySave}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors"
            >
              Save
            </button>
            {studySaved && (
              <span className="flex items-center gap-1.5 text-sm text-[oklch(0.72_0.10_155)]">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Check, AlertCircle, Loader2 } from "lucide-react";

type Provider = "ollama" | "openai" | "gemini" | "claude";

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

  useEffect(() => {
    invoke<boolean>("detect_ollama")
      .then(setOllamaRunning)
      .catch(() => setOllamaRunning(false));
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

  const currentProvider = PROVIDERS.find((p) => p.value === provider);

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your LLM provider and study preferences
        </p>
      </div>

      {/* LLM Provider */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          LLM Provider
        </h2>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
              className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
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
                className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Save
            </button>
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex items-center gap-1 rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              {testing && <Loader2 className="h-3 w-3 animate-spin" />}
              Test Connection
            </button>
          </div>

          {testResult && (
            <div
              className={`flex items-center gap-2 text-sm ${
                testResult === "connected" || testResult === "saved"
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {testResult === "connected" || testResult === "saved" ? (
                <Check className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {testResult === "connected"
                ? "Connected!"
                : testResult === "saved"
                  ? "Saved!"
                  : testResult}
            </div>
          )}

          {models.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">
                Available models:
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
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
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Local Models (Ollama)
          </h2>
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div
                className={`h-2 w-2 rounded-full ${ollamaRunning ? "bg-green-500" : "bg-red-500"}`}
              />
              Ollama {ollamaRunning ? "running" : "not detected"}
            </div>

            <p className="text-xs text-muted-foreground">
              Recommended models for card generation (≤8GB VRAM):
            </p>
            <div className="space-y-1.5">
              {RECOMMENDED_MODELS.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between rounded border border-border/50 px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {m.vram} — {m.note}
                    </span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(m.cmd)}
                    className="rounded px-2 py-1 text-[10px] text-muted-foreground hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

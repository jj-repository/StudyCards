import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Plus,
  Trash2,
  Search,
  Edit,
  FolderOpen,
  Download,
  Upload,
  Tag,
  X,
  Check,
  Loader2,
  ChevronDown,
} from "lucide-react";

interface Card {
  id: number;
  sourceId: number | null;
  cardType: string;
  front: string;
  back: string;
  tags: string;
  deckId: number | null;
  manual: boolean;
  createdAt: string;
  status: string | null;
  reviewCount: number | null;
  dueDate: string | null;
}

interface Deck {
  id: number;
  name: string;
  cardCount: number;
}

const STATUS_STYLE: Record<string, string> = {
  new: "bg-[oklch(0.65_0.10_240_/_0.15)] text-[oklch(0.72_0.10_240)]",
  learning: "bg-[oklch(0.68_0.12_65_/_0.15)] text-[oklch(0.75_0.10_65)]",
  relearning: "bg-[oklch(0.68_0.12_65_/_0.15)] text-[oklch(0.75_0.10_65)]",
  review: "bg-[oklch(0.65_0.10_155_/_0.15)] text-[oklch(0.72_0.10_155)]",
};

export function Library() {
  const [cards, setCards] = useState<Card[]>([]);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [search, setSearch] = useState("");
  const [filterDeck, setFilterDeck] = useState<number | "all">("all");
  const [filterTag, setFilterTag] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newType, setNewType] = useState<"qa" | "cloze">("qa");
  const [editingTags, setEditingTags] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [showDeckCreate, setShowDeckCreate] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [renamingDeck, setRenamingDeck] = useState<number | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [moveMenuCard, setMoveMenuCard] = useState<number | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const loadCards = () => {
    invoke<Card[]>("list_cards").then(setCards).catch(console.error);
  };

  const loadDecks = () => {
    invoke<Deck[]>("list_decks").then(setDecks).catch(console.error);
  };

  useEffect(() => {
    loadCards();
    loadDecks();
  }, []);

  // All unique tags across cards
  const allTags = Array.from(
    new Set(
      cards.flatMap((c) =>
        c.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ),
  ).sort();

  const filtered = cards.filter((c) => {
    const matchesSearch =
      !search ||
      c.front.toLowerCase().includes(search.toLowerCase()) ||
      c.back.toLowerCase().includes(search.toLowerCase());
    const matchesDeck = filterDeck === "all" || c.deckId === filterDeck;
    const matchesTag =
      !filterTag ||
      c.tags
        .split(",")
        .map((t) => t.trim())
        .includes(filterTag);
    return matchesSearch && matchesDeck && matchesTag;
  });

  const handleCreate = async () => {
    if (!newFront.trim() || !newBack.trim()) return;
    await invoke("create_card", {
      cardType: newType,
      front: newFront,
      back: newBack,
    });
    setNewFront("");
    setNewBack("");
    setShowCreate(false);
    loadCards();
    loadDecks();
  };

  const handleUpdate = async () => {
    if (!editCard || !newFront.trim() || !newBack.trim()) return;
    await invoke("update_card", {
      id: editCard.id,
      front: newFront,
      back: newBack,
      cardType: newType,
    });
    setEditCard(null);
    setNewFront("");
    setNewBack("");
    loadCards();
  };

  const handleDelete = async (id: number) => {
    await invoke("delete_card", { id });
    loadCards();
    loadDecks();
  };

  const startEdit = (card: Card) => {
    setEditCard(card);
    setNewFront(card.front);
    setNewBack(card.back);
    setNewType(card.cardType as "qa" | "cloze");
    setShowCreate(false);
  };

  const handleSaveTags = async (cardId: number) => {
    await invoke("update_card_tags", { cardId, tags: tagInput });
    setEditingTags(null);
    setTagInput("");
    loadCards();
  };

  const handleCreateDeck = async () => {
    if (!newDeckName.trim()) return;
    await invoke("create_deck", { name: newDeckName.trim() });
    setNewDeckName("");
    setShowDeckCreate(false);
    loadDecks();
  };

  const handleRenameDeck = async (id: number) => {
    if (!renameInput.trim()) return;
    await invoke("rename_deck", { id, name: renameInput.trim() });
    setRenamingDeck(null);
    setRenameInput("");
    loadDecks();
  };

  const handleDeleteDeck = async (id: number) => {
    await invoke("delete_deck", { id });
    if (filterDeck === id) setFilterDeck("all");
    loadDecks();
    loadCards();
  };

  const handleMoveToDeck = async (cardId: number, deckId: number | null) => {
    await invoke("move_cards_to_deck", {
      cardIds: [cardId],
      deckId,
    });
    setMoveMenuCard(null);
    loadCards();
    loadDecks();
  };

  const handleImportAnki = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Anki Package", extensions: ["apkg"] }],
    });
    if (!selected) return;
    const path = typeof selected === "string" ? selected : selected;
    setImporting(true);
    try {
      const cards = await invoke<
        {
          type: string;
          question: string | null;
          answer: string | null;
          text: string | null;
        }[]
      >("import_anki", { path });
      // Save imported cards directly
      await invoke("save_generated_cards", {
        sourceId: null,
        cards: cards.map((c) => ({
          type: c.type,
          question: c.question,
          answer: c.answer,
          text: c.text,
        })),
      });
      loadCards();
      loadDecks();
    } catch (e) {
      console.error("Import failed:", e);
    } finally {
      setImporting(false);
    }
  };

  const handleExportAnki = async () => {
    const outputPath = await save({
      defaultPath: "studycards_export.apkg",
      filters: [{ name: "Anki Package", extensions: ["apkg"] }],
    });
    if (!outputPath) return;
    setExporting(true);
    try {
      const deckName =
        filterDeck !== "all"
          ? decks.find((d) => d.id === filterDeck)?.name || "StudyCards"
          : "StudyCards";
      await invoke("export_anki", { outputPath, deckName });
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {filtered.length} card{filtered.length !== 1 ? "s" : ""}
            {filterDeck !== "all" || filterTag ? " (filtered)" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Import */}
          <button
            onClick={handleImportAnki}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Import from Anki (.apkg)"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Import
          </button>
          {/* Export */}
          <button
            onClick={handleExportAnki}
            disabled={exporting || cards.length === 0}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
            title="Export to Anki (.apkg)"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export
          </button>
          {/* Add card */}
          <button
            onClick={() => {
              setShowCreate(true);
              setEditCard(null);
              setNewFront("");
              setNewBack("");
              setNewType("qa");
            }}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add card
          </button>
        </div>
      </div>

      {/* Deck bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterDeck("all")}
          className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
            filterDeck === "all"
              ? "bg-secondary text-foreground font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        >
          All ({cards.length})
        </button>
        {decks.map((deck) => (
          <div key={deck.id} className="relative group">
            {renamingDeck === deck.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRenameDeck(deck.id);
                }}
                className="flex items-center gap-1"
              >
                <input
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  className="rounded bg-input px-2 py-0.5 text-xs w-24"
                  autoFocus
                  onBlur={() => setRenamingDeck(null)}
                />
              </form>
            ) : (
              <button
                onClick={() => setFilterDeck(deck.id)}
                onDoubleClick={() => {
                  setRenamingDeck(deck.id);
                  setRenameInput(deck.name);
                }}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  filterDeck === deck.id
                    ? "bg-secondary text-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <FolderOpen className="inline h-3 w-3 mr-1 -mt-0.5" />
                {deck.name} ({deck.cardCount})
              </button>
            )}
            {/* Delete deck on right-click area */}
            <button
              onClick={() => handleDeleteDeck(deck.id)}
              className="absolute -top-1 -right-1 hidden group-hover:flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] text-destructive-foreground"
              title="Delete deck"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {showDeckCreate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateDeck();
            }}
            className="flex items-center gap-1"
          >
            <input
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder="Deck name"
              className="rounded bg-input px-2 py-0.5 text-xs w-24 placeholder:text-muted-foreground/50"
              autoFocus
              onBlur={() => {
                if (!newDeckName.trim()) setShowDeckCreate(false);
              }}
            />
          </form>
        ) : (
          <button
            onClick={() => setShowDeckCreate(true)}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            title="Create deck"
          >
            <Plus className="inline h-3 w-3" />
          </button>
        )}
      </div>

      {/* Create/Edit form */}
      {(showCreate || editCard) && (
        <div className="rounded-lg bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {editCard ? "Edit card" : "New card"}
            </span>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as "qa" | "cloze")}
              className="rounded bg-input border-none px-2 py-1 text-xs"
            >
              <option value="qa">Q/A</option>
              <option value="cloze">Cloze</option>
            </select>
          </div>
          <input
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
            placeholder={
              newType === "qa" ? "Question" : "Text with [hidden] word"
            }
            className="w-full rounded-md bg-input px-3 py-2 text-sm placeholder:text-muted-foreground/50"
          />
          <input
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            placeholder={newType === "qa" ? "Answer" : "Hidden word"}
            className="w-full rounded-md bg-input px-3 py-2 text-sm placeholder:text-muted-foreground/50"
          />
          <div className="flex gap-2">
            <button
              onClick={editCard ? handleUpdate : handleCreate}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/85"
            >
              {editCard ? "Save" : "Create"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setEditCard(null);
              }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search + tag filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cards..."
            className="w-full rounded-md bg-input py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground/50"
          />
        </div>
        {allTags.length > 0 && (
          <div className="relative">
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="appearance-none rounded-md bg-input px-3 py-2 pr-7 text-sm text-muted-foreground"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Card list */}
      <div className="space-y-1">
        {filtered.map((card) => (
          <div
            key={card.id}
            className="group flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-card transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    STATUS_STYLE[card.status || "new"] ||
                    "bg-muted text-muted-foreground"
                  }`}
                >
                  {card.status || "new"}
                </span>
                <span className="text-[10px] text-muted-foreground/60 uppercase">
                  {card.cardType}
                </span>
                {/* Deck badge */}
                {card.deckId && (
                  <span className="text-[10px] text-muted-foreground/40">
                    {decks.find((d) => d.id === card.deckId)?.name}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm truncate">{card.front}</p>
              <p className="text-xs text-muted-foreground truncate">
                {card.back}
              </p>
              {/* Tags */}
              <div className="flex items-center gap-1 mt-1">
                {editingTags === card.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveTags(card.id);
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      ref={tagInputRef}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="tag1, tag2, ..."
                      className="rounded bg-input px-2 py-0.5 text-[11px] w-40 placeholder:text-muted-foreground/40"
                      autoFocus
                      onBlur={() => handleSaveTags(card.id)}
                    />
                  </form>
                ) : (
                  <>
                    {card.tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-[oklch(0.3_0.02_70)] px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    <button
                      onClick={() => {
                        setEditingTags(card.id);
                        setTagInput(card.tags);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground"
                      title="Edit tags"
                    >
                      <Tag className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Move to deck */}
              <div className="relative">
                <button
                  onClick={() =>
                    setMoveMenuCard(moveMenuCard === card.id ? null : card.id)
                  }
                  className="rounded p-1.5 text-muted-foreground hover:text-foreground"
                  title="Move to deck"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </button>
                {moveMenuCard === card.id && (
                  <div className="absolute right-0 top-8 z-10 rounded-md bg-popover border border-border py-1 shadow-lg min-w-[120px]">
                    <button
                      onClick={() => handleMoveToDeck(card.id, null)}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors text-muted-foreground"
                    >
                      No deck
                    </button>
                    {decks.map((deck) => (
                      <button
                        key={deck.id}
                        onClick={() => handleMoveToDeck(card.id, deck.id)}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors ${
                          card.deckId === deck.id
                            ? "text-primary font-medium"
                            : "text-foreground"
                        }`}
                      >
                        {deck.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => startEdit(card)}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(card.id)}
                className="rounded p-1.5 text-muted-foreground hover:text-destructive-foreground"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {cards.length === 0 ? "No cards yet" : "No matching cards"}
          </p>
        )}
      </div>
    </div>
  );
}

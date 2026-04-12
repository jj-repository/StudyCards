import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, Search, Edit } from "lucide-react";

interface Card {
  id: number;
  sourceId: number | null;
  cardType: string;
  front: string;
  back: string;
  tags: string;
  manual: boolean;
  createdAt: string;
  status: string | null;
  reviewCount: number | null;
  dueDate: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  new: "bg-[oklch(0.65_0.10_240_/_0.15)] text-[oklch(0.72_0.10_240)]",
  learning: "bg-[oklch(0.68_0.12_65_/_0.15)] text-[oklch(0.75_0.10_65)]",
  relearning: "bg-[oklch(0.68_0.12_65_/_0.15)] text-[oklch(0.75_0.10_65)]",
  review: "bg-[oklch(0.65_0.10_155_/_0.15)] text-[oklch(0.72_0.10_155)]",
};

export function Library() {
  const [cards, setCards] = useState<Card[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editCard, setEditCard] = useState<Card | null>(null);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newType, setNewType] = useState<"qa" | "cloze">("qa");

  const loadCards = () => {
    invoke<Card[]>("list_cards").then(setCards).catch(console.error);
  };

  useEffect(loadCards, []);

  const filtered = cards.filter(
    (c) =>
      c.front.toLowerCase().includes(search.toLowerCase()) ||
      c.back.toLowerCase().includes(search.toLowerCase()),
  );

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
  };

  const startEdit = (card: Card) => {
    setEditCard(card);
    setNewFront(card.front);
    setNewBack(card.back);
    setNewType(card.cardType as "qa" | "cloze");
    setShowCreate(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {cards.length} card{cards.length !== 1 ? "s" : ""}
          </p>
        </div>
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards..."
          className="w-full rounded-md bg-input py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground/50"
        />
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
              </div>
              <p className="mt-1 text-sm truncate">{card.front}</p>
              <p className="text-xs text-muted-foreground truncate">
                {card.back}
              </p>
            </div>
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

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

  const statusColor = (status: string | null) => {
    switch (status) {
      case "new":
        return "bg-blue-500/20 text-blue-400";
      case "learning":
      case "relearning":
        return "bg-orange-500/20 text-orange-400";
      case "review":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Library</h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} cards total
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
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Add Card
        </button>
      </div>

      {/* Create/Edit form */}
      {(showCreate || editCard) && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {editCard ? "Edit Card" : "New Card"}
            </span>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as "qa" | "cloze")}
              className="rounded border border-input bg-background px-2 py-1 text-xs"
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
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            placeholder={newType === "qa" ? "Answer" : "Hidden word"}
            className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={editCard ? handleUpdate : handleCreate}
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {editCard ? "Save" : "Create"}
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setEditCard(null);
              }}
              className="rounded border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards..."
          className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-3 text-sm"
        />
      </div>

      {/* Card list */}
      <div className="space-y-2">
        {filtered.map((card) => (
          <div
            key={card.id}
            className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent/30 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor(card.status)}`}
                >
                  {card.status || "new"}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {card.cardType}
                </span>
                {card.manual && (
                  <span className="text-[10px] text-muted-foreground">
                    manual
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-medium truncate">{card.front}</p>
              <p className="text-xs text-muted-foreground truncate">
                {card.back}
              </p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => startEdit(card)}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(card.id)}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {cards.length === 0 ? "No cards yet" : "No matching cards"}
          </p>
        )}
      </div>
    </div>
  );
}

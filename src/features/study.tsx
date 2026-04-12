import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RotateCcw, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StudyCard {
  id: number;
  cardType: string;
  front: string;
  back: string;
  stability: number;
  difficulty: number;
  reviewCount: number;
  sourceName: string | null;
}

const RATINGS = [
  { value: 1, label: "Again", color: "bg-red-600 hover:bg-red-700" },
  { value: 2, label: "Hard", color: "bg-orange-600 hover:bg-orange-700" },
  { value: 3, label: "Good", color: "bg-blue-600 hover:bg-blue-700" },
  { value: 4, label: "Easy", color: "bg-green-600 hover:bg-green-700" },
];

export function Study() {
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    invoke<StudyCard[]>("get_due_cards", { limit: 50 })
      .then((c) => {
        setCards(c);
        if (c.length === 0) setSessionDone(true);
      })
      .catch(console.error);
  }, []);

  const card = cards[currentIdx];

  const submitRating = async (rating: number) => {
    if (!card) return;

    const lastReview = new Date().toISOString();
    // For now, approximate elapsed days as 0 for simplicity
    // In production, calculate from card's due_date
    const daysElapsed = card.reviewCount === 0 ? 0 : 1;

    await invoke("submit_review", {
      cardId: card.id,
      rating,
      stability: card.stability,
      difficulty: card.difficulty,
      reviewCount: card.reviewCount,
      daysElapsed,
    });

    setReviewed((r) => r + 1);
    setFlipped(false);

    if (currentIdx + 1 < cards.length) {
      setCurrentIdx((i) => i + 1);
    } else {
      setSessionDone(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!flipped) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(true);
      }
    } else {
      const num = parseInt(e.key);
      if (num >= 1 && num <= 4) {
        submitRating(num);
      }
    }
  };

  if (sessionDone) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-4xl">🎉</div>
        <h2 className="text-xl font-bold">Session Complete!</h2>
        <p className="text-sm text-muted-foreground">
          You reviewed {reviewed} card{reviewed !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" /> Study Again
          </button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full space-y-6 outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Progress */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {currentIdx + 1} / {cards.length}
        </span>
        {card.sourceName && (
          <>
            <span className="text-border">|</span>
            <span>{card.sourceName}</span>
          </>
        )}
      </div>

      {/* Card */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        className="w-full max-w-lg cursor-pointer rounded-xl border border-border bg-card p-8 shadow-lg min-h-[200px] flex flex-col items-center justify-center text-center transition-all hover:shadow-xl"
      >
        <span className="text-[10px] uppercase text-muted-foreground mb-3">
          {card.cardType === "cloze" ? "Fill in the blank" : "Question"}
        </span>
        <p className="text-lg font-medium leading-relaxed">{card.front}</p>

        {flipped && (
          <div className="mt-6 w-full border-t border-border pt-4">
            <span className="text-[10px] uppercase text-muted-foreground">
              Answer
            </span>
            <p className="mt-1 text-lg text-green-400 font-medium">
              {card.back}
            </p>
          </div>
        )}

        {!flipped && (
          <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground/50">
            <ChevronRight className="h-3 w-3" /> Click or press Space to reveal
          </div>
        )}
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div className="flex gap-3">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => submitRating(r.value)}
              className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${r.color}`}
            >
              {r.label}
              <span className="ml-1 text-xs opacity-70">({r.value})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

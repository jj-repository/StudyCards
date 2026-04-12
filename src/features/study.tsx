import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RotateCcw } from "lucide-react";
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
  { value: 1, label: "Again", key: "1" },
  { value: 2, label: "Hard", key: "2" },
  { value: 3, label: "Good", key: "3" },
  { value: 4, label: "Easy", key: "4" },
];

export function Study() {
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [ratingCounts, setRatingCounts] = useState([0, 0, 0, 0]);
  const [startTime] = useState(() => Date.now());
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<StudyCard[]>("get_due_cards", { limit: 50 })
      .then((c) => {
        setCards(c);
        if (c.length === 0) setSessionDone(true);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, [currentIdx, flipped]);

  const card = cards[currentIdx];

  const submitRating = async (rating: number) => {
    if (!card) return;
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
    setRatingCounts((prev) => {
      const next = [...prev];
      next[rating - 1]++;
      return next;
    });
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
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    const correct = ratingCounts[2] + ratingCounts[3]; // Good + Easy
    const accuracy = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;

    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Done</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {reviewed} card{reviewed !== 1 ? "s" : ""} in {timeStr}
          </p>
        </div>

        {reviewed > 0 && (
          <div className="flex items-center gap-8 text-sm">
            <div className="text-center">
              <div className="text-2xl font-semibold tabular-nums">
                {accuracy}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Accuracy</div>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              {[
                { label: "Again", count: ratingCounts[0] },
                { label: "Hard", count: ratingCounts[1] },
                { label: "Good", count: ratingCounts[2] },
                { label: "Easy", count: ratingCounts[3] },
              ].map(
                (r) =>
                  r.count > 0 && (
                    <div key={r.label} className="text-center">
                      <div className="text-foreground font-medium tabular-nums">
                        {r.count}
                      </div>
                      <div>{r.label}</div>
                    </div>
                  ),
              )}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate("/")}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
          >
            Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/85 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Study again
          </button>
        </div>
      </div>
    );
  }

  if (!card) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center h-full outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Progress */}
      <div className="mb-8 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {currentIdx + 1}/{cards.length}
        </span>
        {card.sourceName && (
          <>
            <span className="text-border">|</span>
            <span className="truncate max-w-48">{card.sourceName}</span>
          </>
        )}
      </div>

      {/* Card */}
      <div
        onClick={() => !flipped && setFlipped(true)}
        className="w-full max-w-md cursor-pointer rounded-lg bg-card px-8 py-10 min-h-[220px] flex flex-col items-center justify-center text-center"
      >
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-4">
          {card.cardType === "cloze" ? "Fill in the blank" : "Question"}
        </span>
        <p className="text-lg leading-relaxed">{card.front}</p>

        {flipped && (
          <div className="mt-8 w-full border-t border-border pt-5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
              Answer
            </span>
            <p className="mt-2 text-lg text-primary leading-relaxed">
              {card.back}
            </p>
          </div>
        )}

        {!flipped && (
          <p className="mt-6 text-xs text-muted-foreground/40">
            Space to reveal
          </p>
        )}
      </div>

      {/* Rating buttons */}
      {flipped && (
        <div className="mt-8 flex gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              onClick={() => submitRating(r.value)}
              className="rounded-md bg-secondary px-5 py-2.5 text-sm font-medium text-secondary-foreground transition-colors hover:bg-accent"
            >
              {r.label}
              <kbd className="ml-1.5 text-[10px] text-muted-foreground">
                {r.key}
              </kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

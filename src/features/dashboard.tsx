import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BookOpen, Clock, Flame, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StudyStats {
  totalCards: number;
  dueToday: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  reviewsToday: number;
  streakDays: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<StudyStats | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    invoke<StudyStats>("get_study_stats").then(setStats).catch(console.error);
  }, []);

  const statCards = stats
    ? [
        {
          label: "Due Today",
          value: stats.dueToday,
          icon: Clock,
          accent: "text-orange-500",
        },
        {
          label: "Total Cards",
          value: stats.totalCards,
          icon: BookOpen,
          accent: "text-blue-500",
        },
        {
          label: "Reviews Today",
          value: stats.reviewsToday,
          icon: Star,
          accent: "text-green-500",
        },
        {
          label: "Streak",
          value: `${stats.streakDays}d`,
          icon: Flame,
          accent: "text-red-500",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Your study overview at a glance
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.accent}`} />
            </div>
            <div className="mt-2 text-2xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {stats && stats.dueToday > 0 && (
        <button
          onClick={() => navigate("/study")}
          className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start Studying ({stats.dueToday} cards due)
        </button>
      )}

      {stats && stats.totalCards === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No cards yet. Go to{" "}
            <button
              onClick={() => navigate("/generate")}
              className="text-primary underline"
            >
              Generate
            </button>{" "}
            to create cards from your Markdown files, or{" "}
            <button
              onClick={() => navigate("/library")}
              className="text-primary underline"
            >
              Library
            </button>{" "}
            to add cards manually.
          </p>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border p-4">
            <span className="text-xs text-muted-foreground">New</span>
            <div className="mt-1 text-lg font-semibold text-blue-500">
              {stats.newCards}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <span className="text-xs text-muted-foreground">Learning</span>
            <div className="mt-1 text-lg font-semibold text-orange-500">
              {stats.learningCards}
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <span className="text-xs text-muted-foreground">Review</span>
            <div className="mt-1 text-lg font-semibold text-green-500">
              {stats.reviewCards}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

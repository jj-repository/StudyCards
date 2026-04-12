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

  if (!stats) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      {/* Primary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Due today", value: stats.dueToday, icon: Clock },
          { label: "Total cards", value: stats.totalCards, icon: BookOpen },
          { label: "Reviewed today", value: stats.reviewsToday, icon: Star },
          { label: "Streak", value: `${stats.streakDays}d`, icon: Flame },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-card px-4 py-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <s.icon className="h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            <div className="mt-1.5 text-xl font-semibold tabular-nums">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Card status breakdown */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[oklch(0.65_0.10_240)]" />
          <span className="text-muted-foreground">New</span>
          <span className="font-medium tabular-nums">{stats.newCards}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[oklch(0.68_0.12_65)]" />
          <span className="text-muted-foreground">Learning</span>
          <span className="font-medium tabular-nums">
            {stats.learningCards}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[oklch(0.65_0.10_155)]" />
          <span className="text-muted-foreground">Review</span>
          <span className="font-medium tabular-nums">{stats.reviewCards}</span>
        </div>
      </div>

      {/* CTA */}
      {stats.dueToday > 0 && (
        <button
          onClick={() => navigate("/study")}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
        >
          Study now — {stats.dueToday} due
        </button>
      )}

      {/* Empty state */}
      {stats.totalCards === 0 && (
        <div className="rounded-lg bg-card px-6 py-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            No cards yet.{" "}
            <button
              onClick={() => navigate("/generate")}
              className="text-primary hover:underline"
            >
              Generate from Markdown
            </button>{" "}
            or{" "}
            <button
              onClick={() => navigate("/library")}
              className="text-primary hover:underline"
            >
              create manually
            </button>
            .
          </p>
        </div>
      )}
    </div>
  );
}

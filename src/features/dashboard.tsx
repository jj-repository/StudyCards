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

interface DayReviewStat {
  date: string;
  count: number;
  correct: number;
}

interface SourceCardCount {
  name: string;
  count: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [dailyReviews, setDailyReviews] = useState<DayReviewStat[]>([]);
  const [sources, setSources] = useState<SourceCardCount[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    invoke<StudyStats>("get_study_stats").then(setStats).catch(console.error);
    invoke<DayReviewStat[]>("get_daily_reviews", { days: 30 })
      .then(setDailyReviews)
      .catch(console.error);
    invoke<SourceCardCount[]>("get_cards_per_source")
      .then(setSources)
      .catch(console.error);
  }, []);

  if (!stats) return null;

  const maxReviews = Math.max(...dailyReviews.map((d) => d.count), 1);
  const avgAccuracy =
    dailyReviews.length > 0
      ? Math.round(
          (dailyReviews.reduce((sum, d) => sum + d.correct, 0) /
            dailyReviews.reduce((sum, d) => sum + d.count, 0)) *
            100,
        ) || 0
      : 0;
  const maxSourceCount = Math.max(...sources.map((s) => s.count), 1);

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

      {/* Review activity — last 30 days */}
      {dailyReviews.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Last 30 days
            </h2>
            <span className="text-xs text-muted-foreground tabular-nums">
              {avgAccuracy}% accuracy
            </span>
          </div>
          <div className="flex items-end gap-px h-20">
            {dailyReviews.map((d) => {
              const height = Math.max((d.count / maxReviews) * 100, 4);
              const accuracy = d.count > 0 ? d.correct / d.count : 0;
              const opacity = 0.3 + accuracy * 0.7;
              return (
                <div
                  key={d.date}
                  className="flex-1 rounded-sm bg-primary transition-colors"
                  style={{
                    height: `${height}%`,
                    opacity,
                  }}
                  title={`${d.date}: ${d.count} reviews, ${Math.round(accuracy * 100)}% correct`}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Cards per source */}
      {sources.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Cards by source
          </h2>
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="text-sm truncate w-36">{s.name}</span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{
                      width: `${(s.count / maxSourceCount) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </section>
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

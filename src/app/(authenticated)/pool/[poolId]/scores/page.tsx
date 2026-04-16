"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Diamond } from "lucide-react";
import { getScoresData } from "@/actions/tickets";
import { useParams } from "next/navigation";
import { useLiveScores } from "@/hooks/use-live-scores";

const ESPN_SLUG_OVERRIDES: Record<string, string> = { AZ: "ari", CWS: "chw" };

function TeamLogo({ abbr, size = 32 }: { abbr: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const slug = ESPN_SLUG_OVERRIDES[abbr] ?? abbr.toLowerCase();
  if (errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-300 flex-shrink-0"
      >
        {abbr.slice(0, 3)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://a.espncdn.com/i/teamlogos/mlb/500/${slug}.png`}
      alt={abbr}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className="object-contain flex-shrink-0"
    />
  );
}

interface MlbGame {
  id: string;
  game_date: string;
  away_score: number;
  home_score: number;
  status: string;
  inning: number | null;
  inning_state: string | null;
}

interface SeriesData {
  id: string;
  spread: number;
  favorite: string;
  mlb_series: {
    away_team_abbr: string;
    home_team_abbr: string;
    total_runs_away: number;
    total_runs_home: number;
    status: string;
    mlb_games: MlbGame[];
  };
}

export default function ScoresPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [series, setSeries] = useState<SeriesData[]>([]);
  const [pickedSeriesIds, setPickedSeriesIds] = useState<Set<string>>(new Set());
  const [week, setWeek] = useState<{ week_number: number; label: string } | null>(null);
  const [filter, setFilter] = useState<"all" | "picks">("all");
  const [loading, setLoading] = useState(true);

  const loadScores = useCallback(async () => {
    const data = await getScoresData(poolId);
    if (!data) return;
    setWeek(data.week);
    setSeries(data.series as SeriesData[]);
    setPickedSeriesIds(new Set(data.pickedSeriesIds));
  }, [poolId]);

  // Live score updates via Broadcast channel
  useLiveScores(poolId, () => {
    loadScores();
  });

  useEffect(() => {
    async function load() {
      const data = await getScoresData(poolId);
      if (!data) {
        setLoading(false);
        return;
      }
      setWeek(data.week);
      setSeries(data.series as SeriesData[]);
      setPickedSeriesIds(new Set(data.pickedSeriesIds));
      setLoading(false);
    }
    load();
  }, [poolId]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!week) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No active week found.</p>
      </div>
    );
  }

  const filtered = filter === "picks" ? series.filter((s) => pickedSeriesIds.has(s.id)) : series;

  const sorted = [...filtered].sort((a, b) => {
    const order: Record<string, number> = { in_progress: 0, pending: 1, final: 2, void: 3 };
    return (order[a.mlb_series.status] ?? 2) - (order[b.mlb_series.status] ?? 2);
  });

  const dayLabels = ["Fri", "Sat", "Sun", "Mon"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Week {week.week_number} Scores
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {series.length} series — {week.label}
          </p>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${filter === "all" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setFilter("all")}
          >
            All Series
          </button>
          <button
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${filter === "picks" ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
            onClick={() => setFilter("picks")}
          >
            My Picks
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sorted.map((s) => {
          const mlb = s.mlb_series;
          const isPick = pickedSeriesIds.has(s.id);
          const games = (mlb.mlb_games ?? []).sort((a: MlbGame, b: MlbGame) =>
            a.game_date.localeCompare(b.game_date)
          );
          const spreadLabel = `${s.favorite === "home" ? mlb.home_team_abbr : mlb.away_team_abbr} -${Math.abs(s.spread).toFixed(1)}`;

          return (
            <Card key={s.id} className="relative">
              {isPick && (
                <Diamond className="absolute top-4 right-4 w-4 h-4 text-emerald-400" />
              )}
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TeamLogo abbr={mlb.away_team_abbr} size={28} />
                    <span className="text-sm font-bold text-slate-300">{mlb.away_team_abbr}</span>
                    <span className="text-xs text-slate-600">@</span>
                    <TeamLogo abbr={mlb.home_team_abbr} size={28} />
                    <span className="text-sm font-bold text-slate-300">{mlb.home_team_abbr}</span>
                  </div>
                  <Badge variant="default" className="font-mono text-xs">
                    {spreadLabel}
                  </Badge>
                </div>

                <div className="space-y-1.5 mb-3">
                  {games.map((game: MlbGame, i: number) => {
                    const isLive = game.status === "in_progress";
                    const gameStatus =
                      game.status === "final"
                        ? "FINAL"
                        : game.status === "in_progress"
                          ? `${game.inning_state ?? ""} ${game.inning ?? ""}`.trim()
                          : game.status === "scheduled"
                            ? "Scheduled"
                            : game.status;

                    return (
                      <div key={game.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 w-8">{dayLabels[i] ?? `G${i + 1}`}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-300 w-8 text-right">
                            {game.status === "scheduled" ? "—" : game.away_score}
                          </span>
                          <span className="text-slate-600">-</span>
                          <span className="text-slate-300 w-8">
                            {game.status === "scheduled" ? "—" : game.home_score}
                          </span>
                        </div>
                        <span className={`w-16 text-right text-xs ${isLive ? "text-blue-400" : "text-slate-500"}`}>
                          {isLive && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-live mr-1" />
                          )}
                          {gameStatus}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-slate-900 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Cumulative</span>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-white">
                      {mlb.away_team_abbr} {mlb.total_runs_away}
                    </span>
                    <span className="text-slate-600">-</span>
                    <span className="text-white">
                      {mlb.total_runs_home} {mlb.home_team_abbr}
                    </span>
                  </div>
                  {mlb.status === "in_progress" && (
                    <Badge variant="live" className="text-[10px] px-2 py-0.5">LIVE</Badge>
                  )}
                  {mlb.status === "final" && (
                    <Badge variant="pending" className="text-[10px] px-2 py-0.5">FINAL</Badge>
                  )}
                  {(mlb.status === "pending" || mlb.status === "scheduled") && (
                    <Badge variant="pending" className="text-[10px] px-2 py-0.5">—</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-16">
          <p className="text-slate-500 text-lg">
            {filter === "picks" ? "You haven't made any picks yet." : "No series data available."}
          </p>
        </div>
      )}
    </div>
  );
}

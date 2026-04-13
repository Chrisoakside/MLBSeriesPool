"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Lock } from "lucide-react";
import { getPicksData, submitPicks } from "@/actions/tickets";
import { useParams, useRouter } from "next/navigation";

interface Series {
  id: string;
  spread: number;
  favorite: "home" | "away";
  mlb_series: {
    away_team_abbr: string;
    home_team_abbr: string;
    away_team_name: string;
    home_team_name: string;
    total_games_scheduled: number;
  };
}

interface ExistingPick {
  series_id: string;
  picked_side: "home" | "away";
}

export default function PicksPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [series, setSeries] = useState<Series[]>([]);
  const [week, setWeek] = useState<{ id: string; week_number: number; label: string; lock_time: string } | null>(null);
  const [selected, setSelected] = useState<Map<string, "home" | "away">>(new Map());
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const data = await getPicksData(poolId);
      if (!data) {
        setLoading(false);
        return;
      }
      setWeek(data.week);
      setSeries(data.series as Series[]);
      setIsLocked(data.isLocked);

      if (data.existingPicks.length > 0) {
        const picks = new Map<string, "home" | "away">();
        data.existingPicks.forEach((p: ExistingPick) => {
          picks.set(p.series_id, p.picked_side);
        });
        setSelected(picks);
        setSubmitted(true);
      }
      setLoading(false);
    }
    load();
  }, [poolId]);

  const togglePick = (seriesId: string, side: "home" | "away") => {
    if (submitted || isLocked) return;
    const next = new Map(selected);
    if (next.get(seriesId) === side) {
      next.delete(seriesId);
    } else if (next.size < 6 || next.has(seriesId)) {
      next.set(seriesId, side);
    }
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (!week) return;
    setSubmitting(true);
    setError("");

    const picks = Array.from(selected.entries()).map(([series_id, picked_side]) => ({
      series_id,
      picked_side,
    }));

    const result = await submitPicks(poolId, week.id, picks);

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      setShowConfirm(false);
      return;
    }

    setSubmitted(true);
    setShowConfirm(false);
    setSubmitting(false);
  };

  const getSpreadLabel = (s: Series) => {
    const favTeam = s.favorite === "home" ? s.mlb_series.home_team_abbr : s.mlb_series.away_team_abbr;
    return `${favTeam} -${Math.abs(s.spread).toFixed(1)}`;
  };

  const getTimeUntilLock = () => {
    if (!week) return "";
    const lock = new Date(week.lock_time);
    const now = new Date();
    const diff = lock.getTime() - now.getTime();
    if (diff <= 0) return "Locked";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `Locks in ${days > 0 ? `${days}d ` : ""}${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!week || series.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No lines available yet. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Week {week.week_number} Picks
          </h1>
          <p className="text-sm text-slate-400 mt-1">{week.label}</p>
        </div>
        {!isLocked && (
          <div className="flex items-center gap-2 text-amber-400">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium font-mono">
              {getTimeUntilLock()}
            </span>
          </div>
        )}
        {isLocked && (
          <div className="flex items-center gap-2 text-red-400">
            <Lock className="w-4 h-4" />
            <span className="text-sm font-medium">Picks Locked</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Submitted Banner */}
      {submitted && !isLocked && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-emerald-200">
              Picks submitted! You can edit until the lock time.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSubmitted(false)}
          >
            Edit Picks
          </Button>
        </div>
      )}

      {/* Series Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {series.map((s, i) => {
          const pickedSide = selected.get(s.id);
          const isSelected = !!pickedSide;
          const mlb = s.mlb_series;

          return (
            <Card
              key={s.id}
              interactive={!submitted && !isLocked}
              selected={isSelected}
              className={`${submitted && !isSelected ? "opacity-40" : ""} ${submitted || isLocked ? "pointer-events-none" : ""}`}
              onClick={() => {
                if (submitted || isLocked) return;
                // Default to picking the favorite side
                const defaultSide = s.favorite;
                togglePick(s.id, pickedSide ? pickedSide : defaultSide);
              }}
            >
              <CardContent className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500">
                    Series {i + 1} of {series.length}
                  </span>
                  {isSelected && !submitted && (
                    <span className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </span>
                  )}
                  {submitted && isSelected && (
                    <Lock className="w-4 h-4 text-emerald-400" />
                  )}
                </div>

                {/* Matchup */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                      {mlb.away_team_abbr}
                    </div>
                    <span className="text-xs text-slate-500">@</span>
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                      {mlb.home_team_abbr}
                    </div>
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-sm text-slate-300">
                    {mlb.away_team_name}
                  </span>
                  <span className="text-xs text-slate-600">@</span>
                  <span className="text-sm text-white font-medium">
                    {mlb.home_team_name}
                  </span>
                </div>

                {/* Spread */}
                <div className="mt-3 mb-2">
                  <span className="text-lg font-bold text-white font-mono">
                    {getSpreadLabel(s)}
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    cumulative runs
                  </p>
                </div>

                {/* Game details */}
                <div className="flex items-center gap-2 mt-3">
                  <Badge>{mlb.total_games_scheduled}-game series</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sticky Selection Counter */}
      {!isLocked && !submitted && (
        <div className="sticky bottom-20 lg:bottom-4 z-40">
          <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-4 flex items-center justify-between shadow-xl shadow-black/20">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      i < selected.size
                        ? "bg-emerald-500"
                        : "border border-slate-600"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm text-slate-300">
                <span className="text-white font-medium">{selected.size}</span>{" "}
                of 6 selected
              </span>
            </div>
            <Button
              size="sm"
              disabled={selected.size !== 6}
              onClick={() => setShowConfirm(true)}
            >
              Submit Picks
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-md w-full space-y-5">
            <h2 className="text-xl font-bold text-white">Confirm Your Picks</h2>
            <div className="space-y-2">
              {series
                .filter((s) => selected.has(s.id))
                .map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between py-2 px-3 bg-slate-900 rounded-lg"
                  >
                    <span className="text-sm text-white">
                      {s.mlb_series.away_team_abbr} @ {s.mlb_series.home_team_abbr}
                    </span>
                    <span className="text-sm font-mono text-emerald-400">
                      {getSpreadLabel(s)}
                    </span>
                  </div>
                ))}
            </div>
            <p className="text-xs text-slate-400">
              You can edit your picks until the lock time.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setShowConfirm(false)}
              >
                Go Back
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Lock It In"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

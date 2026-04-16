"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Check, Lock, User } from "lucide-react";
import { getPicksData, submitPicks } from "@/actions/tickets";
import { useParams, useRouter } from "next/navigation";

// Maps MLB Stats API abbreviations → ESPN CDN slug (only needed for mismatches)
const ESPN_SLUG_OVERRIDES: Record<string, string> = {
  AZ: "ari",   // MLB uses AZ, ESPN uses ari
  CWS: "chw",  // MLB uses CWS, ESPN uses chw
};

function teamLogoUrl(abbr: string): string {
  const slug = ESPN_SLUG_OVERRIDES[abbr] ?? abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/mlb/500/${slug}.png`;
}

interface Game {
  id: string;
  mlb_game_pk: number;
  game_date: string;
  game_time: string;
  away_probable_pitcher: string | null;
  home_probable_pitcher: string | null;
}

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
    mlb_games: Game[];
  };
}

interface ExistingPick {
  series_id: string;
  picked_side: "home" | "away";
}

function formatGameDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function PicksPage() {
  const params = useParams();
  const router = useRouter();
  const poolId = params.poolId as string;

  const [series, setSeries] = useState<Series[]>([]);
  const [pitcherMap, setPitcherMap] = useState<Record<number, { away: string | null; home: string | null }>>({});
  const [week, setWeek] = useState<{
    id: string;
    week_number: number;
    label: string;
    lock_time: string;
  } | null>(null);
  const [selected, setSelected] = useState<Map<string, "home" | "away">>(
    new Map()
  );
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
      if (data.pitcherMap) setPitcherMap(data.pitcherMap);

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
      next.delete(seriesId); // tap same side to deselect
    } else if (next.size < 6 || next.has(seriesId)) {
      next.set(seriesId, side);
    }
    setSelected(next);
  };

  const handleSubmit = async () => {
    if (!week) return;
    setSubmitting(true);
    setError("");

    const picks = Array.from(selected.entries()).map(
      ([series_id, picked_side]) => ({ series_id, picked_side })
    );

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
    const favTeam =
      s.favorite === "home"
        ? s.mlb_series.home_team_abbr
        : s.mlb_series.away_team_abbr;
    return `${favTeam} -${Math.abs(s.spread).toFixed(1)}`;
  };

  const getTimeUntilLock = () => {
    if (!week) return "";
    const lock = new Date(week.lock_time);
    const now = new Date();
    const diff = lock.getTime() - now.getTime();
    if (diff <= 0) return "Locked";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `Locks in ${days > 0 ? `${days}d ` : ""}${hours}h ${mins}m`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!week || series.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">
          No lines available yet. Check back later.
        </p>
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
          <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)}>
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
          // Merge DB pitcher data with live API data (API wins for null DB values)
          const games = (mlb.mlb_games ?? [])
            .sort((a, b) => a.game_date.localeCompare(b.game_date))
            .map((g) => ({
              ...g,
              away_probable_pitcher:
                g.away_probable_pitcher ?? pitcherMap[g.mlb_game_pk]?.away ?? null,
              home_probable_pitcher:
                g.home_probable_pitcher ?? pitcherMap[g.mlb_game_pk]?.home ?? null,
            }));

          return (
            <Card
              key={s.id}
              selected={isSelected}
              className={submitted && !isSelected ? "opacity-40" : ""}
            >
              <CardContent className="space-y-3">
                {/* Series number + picked indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Series {i + 1} of {series.length}
                  </span>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" />
                      {pickedSide === "away"
                        ? mlb.away_team_abbr
                        : mlb.home_team_abbr}{" "}
                      picked
                    </span>
                  )}
                </div>

                {/* Team logos + spread */}
                <div className="flex items-center gap-3">
                  {/* Away team */}
                  <div className="flex flex-col items-center gap-1 w-14">
                    <TeamLogo abbr={mlb.away_team_abbr} size={40} />
                    <span className="text-[11px] font-bold text-slate-300">
                      {mlb.away_team_abbr}
                    </span>
                  </div>

                  <span className="text-xs text-slate-600 font-medium">@</span>

                  {/* Home team */}
                  <div className="flex flex-col items-center gap-1 w-14">
                    <TeamLogo abbr={mlb.home_team_abbr} size={40} />
                    <span className="text-[11px] font-bold text-slate-300">
                      {mlb.home_team_abbr}
                    </span>
                  </div>

                  {/* Spread + series length */}
                  <div className="ml-auto text-right">
                    <p className="text-base font-bold text-white font-mono">
                      {getSpreadLabel(s)}
                    </p>
                    <p className="text-[10px] text-slate-500">cumulative runs</p>
                    <div className="mt-1">
                      <Badge className="text-[10px]">
                        {mlb.total_games_scheduled}G series
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Probable pitchers per game */}
                {games.length > 0 && (
                  <div className="border-t border-slate-800 pt-2.5 space-y-1.5">
                    {games.map((g) => (
                      <div key={g.id} className="text-xs">
                        <span className="text-slate-500 mr-2">
                          {formatGameDate(g.game_date)}
                        </span>
                        {g.away_probable_pitcher && g.home_probable_pitcher ? (
                          <span className="text-slate-400">
                            <span className="inline-flex items-center gap-0.5">
                              <User className="w-2.5 h-2.5 inline" />
                              {g.away_probable_pitcher
                                .split(" ")
                                .pop()}{" "}
                            </span>
                            <span className="text-slate-600">vs</span>
                            <span className="inline-flex items-center gap-0.5 ml-1">
                              <User className="w-2.5 h-2.5 inline" />
                              {g.home_probable_pitcher.split(" ").pop()}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">TBD</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Pick buttons — shown when not submitted/locked */}
                {!submitted && !isLocked && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => togglePick(s.id, "away")}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        pickedSide === "away"
                          ? "bg-emerald-500 text-white ring-2 ring-emerald-400/40"
                          : "bg-slate-700/70 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <span>{mlb.away_team_name}</span>
                      {s.favorite === "away" && (
                        <span className="text-[9px] font-normal opacity-75">
                          FAVORITE
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => togglePick(s.id, "home")}
                      className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        pickedSide === "home"
                          ? "bg-emerald-500 text-white ring-2 ring-emerald-400/40"
                          : "bg-slate-700/70 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      <span>{mlb.home_team_name}</span>
                      {s.favorite === "home" && (
                        <span className="text-[9px] font-normal opacity-75">
                          FAVORITE
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {/* Locked / submitted pick display */}
                {(submitted || isLocked) && isSelected && (
                  <div className="pt-1 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-semibold">
                      {pickedSide === "away"
                        ? mlb.away_team_name
                        : mlb.home_team_name}
                    </span>
                  </div>
                )}
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
                .map((s) => {
                  const side = selected.get(s.id)!;
                  const pickedTeam =
                    side === "away"
                      ? s.mlb_series.away_team_abbr
                      : s.mlb_series.home_team_abbr;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-2 px-3 bg-slate-900 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <TeamLogo abbr={pickedTeam} size={22} />
                        <span className="text-sm text-white">
                          {s.mlb_series.away_team_abbr} @{" "}
                          {s.mlb_series.home_team_abbr}
                        </span>
                      </div>
                      <span className="text-sm font-mono text-emerald-400">
                        {pickedTeam}
                      </span>
                    </div>
                  );
                })}
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

// ── TeamLogo ─────────────────────────────────────────────────────────
// Renders an ESPN CDN logo with a fallback abbreviation circle on error.
function TeamLogo({ abbr, size }: { abbr: string; size: number }) {
  const [errored, setErrored] = useState(false);
  const slug = ESPN_SLUG_OVERRIDES[abbr] ?? abbr.toLowerCase();

  if (errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300"
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
      className="object-contain"
    />
  );
}

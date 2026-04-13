"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Check,
  Minus,
  Plus,
  Send,
  Calendar,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  getAdminLinesData,
  upsertSeries,
  publishLines,
  createWeek,
  seedMlbSchedule,
} from "@/actions/admin";
import { useParams } from "next/navigation";

interface MlbSeries {
  id: string;
  away_team_abbr: string;
  home_team_abbr: string;
  away_team_name: string;
  home_team_name: string;
  total_games_scheduled: number;
  series_start_date: string;
  series_end_date: string;
  dk_spread: number | null;
  dk_favorite: "home" | "away" | null;
}

interface ExistingSeries {
  id: string;
  mlb_series_id: string;
  spread: number;
  favorite: "home" | "away";
  mlb_series: MlbSeries;
}

interface LineEntry {
  mlb_series_id: string;
  away: string;
  home: string;
  spread: number;
  favorite: "home" | "away";
  games: number;
  startDate: string;
  isSet: boolean;
  selected: boolean; // whether admin has toggled it into the week
  hasDkSpread?: boolean; // spread came from DraftKings
}

/** Next upcoming Friday (or today if today is Friday) */
function getNextFriday(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun … 6=Sat
  const diff = day === 5 ? 0 : (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + diff);
  return friday.toISOString().split("T")[0];
}

export default function AdminLinesPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [lines, setLines] = useState<LineEntry[]>([]);
  const [allMlbSeries, setAllMlbSeries] = useState<MlbSeries[]>([]);
  const [week, setWeek] = useState<{
    id: string;
    week_number: number;
    label: string;
    status: string;
  } | null>(null);
  const [nextWeekNumber, setNextWeekNumber] = useState(1);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchResult, setFetchResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Week creation form
  const [weekLabel, setWeekLabel] = useState("");
  const [lockTime, setLockTime] = useState("");

  // Schedule fetch form
  const [fridayDate, setFridayDate] = useState(getNextFriday);

  const loadData = useCallback(async () => {
    const data = await getAdminLinesData(poolId);
    if (!data) {
      setLoading(false);
      return;
    }

    const mlb = data.mlbSeries as MlbSeries[];
    setAllMlbSeries(mlb);
    setNextWeekNumber(data.nextWeekNumber ?? 1);

    if (data.week) {
      setWeek(data.week);
      setPublished(
        data.week.status === "lines_set" || data.week.status === "locked"
      );

      if (data.series.length > 0) {
        // Existing saved lines
        const selectedIds = new Set(
          (data.series as ExistingSeries[]).map((s) => s.mlb_series_id)
        );
        const existingLines = (data.series as ExistingSeries[]).map((s) => ({
          mlb_series_id: s.mlb_series_id,
          away: s.mlb_series.away_team_abbr,
          home: s.mlb_series.home_team_abbr,
          spread: s.spread,
          favorite: s.favorite,
          games: s.mlb_series.total_games_scheduled,
          startDate: s.mlb_series.series_start_date,
          isSet: true,
          selected: true,
        }));
        // Append any mlb series not yet selected (so admin can add more)
        const extras = mlb
          .filter((m) => !selectedIds.has(m.id))
          .map((m) => ({
            mlb_series_id: m.id,
            away: m.away_team_abbr,
            home: m.home_team_abbr,
            spread: m.dk_spread ?? 1.5,
            favorite: m.dk_favorite ?? ("home" as const),
            games: m.total_games_scheduled,
            startDate: m.series_start_date,
            isSet: false,
            selected: false,
            hasDkSpread: m.dk_spread !== null,
          }));
        setLines([...existingLines, ...extras]);
      } else {
        // No lines saved yet — show all available mlb series with DK spreads
        setLines(
          mlb.map((m) => ({
            mlb_series_id: m.id,
            away: m.away_team_abbr,
            home: m.home_team_abbr,
            spread: m.dk_spread ?? 1.5,
            favorite: m.dk_favorite ?? ("home" as const),
            games: m.total_games_scheduled,
            startDate: m.series_start_date,
            isSet: false,
            selected: false,
            hasDkSpread: m.dk_spread !== null,
          }))
        );
      }
    } else {
      // No week yet — just populate lines list from mlb series
      setLines(
        mlb.map((m) => ({
          mlb_series_id: m.id,
          away: m.away_team_abbr,
          home: m.home_team_abbr,
          spread: m.dk_spread ?? 1.5,
          favorite: m.dk_favorite ?? ("home" as const),
          games: m.total_games_scheduled,
          startDate: m.series_start_date,
          isSet: false,
          selected: false,
          hasDkSpread: m.dk_spread !== null,
        }))
      );
    }

    setLoading(false);
  }, [poolId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Schedule fetch ────────────────────────────────────────────
  const handleFetchSchedule = async () => {
    setFetching(true);
    setFetchResult(null);
    setError("");
    const result = await seedMlbSchedule(fridayDate);
    if ("error" in result && result.error) {
      setError(result.error);
    } else if ("seriesCount" in result) {
      setFetchResult(
        result.seriesCount === 0
          ? "No games found — the MLB schedule may not be posted yet for that weekend."
          : `Loaded ${result.seriesCount} series (${result.gameCount} games) from ESPN.${"spreadsAvailable" in result && result.spreadsAvailable ? ` DraftKings spreads pre-filled for ${result.spreadsAvailable} games.` : " Spreads not yet posted — set them manually."}`
      );
      await loadData();
    }
    setFetching(false);
  };

  // ── Week creation ─────────────────────────────────────────────
  const handleCreateWeek = async () => {
    if (!weekLabel.trim() || !lockTime) return;
    setCreatingWeek(true);
    setError("");
    const result = await createWeek(
      poolId,
      nextWeekNumber,
      weekLabel.trim(),
      new Date(lockTime).toISOString()
    );
    if (result.error) {
      setError(result.error);
      setCreatingWeek(false);
      return;
    }
    await loadData();
    setCreatingWeek(false);
  };

  // ── Spread / favorite controls ────────────────────────────────
  const adjustSpread = (mlbId: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.mlb_series_id !== mlbId) return l;
        // Spread must always be a half-point (e.g. 1.5, 2.5 …)
        const raw = Math.round((l.spread + delta) * 2) / 2;
        const newSpread = Math.max(0.5, raw);
        return { ...l, spread: newSpread, isSet: true };
      })
    );
  };

  const toggleFavorite = (mlbId: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.mlb_series_id === mlbId
          ? {
              ...l,
              favorite: l.favorite === "home" ? "away" : "home",
              isSet: true,
            }
          : l
      )
    );
  };

  const toggleSelected = (mlbId: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.mlb_series_id === mlbId
          ? { ...l, selected: !l.selected, isSet: l.selected ? false : true }
          : l
      )
    );
  };

  // ── Save / Publish ────────────────────────────────────────────
  const selectedLines = lines.filter((l) => l.selected);

  const buildEntries = () =>
    selectedLines.map((l) => ({
      mlb_series_id: l.mlb_series_id,
      spread: l.spread,
      favorite: l.favorite,
    }));

  const handleSave = async () => {
    if (!week) return;
    setSaving(true);
    setError("");
    const result = await upsertSeries(week.id, buildEntries());
    if (result.error) setError(result.error);
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!week) return;
    setPublishing(true);
    setError("");
    const saveResult = await upsertSeries(week.id, buildEntries());
    if (saveResult.error) {
      setError(saveResult.error);
      setPublishing(false);
      return;
    }
    const pubResult = await publishLines(week.id);
    if (pubResult.error) {
      setError(pubResult.error);
      setPublishing(false);
      return;
    }
    setPublished(true);
    setPublishing(false);
  };

  // ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Set Lines</h1>
          <p className="text-sm text-slate-400 mt-1">
            {week
              ? `Week ${week.week_number} — ${week.label}`
              : `Create Week ${nextWeekNumber} to get started`}
          </p>
        </div>
        {week && (
          <div className="flex items-center gap-3">
            <Badge variant={published ? "winning" : "void"}>
              {published ? "Published" : "Draft"}
            </Badge>
            {!published && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || selectedLines.length === 0}
                >
                  {saving ? "Saving..." : "Save Draft"}
                </Button>
                <Button
                  size="sm"
                  disabled={selectedLines.length === 0 || publishing}
                  onClick={handlePublish}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {publishing ? "Publishing..." : "Publish Lines"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ── Fetch Schedule Panel ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            Load MLB Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-slate-400">
            Pull the weekend&apos;s games directly from ESPN with DraftKings spread data. Select the
            Friday start date and click Fetch — all matchups will appear below
            for you to set spreads on.
          </p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Weekend (Friday)
              </label>
              <input
                type="date"
                value={fridayDate}
                onChange={(e) => setFridayDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
            <Button
              variant="secondary"
              onClick={handleFetchSchedule}
              disabled={fetching || !fridayDate}
              className="flex-shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${fetching ? "animate-spin" : ""}`} />
              {fetching ? "Fetching..." : "Fetch"}
            </Button>
          </div>
          {fetchResult && (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              {fetchResult}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Create Week Panel (only shown if no week yet) ──────── */}
      {!week && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Create Week {nextWeekNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Week Label"
              placeholder="e.g. Week 1 — Apr 18–20"
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Picks Lock Time
              </label>
              <input
                type="datetime-local"
                value={lockTime}
                onChange={(e) => setLockTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
              />
              <p className="text-xs text-slate-500 mt-1">
                Typically Friday&apos;s first pitch time
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleCreateWeek}
              disabled={!weekLabel.trim() || !lockTime || creatingWeek}
            >
              {creatingWeek ? "Creating..." : `Create Week ${nextWeekNumber}`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Series List ───────────────────────────────────────── */}
      {lines.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Available Series
            </h2>
            {week && !published && (
              <p className="text-xs text-slate-500">
                {selectedLines.length} selected for Week {week.week_number}
              </p>
            )}
          </div>

          {/* Group by weekend start date */}
          {Object.entries(
            lines.reduce<Record<string, LineEntry[]>>((acc, line) => {
              const key = line.startDate;
              (acc[key] ??= []).push(line);
              return acc;
            }, {})
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, group]) => (
              <div key={date} className="space-y-2">
                <p className="text-xs text-slate-500 font-medium px-1">
                  {new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  weekend
                </p>
                {group.map((line, i) => (
                  <Card
                    key={line.mlb_series_id}
                    className={line.selected ? "border-emerald-500/40" : ""}
                  >
                    <CardContent>
                      <div className="flex items-center gap-3">
                        {/* Select toggle */}
                        {!published && (
                          <button
                            onClick={() => toggleSelected(line.mlb_series_id)}
                            className="flex-shrink-0 text-slate-400 hover:text-emerald-400 transition-colors"
                            title={line.selected ? "Remove from week" : "Add to week"}
                          >
                            {line.selected ? (
                              <ToggleRight className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="w-5 h-5" />
                            )}
                          </button>
                        )}
                        {published && (
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            line.selected
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-slate-700/50 text-slate-500"
                          }`}>
                            {line.selected ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <span className="text-xs">{i + 1}</span>
                            )}
                          </div>
                        )}

                        {/* Teams */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-bold ${line.favorite === "away" ? "text-emerald-400" : "text-white"}`}>
                              {line.away}
                            </span>
                            <span className="text-xs text-slate-500">@</span>
                            <span className={`text-sm font-bold ${line.favorite === "home" ? "text-emerald-400" : "text-white"}`}>
                              {line.home}
                            </span>
                            {!published && line.selected && (
                              <button
                                onClick={() => toggleFavorite(line.mlb_series_id)}
                                className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors ml-1 border border-slate-700 rounded px-1"
                              >
                                flip fav
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            {line.games}-game series ·{" "}
                            <span className="text-slate-400 font-mono">
                              {line.favorite === "home" ? line.home : line.away} -{line.spread.toFixed(1)}
                            </span>
                            {line.hasDkSpread && (
                              <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded px-1 py-0.5">
                                DK
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Spread controls */}
                        {line.selected && !published ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => adjustSpread(line.mlb_series_id, -0.5)}
                              className="w-7 h-7 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-base font-bold font-mono text-white w-10 text-center">
                              {line.spread.toFixed(1)}
                            </span>
                            <button
                              onClick={() => adjustSpread(line.mlb_series_id, 0.5)}
                              className="w-7 h-7 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : line.selected ? (
                          <span className="text-base font-bold font-mono text-white">
                            {line.spread.toFixed(1)}
                          </span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
        </div>
      )}

      {lines.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">No MLB series loaded yet.</p>
          <p className="text-slate-500 text-xs mt-1">
            Use the &quot;Load MLB Schedule&quot; panel above to fetch the weekend&apos;s games.
          </p>
        </div>
      )}
    </div>
  );
}

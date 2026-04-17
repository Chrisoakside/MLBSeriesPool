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
  Clock,
} from "lucide-react";
import {
  getAdminLinesData,
  upsertSeries,
  publishLines,
  createWeek,
  seedMlbSchedule,
} from "@/actions/admin";
import { useParams } from "next/navigation";

interface MlbGame {
  id: string;
  game_date: string;
  game_time: string | null;
}

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
  mlb_games?: MlbGame[];
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
  firstGameTime: string | null;
  isSet: boolean;
  selected: boolean;
  hasDkSpread?: boolean;
}

function toValidHalfPoint(n: number): number {
  const rounded = Math.round(n * 2) / 2;
  const safe = Math.max(0.5, rounded);
  return safe % 1 === 0 ? safe + 0.5 : safe;
}

function getNextFriday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 5 ? 0 : (5 - day + 7) % 7;
  const friday = new Date(now);
  friday.setDate(now.getDate() + diff);
  return friday.toISOString().split("T")[0];
}

/** Format an ISO game_time string as a readable local time, e.g. "7:05 PM" */
function formatGameTime(isoStr: string | null): string {
  if (!isoStr) return "";
  try {
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch {
    return isoStr;
  }
}

/** Get the first game time for a series from its mlb_games array */
function getFirstGameTime(series: MlbSeries): string | null {
  const games = series.mlb_games ?? [];
  if (games.length === 0) return null;
  const sorted = [...games].sort((a, b) => {
    const at = a.game_time ?? a.game_date;
    const bt = b.game_time ?? b.game_date;
    return at.localeCompare(bt);
  });
  return sorted[0].game_time ?? null;
}

/** Return the upcoming Fri/Sat/Sun date strings for quick-pick buttons */
function getUpcomingWeekendDates(): { label: string; value: string }[] {
  const friday = getNextFriday();
  const fri = new Date(friday + "T12:00:00Z");
  return [0, 1, 2].map((offset) => {
    const d = new Date(fri);
    d.setUTCDate(d.getUTCDate() + offset);
    const dateStr = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    return { label, value: dateStr };
  });
}

const COMMON_TIMES = [
  { label: "6:05 PM", value: "18:05" },
  { label: "7:05 PM", value: "19:05" },
  { label: "7:10 PM", value: "19:10" },
  { label: "7:35 PM", value: "19:35" },
  { label: "8:05 PM", value: "20:05" },
  { label: "8:10 PM", value: "20:10" },
];

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

  // Week creation form — split date + time for better UX
  const [weekLabel, setWeekLabel] = useState("");
  const [lockDate, setLockDate] = useState("");
  const [lockTimeStr, setLockTimeStr] = useState("19:05");

  // Schedule fetch form
  const [fridayDate, setFridayDate] = useState(getNextFriday);

  const weekendDates = getUpcomingWeekendDates();

  // Combined lock datetime (local timezone)
  const lockDateTime = lockDate && lockTimeStr ? `${lockDate}T${lockTimeStr}` : "";

  const loadData = useCallback(async () => {
    const data = await getAdminLinesData(poolId);
    if (!data) { setLoading(false); return; }

    const mlb = data.mlbSeries as MlbSeries[];
    setAllMlbSeries(mlb);
    setNextWeekNumber(data.nextWeekNumber ?? 1);

    const toEntry = (m: MlbSeries, overrides?: Partial<LineEntry>): LineEntry => ({
      mlb_series_id: m.id,
      away: m.away_team_abbr,
      home: m.home_team_abbr,
      spread: toValidHalfPoint(m.dk_spread ?? 1.5),
      favorite: m.dk_favorite ?? "home",
      games: m.total_games_scheduled,
      startDate: m.series_start_date,
      firstGameTime: getFirstGameTime(m),
      isSet: false,
      selected: false,
      hasDkSpread: m.dk_spread !== null,
      ...overrides,
    });

    if (data.week) {
      setWeek(data.week);
      setPublished(data.week.status === "lines_set" || data.week.status === "locked");

      if (data.series.length > 0) {
        const selectedIds = new Set((data.series as ExistingSeries[]).map((s) => s.mlb_series_id));
        const existingLines = (data.series as ExistingSeries[]).map((s) =>
          toEntry(s.mlb_series, { spread: s.spread, favorite: s.favorite, isSet: true, selected: true })
        );
        const extras = mlb
          .filter((m) => !selectedIds.has(m.id))
          .map((m) => toEntry(m));
        setLines([...existingLines, ...extras]);
      } else {
        setLines(mlb.map((m) => toEntry(m)));
      }
    } else {
      setLines(mlb.map((m) => toEntry(m)));
    }

    setLoading(false);
  }, [poolId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Schedule fetch ──────────────────────────────────────────
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
          : `Loaded ${result.seriesCount} series (${result.gameCount} games).${
              "spreadsAvailable" in result && result.spreadsAvailable
                ? ` DraftKings spreads pre-filled for ${result.spreadsAvailable} games.`
                : " Spreads not yet posted — set them manually."
            }`
      );
      await loadData();
    }
    setFetching(false);
  };

  // ── Week creation ─────────────────────────────────────────────
  const handleCreateWeek = async () => {
    if (!weekLabel.trim() || !lockDateTime) return;
    setCreatingWeek(true);
    setError("");
    const result = await createWeek(
      poolId,
      nextWeekNumber,
      weekLabel.trim(),
      new Date(lockDateTime).toISOString()
    );
    if (result.error) { setError(result.error); setCreatingWeek(false); return; }
    await loadData();
    setCreatingWeek(false);
  };

  // ── Spread / favorite controls ────────────────────────────────
  const adjustSpread = (mlbId: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.mlb_series_id !== mlbId) return l;
        const raw = Math.round((l.spread + delta) * 2) / 2;
        return { ...l, spread: Math.max(0.5, raw), isSet: true };
      })
    );
  };

  const toggleFavorite = (mlbId: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.mlb_series_id === mlbId
          ? { ...l, favorite: l.favorite === "home" ? "away" : "home", isSet: true }
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

  /** Select or deselect all series in a date group */
  const toggleSelectAll = (date: string) => {
    const group = lines.filter((l) => l.startDate === date);
    const allSelected = group.every((l) => l.selected);
    setLines((prev) =>
      prev.map((l) =>
        l.startDate === date
          ? { ...l, selected: !allSelected, isSet: !allSelected }
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
    if (saveResult.error) { setError(saveResult.error); setPublishing(false); return; }
    const pubResult = await publishLines(week.id);
    if (pubResult.error) { setError(pubResult.error); setPublishing(false); return; }
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
            Pull the weekend&apos;s games from ESPN with DraftKings spread data.
            Select the Friday start date and click Fetch.
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

      {/* ── Create Week Panel ─────────────────────────────────── */}
      {!week && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Create Week {nextWeekNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Input
              label="Week Label"
              placeholder="e.g. Week 1 — Apr 18–20"
              value={weekLabel}
              onChange={(e) => setWeekLabel(e.target.value)}
            />

            {/* Lock Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Clock className="w-3.5 h-3.5 inline mr-1.5 text-emerald-400" />
                Lock Date
              </label>
              {/* Quick-pick buttons for upcoming Fri/Sat/Sun */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                {weekendDates.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setLockDate(d.value)}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      lockDate === d.value
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={lockDate}
                onChange={(e) => setLockDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            {/* Lock Time */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Lock Time
              </label>
              {/* Common first-pitch presets */}
              <div className="flex flex-wrap gap-2 mb-2">
                {COMMON_TIMES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setLockTimeStr(t.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      lockTimeStr === t.value
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                type="time"
                value={lockTimeStr}
                onChange={(e) => setLockTimeStr(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
              />
              {lockDate && lockTimeStr && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Picks lock:{" "}
                  <span className="text-slate-400">
                    {new Date(`${lockDate}T${lockTimeStr}`).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleCreateWeek}
              disabled={!weekLabel.trim() || !lockDateTime || creatingWeek}
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
              (acc[line.startDate] ??= []).push(line);
              return acc;
            }, {})
          )
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, group]) => {
              const allSelected = group.every((l) => l.selected);
              const someSelected = group.some((l) => l.selected);

              return (
                <div key={date} className="space-y-2">
                  {/* Date group header + Select All */}
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-slate-500 font-medium">
                      {new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      weekend
                    </p>
                    {!published && (
                      <button
                        onClick={() => toggleSelectAll(date)}
                        className={`text-xs font-medium transition-colors cursor-pointer ${
                          allSelected
                            ? "text-emerald-400 hover:text-emerald-300"
                            : someSelected
                            ? "text-slate-400 hover:text-white"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                    )}
                  </div>

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

                          {/* Teams + first game time */}
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
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{line.games}-game series</span>
                              <span>·</span>
                              <span className="text-slate-400 font-mono">
                                {line.favorite === "home" ? line.home : line.away} -{line.spread.toFixed(1)}
                              </span>
                              {line.hasDkSpread && (
                                <span className="text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded px-1 py-0.5">
                                  DK
                                </span>
                              )}
                              {line.firstGameTime && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-0.5 text-slate-500">
                                    <Clock className="w-2.5 h-2.5" />
                                    {formatGameTime(line.firstGameTime)}
                                  </span>
                                </>
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
              );
            })}
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

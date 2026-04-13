"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Minus, Plus, Send, Calendar } from "lucide-react";
import {
  getAdminLinesData,
  upsertSeries,
  publishLines,
  createWeek,
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
  isSet: boolean;
}

export default function AdminLinesPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [lines, setLines] = useState<LineEntry[]>([]);
  const [mlbSeries, setMlbSeries] = useState<MlbSeries[]>([]);
  const [week, setWeek] = useState<{ id: string; week_number: number; label: string; status: string } | null>(null);
  const [nextWeekNumber, setNextWeekNumber] = useState(1);
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creatingWeek, setCreatingWeek] = useState(false);
  const [error, setError] = useState("");

  // Week creation form state
  const [weekLabel, setWeekLabel] = useState("");
  const [lockTime, setLockTime] = useState("");

  const loadData = async () => {
    const data = await getAdminLinesData(poolId);
    if (!data) {
      setLoading(false);
      return;
    }

    setMlbSeries(data.mlbSeries as MlbSeries[]);
    setNextWeekNumber(data.nextWeekNumber ?? 1);

    if (data.week) {
      setWeek(data.week);
      setPublished(data.week.status === "lines_set" || data.week.status === "locked");

      if (data.series.length > 0) {
        const existingLines = (data.series as ExistingSeries[]).map((s) => ({
          mlb_series_id: s.mlb_series_id,
          away: s.mlb_series.away_team_abbr,
          home: s.mlb_series.home_team_abbr,
          spread: s.spread,
          favorite: s.favorite,
          games: s.mlb_series.total_games_scheduled,
          isSet: true,
        }));
        setLines(existingLines);
      } else {
        const availableLines = (data.mlbSeries as MlbSeries[]).slice(0, 15).map((mlb) => ({
          mlb_series_id: mlb.id,
          away: mlb.away_team_abbr,
          home: mlb.home_team_abbr,
          spread: 1.5,
          favorite: "home" as const,
          games: mlb.total_games_scheduled,
          isSet: false,
        }));
        setLines(availableLines);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [poolId]);

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

    // Reload to get the new week + mlb series
    await loadData();
    setCreatingWeek(false);
  };

  const setCount = lines.filter((l) => l.isSet).length;
  const allSet = setCount === lines.length && lines.length > 0;

  const adjustSpread = (mlbId: string, delta: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.mlb_series_id !== mlbId) return l;
        const newSpread = Math.max(0.5, l.spread + delta);
        return { ...l, spread: newSpread, isSet: true };
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

  const handleSave = async () => {
    if (!week) return;
    setSaving(true);
    setError("");

    const entries = lines
      .filter((l) => l.isSet)
      .map((l) => ({
        mlb_series_id: l.mlb_series_id,
        spread: l.spread,
        favorite: l.favorite,
      }));

    const result = await upsertSeries(week.id, entries);
    if (result.error) setError(result.error);
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!week) return;
    setPublishing(true);
    setError("");

    const entries = lines
      .filter((l) => l.isSet)
      .map((l) => ({
        mlb_series_id: l.mlb_series_id,
        spread: l.spread,
        favorite: l.favorite,
      }));

    const saveResult = await upsertSeries(week.id, entries);
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

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // No week yet — show creation form
  if (!week) {
    return (
      <div className="space-y-6 max-w-lg">
        <div>
          <h1 className="text-2xl font-bold text-white">Set Lines</h1>
          <p className="text-sm text-slate-400 mt-1">
            Create Week {nextWeekNumber} to get started.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-4.5 h-4.5 text-emerald-400" />
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
                Lock Time
              </label>
              <input
                type="datetime-local"
                value={lockTime}
                onChange={(e) => setLockTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
              />
              <p className="text-xs text-slate-500 mt-1">
                Picks lock at this time — typically Friday&apos;s first pitch
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Set Lines</h1>
          <p className="text-sm text-slate-400 mt-1">
            Week {week.week_number} — {week.label}
          </p>
        </div>
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
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                size="sm"
                disabled={!allSet || publishing}
                onClick={handlePublish}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {publishing ? "Publishing..." : "Publish Lines"}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${lines.length > 0 ? (setCount / lines.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-sm text-slate-400 font-mono">
          {setCount}/{lines.length}
        </span>
      </div>

      {/* Lines List */}
      <div className="space-y-3">
        {lines.map((line, i) => (
          <Card key={line.mlb_series_id}>
            <CardContent>
              <div className="flex items-center gap-4">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    line.isSet
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-slate-700/50 text-slate-500"
                  }`}
                >
                  {line.isSet ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <span className="text-xs">{i + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${line.favorite === "away" ? "text-emerald-400" : "text-white"}`}
                    >
                      {line.away}
                    </span>
                    <span className="text-xs text-slate-500">@</span>
                    <span
                      className={`text-sm font-medium ${line.favorite === "home" ? "text-emerald-400" : "text-white"}`}
                    >
                      {line.home}
                    </span>
                    {!published && (
                      <button
                        onClick={() => toggleFavorite(line.mlb_series_id)}
                        className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors ml-1"
                      >
                        flip
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {line.games}-game series
                  </p>
                </div>

                {!published ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustSpread(line.mlb_series_id, -1)}
                      className="w-7 h-7 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-lg font-bold font-mono text-white w-12 text-center">
                      {line.spread.toFixed(1)}
                    </span>
                    <button
                      onClick={() => adjustSpread(line.mlb_series_id, 1)}
                      className="w-7 h-7 rounded-md bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-lg font-bold font-mono text-white">
                    {line.spread.toFixed(1)}
                  </span>
                )}

                <div className="hidden sm:block w-32 text-right">
                  <span className="text-sm font-mono text-slate-300">
                    {line.favorite === "home" ? line.home : line.away} -{line.spread.toFixed(1)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {lines.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-500">No MLB series available. Add series to the mlb_series table first.</p>
        </div>
      )}
    </div>
  );
}

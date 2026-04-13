/**
 * ingest-scores Edge Function
 *
 * Fetches MLB game scores from the MLB Stats API, updates mlb_games,
 * recomputes mlb_series cumulative runs, and triggers set-based ticket
 * recomputation for affected series. Broadcasts score updates to pools.
 *
 * Authentication: requires X-Ingest-Secret header matching INGEST_SECRET env var.
 * Called by pg_cron via pg_net every 2 min during games, 10 min otherwise.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

interface MlbScheduleGame {
  gamePk: number;
  gameDate: string;
  status: {
    abstractGameState: string;
    detailedState: string;
  };
  teams: {
    away: { team: { id: number; abbreviation: string }; score?: number };
    home: { team: { id: number; abbreviation: string }; score?: number };
  };
  linescore?: {
    currentInning?: number;
    inningState?: string;
  };
  doubleHeader: string;
}

function mapStatus(abstractState: string, detailedState: string): string {
  if (abstractState === "Final") return "final";
  if (abstractState === "Live") return "in_progress";
  if (detailedState.includes("Postponed")) return "postponed";
  if (detailedState.includes("Suspended")) return "suspended";
  if (detailedState.includes("Cancelled")) return "cancelled";
  return "scheduled";
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth check
  const ingestSecret = Deno.env.get("INGEST_SECRET");
  const providedSecret = req.headers.get("x-ingest-secret");
  if (!ingestSecret || providedSecret !== ingestSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Determine dates to fetch (Fri-Sun of the current active weekend)
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Check if any games are active today
    const { data: activeSeries } = await supabase
      .from("weeks")
      .select("id, pool_id")
      .in("status", ["lines_set", "locked"]);

    if (!activeSeries || activeSeries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active weeks, skipping" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all mlb_series IDs referenced by active weeks
    const weekIds = activeSeries.map((w: { id: string }) => w.id);
    const { data: activeMlbSeries } = await supabase
      .from("series")
      .select("mlb_series_id, mlb_series(id, series_start_date, series_end_date)")
      .in("week_id", weekIds);

    if (!activeMlbSeries || activeMlbSeries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No series configured, skipping" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get date range from active series
    const seriesDates = activeMlbSeries.flatMap((s: { mlb_series: { series_start_date: string; series_end_date: string } | null }) => {
      const mlb = s.mlb_series;
      if (!mlb) return [];
      return [mlb.series_start_date, mlb.series_end_date];
    });

    const startDate = seriesDates.sort()[0] ?? todayStr;
    const endDate = seriesDates.sort().reverse()[0] ?? todayStr;

    // Fetch from MLB Stats API
    const mlbUrl = `${MLB_API_BASE}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&hydrate=linescore&language=en`;
    const mlbResp = await fetch(mlbUrl, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!mlbResp.ok) {
      throw new Error(`MLB API error: ${mlbResp.status}`);
    }

    const mlbData = await mlbResp.json();
    const allGames: MlbScheduleGame[] = (mlbData.dates ?? []).flatMap(
      (d: { games: MlbScheduleGame[] }) => d.games ?? []
    );

    if (allGames.length === 0) {
      return new Response(
        JSON.stringify({ message: "No games found from MLB API" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing mlb_games to detect changes (delta-based)
    const gamePks = allGames.map((g) => g.gamePk);
    const { data: existingGames } = await supabase
      .from("mlb_games")
      .select("mlb_game_pk, away_score, home_score, status, inning, inning_state, mlb_series_id")
      .in("mlb_game_pk", gamePks);

    const existingMap = new Map(
      (existingGames ?? []).map((g: { mlb_game_pk: number; away_score: number; home_score: number; status: string; inning: number | null; inning_state: string | null; mlb_series_id: string }) => [g.mlb_game_pk, g])
    );

    // Build updates — only for games that changed
    const changedMlbSeriesIds = new Set<string>();
    const updates: Array<{
      mlb_game_pk: number;
      away_score: number;
      home_score: number;
      status: string;
      inning: number | null;
      inning_state: string | null;
    }> = [];

    for (const game of allGames) {
      const status = mapStatus(
        game.status.abstractGameState,
        game.status.detailedState
      );
      const awayScore = game.teams.away.score ?? 0;
      const homeScore = game.teams.home.score ?? 0;
      const inning = game.linescore?.currentInning ?? null;
      const inningState = game.linescore?.inningState ?? null;

      const existing = existingMap.get(game.gamePk);
      if (!existing) continue; // Only update existing — new games are created by admin

      const changed =
        existing.away_score !== awayScore ||
        existing.home_score !== homeScore ||
        existing.status !== status ||
        existing.inning !== inning ||
        existing.inning_state !== inningState;

      if (changed) {
        updates.push({ mlb_game_pk: game.gamePk, away_score: awayScore, home_score: homeScore, status, inning, inning_state: inningState });
        changedMlbSeriesIds.add(existing.mlb_series_id);
      }
    }

    if (updates.length === 0) {
      return new Response(
        JSON.stringify({ message: "No changes detected", gamesChecked: allGames.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply game score updates
    for (const update of updates) {
      await supabase
        .from("mlb_games")
        .update({
          away_score: update.away_score,
          home_score: update.home_score,
          status: update.status,
          inning: update.inning,
          inning_state: update.inning_state,
          updated_at: new Date().toISOString(),
        })
        .eq("mlb_game_pk", update.mlb_game_pk);
    }

    // Recompute cumulative runs for affected mlb_series
    const changedIds = Array.from(changedMlbSeriesIds);
    for (const seriesId of changedIds) {
      const { data: games } = await supabase
        .from("mlb_games")
        .select("away_score, home_score, status")
        .eq("mlb_series_id", seriesId)
        .in("status", ["final", "in_progress"]);

      const totalRunsAway = (games ?? []).reduce((sum: number, g: { away_score: number }) => sum + (g.away_score ?? 0), 0);
      const totalRunsHome = (games ?? []).reduce((sum: number, g: { home_score: number }) => sum + (g.home_score ?? 0), 0);
      const gamesCompleted = (games ?? []).filter((g: { status: string }) => g.status === "final").length;

      // Check if all games are final/void
      const { data: allGamesForSeries } = await supabase
        .from("mlb_games")
        .select("status")
        .eq("mlb_series_id", seriesId);

      const totalScheduled = (allGamesForSeries ?? []).length;
      const allDone = (allGamesForSeries ?? []).every((g: { status: string }) =>
        ["final", "postponed", "cancelled", "suspended"].includes(g.status)
      );
      const seriesStatus = allDone && gamesCompleted >= 2 ? "final" : "in_progress";

      await supabase
        .from("mlb_series")
        .update({
          total_runs_away: totalRunsAway,
          total_runs_home: totalRunsHome,
          games_completed: gamesCompleted,
          status: seriesStatus,
        })
        .eq("id", seriesId);
    }

    // Set-based ticket pick recomputation for affected series (single call with all IDs)
    await supabase.rpc("recompute_tickets_for_series", {
      p_changed_mlb_series_ids: changedIds,
    });

    // Broadcast score update to affected pools
    const { data: affectedSeries } = await supabase
      .from("series")
      .select("week_id, weeks(pool_id)")
      .in("mlb_series_id", changedIds);

    const affectedPoolIds = new Set(
      (affectedSeries ?? []).map((s: { weeks: { pool_id: string } | null }) => s.weeks?.pool_id).filter(Boolean)
    );

    for (const poolId of affectedPoolIds) {
      await supabase.channel(`pool:${poolId}`).send({
        type: "broadcast",
        event: "scores_updated",
        payload: { updatedSeriesIds: changedIds, timestamp: new Date().toISOString() },
      });
    }

    return new Response(
      JSON.stringify({
        message: "Scores ingested",
        gamesUpdated: updates.length,
        seriesRecomputed: changedIds.length,
        poolsNotified: affectedPoolIds.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ingest-scores error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

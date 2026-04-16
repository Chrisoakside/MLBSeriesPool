"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchGamesForDates } from "@/lib/mlb-api";

/**
 * Fetch the MLB schedule for a given weekend (Fri–Sun) and seed the
 * mlb_series + mlb_games tables. Games are grouped into series by
 * matching team pairs. Safe to call multiple times (upserts on unique keys).
 *
 * Uses the service-role client for DB writes because mlb_series and
 * mlb_games have RLS policies that deny writes from authenticated users.
 */
export async function seedMlbSchedule(fridayDate: string) {
  // Auth check with regular client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Service-role client for MLB table writes (bypasses RLS)
  const serviceSupabase = createServiceClient();

  // Build Fri–Sun date strings
  const friday = new Date(fridayDate + "T12:00:00Z");
  const dates = [0, 1, 2].map((offset) => {
    const d = new Date(friday);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().split("T")[0];
  });

  let games;
  try {
    games = await fetchGamesForDates(dates);
  } catch (err) {
    return { error: `MLB API error: ${String(err)}` };
  }

  if (!games.length) {
    return { seriesCount: 0, gameCount: 0, message: "No games found for those dates" };
  }

  // Group games into series: same home+away team pair over the weekend
  // Key = awayTeamId-homeTeamId (venue-specific, not sorted, so HOU@NYY ≠ NYY@HOU)
  const seriesMap = new Map<string, typeof games>();
  for (const game of games) {
    const key = `${game.awayTeamId}-${game.homeTeamId}`;
    const existing = seriesMap.get(key) ?? [];
    existing.push(game);
    seriesMap.set(key, existing);
  }

  let seriesCount = 0;
  let gameCount = 0;
  const seasonYear = parseInt(dates[0].split("-")[0]);

  for (const [, seriesGames] of seriesMap) {
    const sorted = [...seriesGames].sort((a, b) => a.gameDate.localeCompare(b.gameDate));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const seriesKey = `${first.awayTeamId}-${first.homeTeamId}-${first.gameDate}`;

    // Use spread from the first game that has odds (usually the opener)
    const gameWithOdds = sorted.find((g) => g.spread !== null) ?? sorted[0];
    const seriesSpread = gameWithOdds.spread ?? 1.5;
    const seriesFavorite = gameWithOdds.favorite ?? "home";

    // Upsert mlb_series (service role bypasses RLS)
    const { data: seriesRow, error: seriesErr } = await serviceSupabase
      .from("mlb_series")
      .upsert(
        {
          season_year: seasonYear,
          series_start_date: first.gameDate,
          series_end_date: last.gameDate,
          away_team_abbr: first.awayTeamAbbr,
          home_team_abbr: first.homeTeamAbbr,
          away_team_name: first.awayTeamName,
          home_team_name: first.homeTeamName,
          total_games_scheduled: sorted.length,
          mlb_api_series_key: seriesKey,
          status: "pending",
          dk_spread: seriesSpread,
          dk_favorite: seriesFavorite,
        },
        { onConflict: "mlb_api_series_key", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (seriesErr || !seriesRow) {
      console.error("mlb_series upsert error:", seriesErr?.message);
      continue;
    }
    seriesCount++;

    // Upsert each game (service role bypasses RLS)
    for (const game of sorted) {
      const { error: gameErr } = await serviceSupabase
        .from("mlb_games")
        .upsert(
          {
            mlb_series_id: seriesRow.id,
            mlb_game_pk: game.gamePk,
            game_date: game.gameDate,
            game_time: game.gameTime,
            away_score: game.awayScore,
            home_score: game.homeScore,
            status: game.status,
            is_doubleheader: game.isDoubleheader,
            inning: game.inning,
            inning_state: game.inningState,
            away_probable_pitcher: game.awayProbablePitcher,
            home_probable_pitcher: game.homeProbablePitcher,
          },
          { onConflict: "mlb_game_pk", ignoreDuplicates: false }
        );
      if (gameErr) console.error("mlb_games upsert error:", gameErr.message);
      else gameCount++;
    }
  }

  return { seriesCount, gameCount, spreadsAvailable: games.filter(g => g.spread !== null).length };
}

export async function createWeek(
  poolId: string,
  weekNumber: number,
  label: string,
  lockTime: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_week", {
    p_pool_id: poolId,
    p_week_number: weekNumber,
    p_label: label,
    p_lock_time: lockTime,
  });
  if (error) return { error: error.message };
  return { weekId: data };
}

/**
 * Snap a spread value to the nearest valid half-point (1.5, 2.5, 3.5…).
 * The `series` table has CHECK (spread != 0 AND (ABS(spread) * 10) % 10 = 5).
 * Whole-number spreads (e.g. 2.0 from DK) are bumped up to the next .5 (2.5).
 */
function toValidHalfPoint(n: number): number {
  const rounded = Math.round(n * 2) / 2; // nearest multiple of 0.5
  const safe = Math.max(0.5, rounded);
  // If still a whole number, nudge up to the next half-point
  return safe % 1 === 0 ? safe + 0.5 : safe;
}

export async function upsertSeries(
  weekId: string,
  seriesEntries: {
    mlb_series_id: string;
    spread: number;
    favorite: "home" | "away";
  }[]
) {
  const supabase = await createClient();

  // Delete existing series for this week, then insert new ones
  await supabase.from("series").delete().eq("week_id", weekId);

  const rows = seriesEntries.map((s) => ({
    week_id: weekId,
    mlb_series_id: s.mlb_series_id,
    // Enforce half-point constraint server-side (DK sometimes returns whole numbers)
    spread: toValidHalfPoint(s.spread),
    favorite: s.favorite,
  }));

  const { error } = await supabase.from("series").insert(rows);
  if (error) return { error: error.message };
  return { success: true };
}

export async function publishLines(weekId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_lines", {
    p_week_id: weekId,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function getAdminLinesData(poolId: string) {
  const supabase = await createClient();

  // Current week (most recent)
  const { data: week } = await supabase
    .from("weeks")
    .select("*")
    .eq("pool_id", poolId)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();

  // Available MLB series — show upcoming/current weekend first
  const { data: mlbSeries } = await supabase
    .from("mlb_series")
    .select("*")
    .order("series_start_date", { ascending: true })
    .limit(60);

  // If no week yet, return enough to show the "create week" form
  if (!week) {
    return {
      week: null,
      series: [],
      mlbSeries: mlbSeries ?? [],
      nextWeekNumber: 1,
    };
  }

  // Existing series for this week
  const { data: seriesList } = await supabase
    .from("series")
    .select("*, mlb_series(*)")
    .eq("week_id", week.id);

  return {
    week,
    series: seriesList ?? [],
    mlbSeries: mlbSeries ?? [],
    nextWeekNumber: week.week_number + 1,
  };
}

export async function getPaymentsData(poolId: string) {
  const supabase = await createClient();

  // Get recent weeks
  const { data: weeks } = await supabase
    .from("weeks")
    .select("id, week_number")
    .eq("pool_id", poolId)
    .order("week_number", { ascending: false })
    .limit(3);

  if (!weeks?.length) return null;

  // Get all members
  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id, profiles(display_name)")
    .eq("pool_id", poolId)
    .eq("is_approved", true);

  // Get payments for recent weeks
  const weekIds = weeks.map((w) => w.id);
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("pool_id", poolId)
    .in("week_id", weekIds);

  // Get pool entry fee
  const { data: pool } = await supabase
    .from("pools")
    .select("entry_fee")
    .eq("id", poolId)
    .single();

  return {
    weeks: weeks ?? [],
    members: members ?? [],
    payments: payments ?? [],
    entryFee: pool?.entry_fee ?? 0,
  };
}

export async function togglePayment(
  poolId: string,
  weekId: string,
  userId: string,
  isPaid: boolean,
  amount: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Use service role to bypass RLS (payments table denies writes from authenticated role)
  const service = createServiceClient();

  // Check current payment state so we only add a ledger entry when state changes
  const { data: existing } = await service
    .from("payments")
    .select("is_paid")
    .eq("pool_id", poolId)
    .eq("week_id", weekId)
    .eq("user_id", userId)
    .single();

  const wasPaid = existing?.is_paid ?? false;

  // Upsert payment record
  const { error } = await service
    .from("payments")
    .upsert(
      {
        pool_id: poolId,
        week_id: weekId,
        user_id: userId,
        amount,
        is_paid: isPaid,
        paid_at: isPaid ? new Date().toISOString() : null,
        marked_by: user.id,
      },
      { onConflict: "pool_id,week_id,user_id" }
    );

  if (error) return { error: error.message };

  // Only update jackpot ledger when the paid state actually changes
  if (wasPaid !== isPaid) {
    const ledgerAmount = isPaid ? amount : -amount;
    const { error: ledgerErr } = await service.from("jackpot_ledger").insert({
      pool_id: poolId,
      week_id: weekId,
      entry_type: isPaid ? "entry_fee" : "adjustment",
      amount: ledgerAmount,
      description: isPaid
        ? `Entry fee collected`
        : `Entry fee reversed`,
      created_by: user.id,
    });
    if (ledgerErr) return { error: ledgerErr.message };
  }

  return { success: true };
}

export async function getJackpotData(poolId: string) {
  const supabase = await createClient();

  const { data: ledger } = await supabase
    .from("jackpot_ledger")
    .select("*")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false })
    .limit(50);

  const currentBalance = ledger?.[0]?.running_balance ?? 0;

  // Totals
  const totalCollected = (ledger ?? [])
    .filter((e) => e.entry_type === "entry_fee")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPayouts = (ledger ?? [])
    .filter((e) => e.entry_type === "payout")
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
  const totalRake = (ledger ?? [])
    .filter((e) => e.entry_type === "rake")
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);

  return {
    ledger: ledger ?? [],
    currentBalance,
    totalCollected,
    totalPayouts,
    totalRake,
  };
}

export async function addJackpotAdjustment(
  poolId: string,
  amount: number,
  description: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("jackpot_ledger").insert({
    pool_id: poolId,
    entry_type: "adjustment",
    amount,
    description,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function getPoolSettings(poolId: string) {
  const supabase = await createClient();

  const { data: pool } = await supabase
    .from("pools")
    .select("*")
    .eq("id", poolId)
    .single();

  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id, role, joined_at, profiles(display_name)")
    .eq("pool_id", poolId)
    .eq("is_approved", true)
    .order("joined_at", { ascending: true });

  return { pool, members: members ?? [] };
}

export async function updatePoolSettings(
  poolId: string,
  updates: { name?: string; entry_fee?: number }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pools")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", poolId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function removeMember(poolId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return { success: true };
}

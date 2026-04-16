"use server";

import { createClient } from "@/lib/supabase/server";

export async function getPicksData(poolId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get current week
  const { data: week } = await supabase
    .from("weeks")
    .select("*")
    .eq("pool_id", poolId)
    .in("status", ["lines_set", "locked"])
    .order("week_number", { ascending: false })
    .limit(1)
    .single();

  if (!week) return null;

  // Get series with games (including mlb_game_pk so we can look up pitchers)
  const { data: seriesList } = await supabase
    .from("series")
    .select("*, mlb_series(*, mlb_games(id, mlb_game_pk, game_date, game_time, away_probable_pitcher, home_probable_pitcher))")
    .eq("week_id", week.id);

  // Get user's existing ticket
  const { data: existingTicket } = await supabase
    .from("tickets")
    .select("*, ticket_picks(series_id, picked_side)")
    .eq("week_id", week.id)
    .eq("user_id", user.id)
    .single();

  // Fetch live probable pitcher data from MLB Stats API for the full Fri–Sun weekend.
  // Always cover 3 days so Saturday/Sunday pitchers show even if only Friday games
  // are stored in mlb_games (which happens when the schedule was seeded early).
  const allGames = (seriesList ?? []).flatMap(
    (s: { mlb_series: { mlb_games: { mlb_game_pk: number; game_date: string }[] } }) =>
      s.mlb_series?.mlb_games ?? []
  );
  const rawDates = [...new Set(allGames.map((g) => g.game_date))].sort();

  // Extend to full 3-day weekend starting from the earliest game date (Friday)
  let weekendDates: string[] = rawDates;
  if (rawDates.length > 0) {
    const friday = new Date(rawDates[0] + "T12:00:00Z");
    weekendDates = [0, 1, 2].map((offset) => {
      const d = new Date(friday);
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().split("T")[0];
    });
  }

  // Keyed by "YYYY-MM-DD|AWAY|HOME" so we can look up without knowing the gamePk
  const pitcherMap: Record<string, { away: string | null; home: string | null }> = {};

  if (weekendDates.length > 0) {
    try {
      const url =
        `https://statsapi.mlb.com/api/v1/schedule` +
        `?sportId=1&startDate=${weekendDates[0]}&endDate=${weekendDates[weekendDates.length - 1]}` +
        `&hydrate=team,probablePitcher(person)&language=en`;
      const resp = await fetch(url, {
        headers: { "User-Agent": "SeriesSpreadPool/1.0" },
        signal: AbortSignal.timeout(8_000),
      });
      if (resp.ok) {
        const data = await resp.json();
        for (const date of data.dates ?? []) {
          for (const game of date.games ?? []) {
            const awayAbbr = game.teams?.away?.team?.abbreviation;
            const homeAbbr = game.teams?.home?.team?.abbreviation;
            if (!awayAbbr || !homeAbbr) continue;
            pitcherMap[`${date.date}|${awayAbbr}|${homeAbbr}`] = {
              away: game.teams?.away?.probablePitcher?.fullName ?? null,
              home: game.teams?.home?.probablePitcher?.fullName ?? null,
            };
          }
        }
      }
    } catch {
      // Pitcher data is best-effort — don't fail page load if MLB API is slow
    }
  }

  return {
    week,
    series: seriesList ?? [],
    existingPicks: existingTicket?.ticket_picks ?? [],
    isLocked: new Date(week.lock_time) <= new Date(),
    pitcherMap,
  };
}

export async function submitPicks(
  poolId: string,
  weekId: string,
  picks: { series_id: string; picked_side: "home" | "away" }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("submit_ticket", {
    p_pool_id: poolId,
    p_week_id: weekId,
    p_picks: picks,
  });

  if (error) return { error: error.message };
  return { ticketId: data };
}

export async function getTicketData(poolId: string, weekId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get the week (specified or current)
  let week;
  if (weekId) {
    const { data } = await supabase.from("weeks").select("*").eq("id", weekId).single();
    week = data;
  } else {
    const { data } = await supabase
      .from("weeks")
      .select("*")
      .eq("pool_id", poolId)
      .order("week_number", { ascending: false })
      .limit(1)
      .single();
    week = data;
  }
  if (!week) return null;

  // Get user's ticket with picks and full series/game data
  const { data: ticket } = await supabase
    .from("tickets")
    .select(`
      *,
      ticket_picks (
        *,
        series (
          *,
          mlb_series (
            *,
            mlb_games (*)
          )
        )
      )
    `)
    .eq("week_id", week.id)
    .eq("user_id", user.id)
    .single();

  return { week, ticket };
}

export async function getScoresData(poolId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Current week
  const { data: week } = await supabase
    .from("weeks")
    .select("*")
    .eq("pool_id", poolId)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();
  if (!week) return null;

  // All series with games
  const { data: seriesList } = await supabase
    .from("series")
    .select("*, mlb_series(*, mlb_games(*))")
    .eq("week_id", week.id);

  // User's picks for this week
  const { data: ticket } = await supabase
    .from("tickets")
    .select("ticket_picks(series_id)")
    .eq("week_id", week.id)
    .eq("user_id", user.id)
    .single();

  const pickedSeriesIds = new Set(
    ticket?.ticket_picks?.map((p: { series_id: string }) => p.series_id) ?? []
  );

  return {
    week,
    series: seriesList ?? [],
    pickedSeriesIds: Array.from(pickedSeriesIds),
  };
}

export async function getBoardData(poolId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Current week
  const { data: week } = await supabase
    .from("weeks")
    .select("*")
    .eq("pool_id", poolId)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();
  if (!week) return null;

  const isLocked = new Date(week.lock_time) <= new Date();
  if (!isLocked) return { week, isLocked, board: [], series: [] };

  // All series
  const { data: seriesList } = await supabase
    .from("series")
    .select("id, spread, favorite, mlb_series(away_team_abbr, home_team_abbr)")
    .eq("week_id", week.id);

  // All tickets with picks
  const { data: tickets } = await supabase
    .from("tickets")
    .select(`
      user_id,
      correct_picks,
      total_valid_picks,
      status,
      profiles!tickets_user_id_fkey(display_name),
      ticket_picks(series_id, picked_side, result)
    `)
    .eq("week_id", week.id)
    .eq("pool_id", poolId);

  return {
    week,
    isLocked,
    series: seriesList ?? [],
    board: tickets ?? [],
    currentUserId: user.id,
  };
}

export async function getLeaderboardData(poolId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get all resolved tickets for this pool
  const { data: tickets } = await supabase
    .from("tickets")
    .select("user_id, correct_picks, total_valid_picks, status, week_id")
    .eq("pool_id", poolId)
    .in("status", ["won", "lost"]);

  // Get all members
  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id, profiles(display_name)")
    .eq("pool_id", poolId)
    .eq("is_approved", true);

  // Compute standings
  const standings = new Map<string, {
    name: string;
    wins: number;
    losses: number;
    perfectWeeks: number;
    bestWeek: { correct: number; week: string };
  }>();

  for (const member of members ?? []) {
    const profile = member.profiles as unknown as { display_name: string };
    standings.set(member.user_id, {
      name: profile?.display_name ?? "Unknown",
      wins: 0,
      losses: 0,
      perfectWeeks: 0,
      bestWeek: { correct: 0, week: "" },
    });
  }

  for (const ticket of tickets ?? []) {
    const entry = standings.get(ticket.user_id);
    if (!entry) continue;
    entry.wins += ticket.correct_picks;
    entry.losses += ticket.total_valid_picks - ticket.correct_picks;
    if (ticket.status === "won") entry.perfectWeeks++;
    if (ticket.correct_picks > entry.bestWeek.correct) {
      entry.bestWeek = { correct: ticket.correct_picks, week: ticket.week_id };
    }
  }

  const sorted = Array.from(standings.entries())
    .map(([userId, data]) => ({
      userId,
      ...data,
      record: `${data.wins}-${data.losses}`,
      pct: data.wins + data.losses > 0
        ? ((data.wins / (data.wins + data.losses)) * 100).toFixed(1) + "%"
        : "0.0%",
    }))
    .sort((a, b) => {
      const pctA = a.wins / (a.wins + a.losses || 1);
      const pctB = b.wins / (b.wins + b.losses || 1);
      return pctB - pctA;
    });

  return { standings: sorted, currentUserId: user.id };
}

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? "2026-04-18";
  const results: Record<string, unknown> = {};

  // Test 1: MLB Stats API base (no hydrate)
  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${date}&endDate=${date}&language=en`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const d = await r.json();
    results.mlb_base = { status: r.status, totalGames: d.totalGames, dates: d.dates?.length };
  } catch (e) {
    results.mlb_base = { error: String(e) };
  }

  // Test 2: MLB Stats API with hydrate=team
  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${date}&endDate=${date}&hydrate=team,linescore&language=en`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const d = await r.json();
    const firstGame = d.dates?.[0]?.games?.[0];
    results.mlb_hydrated = {
      status: r.status,
      totalGames: d.totalGames,
      firstGame: firstGame ? {
        gamePk: firstGame.gamePk,
        away: firstGame.teams?.away?.team?.abbreviation,
        home: firstGame.teams?.home?.team?.abbreviation,
        awayName: firstGame.teams?.away?.team?.teamName,
        homeName: firstGame.teams?.home?.team?.teamName,
      } : null,
    };
  } catch (e) {
    results.mlb_hydrated = { error: String(e) };
  }

  // Test 3: ESPN scoreboard
  try {
    const espnDate = date.replace(/-/g, "");
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${espnDate}&limit=5`;
    const r = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    const d = await r.json();
    results.espn = { status: r.status, events: d.events?.length, first: d.events?.[0]?.shortName };
  } catch (e) {
    results.espn = { error: String(e) };
  }

  // Test 4: AbortSignal.timeout availability
  results.abort_signal_timeout = typeof AbortSignal.timeout === "function" ? "available" : "NOT AVAILABLE";
  results.node_version = process.version;
  results.env = process.env.VERCEL ? "vercel" : "local";

  return NextResponse.json(results, { status: 200 });
}

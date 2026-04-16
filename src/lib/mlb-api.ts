/**
 * MLB schedule + odds client.
 *
 * Schedule: MLB Stats API with hydrate=team,linescore,seriesSummary
 *   - Works server-to-server reliably
 *   - hydrate=team is required to get team abbreviations
 *
 * Spreads: ESPN Core API (DraftKings odds) per game
 *   - Best-effort: returns null if unavailable or blocked
 *   - ESPN blocks some server IPs; failures are silently ignored
 */

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

export interface MlbGameScore {
  gamePk: number;
  gameDate: string;
  gameTime: string;
  awayTeamId: number;
  homeTeamId: number;
  awayTeamAbbr: string;
  homeTeamAbbr: string;
  awayTeamName: string;
  homeTeamName: string;
  awayScore: number;
  homeScore: number;
  status: "scheduled" | "in_progress" | "final" | "postponed" | "suspended" | "cancelled";
  inning: number | null;
  inningState: string | null;
  isDoubleheader: boolean;
  spread: number | null;
  favorite: "home" | "away" | null;
  awayProbablePitcher: string | null;
  homeProbablePitcher: string | null;
}

function mapStatus(abstractState: string, detailedState: string): MlbGameScore["status"] {
  if (abstractState === "Final") return "final";
  if (abstractState === "Live") return "in_progress";
  if (detailedState.includes("Postponed")) return "postponed";
  if (detailedState.includes("Suspended")) return "suspended";
  if (detailedState.includes("Cancelled")) return "cancelled";
  return "scheduled";
}

interface EspnOddsEntry {
  spread: number | null;
  favorite: "home" | "away" | null;
}

/**
 * Fetch DraftKings spreads for all games on a single date from ESPN.
 * Returns a map of "AWAY @ HOME" shortName → odds.
 * Best-effort: returns empty map on any failure.
 */
async function fetchEspnOddsForDate(
  dateStr: string
): Promise<Map<string, EspnOddsEntry>> {
  const result = new Map<string, EspnOddsEntry>();
  try {
    const espnDate = dateStr.replace(/-/g, "");
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${espnDate}&limit=30`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!resp.ok) return result;

    const data = await resp.json();
    const events: Array<{ shortName: string; id: string }> = data.events ?? [];

    // Fetch odds for all events in parallel (capped at 6s total)
    await Promise.all(
      events.map(async (event) => {
        try {
          const oddsUrl =
            `https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb` +
            `/events/${event.id}/competitions/${event.id}/odds`;
          const oddsResp = await fetch(oddsUrl, { signal: AbortSignal.timeout(4_000) });
          if (!oddsResp.ok) return;

          const oddsData = await oddsResp.json();
          const items: Array<{
            provider: { name: string };
            spread?: number;
            awayTeamOdds?: { favorite?: boolean };
            homeTeamOdds?: { favorite?: boolean };
          }> = oddsData.items ?? [];

          const dk =
            items.find((i) => i.provider?.name?.toLowerCase().includes("draftkings")) ??
            items[0];

          if (!dk || dk.spread == null) return;

          result.set(event.shortName, {
            spread: Math.abs(dk.spread),
            favorite: dk.awayTeamOdds?.favorite ? "away" : "home",
          });
        } catch {
          // Ignore per-game failures
        }
      })
    );
  } catch {
    // Ignore — ESPN may block Vercel server IPs; schedule still loads from MLB API
  }
  return result;
}

/**
 * Fetch all MLB games for a date range from the MLB Stats API.
 * Uses hydrate=team to get abbreviations (required — not in default response).
 */
export async function fetchGamesForDates(dates: string[]): Promise<MlbGameScore[]> {
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const url =
    `${MLB_API_BASE}/schedule` +
    `?sportId=1` +
    `&startDate=${startDate}` +
    `&endDate=${endDate}` +
    `&hydrate=team,linescore,probablePitcher(person)` +
    `&language=en`;

  const resp = await fetch(url, {
    headers: { "User-Agent": "SeriesSpreadPool/1.0" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!resp.ok) {
    throw new Error(`MLB API ${resp.status}: ${resp.statusText}`);
  }

  const data = await resp.json();
  const games: MlbGameScore[] = [];

  // Pre-fetch ESPN odds for each date in parallel (best-effort)
  const oddsByDate = new Map<string, Map<string, EspnOddsEntry>>();
  await Promise.all(
    (data.dates ?? []).map(async (date: { date: string }) => {
      oddsByDate.set(date.date, await fetchEspnOddsForDate(date.date));
    })
  );

  for (const date of data.dates ?? []) {
    const dateOdds = oddsByDate.get(date.date) ?? new Map<string, EspnOddsEntry>();

    for (const game of date.games ?? []) {
      const t = game.teams;
      const away = t.away.team;
      const home = t.home.team;
      const status = mapStatus(
        game.status.abstractGameState,
        game.status.detailedState
      );
      const isDoubleheader =
        game.doubleHeader === "Y" || game.doubleHeader === "S";

      // Look up odds from the pre-fetched ESPN map
      const shortName = `${away.abbreviation} @ ${home.abbreviation}`;
      const odds = dateOdds.get(shortName) ?? { spread: null, favorite: null };

      games.push({
        gamePk: game.gamePk,
        gameDate: date.date,
        gameTime: game.gameDate,
        awayTeamId: away.id,
        homeTeamId: home.id,
        awayTeamAbbr: away.abbreviation,
        homeTeamAbbr: home.abbreviation,
        awayTeamName: away.teamName,
        homeTeamName: home.teamName,
        awayScore: t.away.score ?? 0,
        homeScore: t.home.score ?? 0,
        status,
        inning: game.linescore?.currentInning ?? null,
        inningState: game.linescore?.inningState ?? null,
        isDoubleheader,
        spread: odds.spread,
        favorite: odds.favorite,
        awayProbablePitcher: t.away.probablePitcher?.fullName ?? null,
        homeProbablePitcher: t.home.probablePitcher?.fullName ?? null,
      });
    }
  }

  return games;
}

/**
 * Get Fri–Sun dates for the upcoming (or current) weekend.
 */
export function getWeekendDates(referenceDate = new Date()): string[] {
  const day = referenceDate.getDay();
  let daysToFriday = (5 - day + 7) % 7;
  if (day === 0) daysToFriday = -2; // Sun → last Fri
  if (day === 6) daysToFriday = -1; // Sat → last Fri

  const friday = new Date(referenceDate);
  friday.setDate(friday.getDate() + daysToFriday);

  return [0, 1, 2].map((i) => {
    const d = new Date(friday);
    d.setDate(friday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

export function buildSeriesKey(
  awayTeamId: number,
  homeTeamId: number,
  startDate: string
): string {
  return `${awayTeamId}-${homeTeamId}-${startDate}`;
}

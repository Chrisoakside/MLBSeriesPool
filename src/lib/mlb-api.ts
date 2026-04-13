/**
 * MLB Stats API client.
 * Base URL: https://statsapi.mlb.com/api/v1
 * Docs: https://github.com/toddrob99/MLB-StatsAPI/wiki
 */

const MLB_API_BASE = "https://statsapi.mlb.com/api/v1";

export interface MlbGameScore {
  gamePk: number;
  gameDate: string;          // "2026-06-13"
  gameTime: string;          // ISO datetime
  awayTeamId: number;
  homeTeamId: number;
  awayTeamAbbr: string;
  homeTeamAbbr: string;
  awayScore: number;
  homeScore: number;
  status: "scheduled" | "in_progress" | "final" | "postponed" | "suspended" | "cancelled";
  inning: number | null;
  inningState: string | null; // "Top" | "Bot" | "Mid" | "End"
  isDoubleheader: boolean;
}

export interface MlbScheduleResponse {
  dates: {
    date: string;
    games: {
      gamePk: number;
      gameDate: string;
      status: {
        abstractGameState: string; // "Preview" | "Live" | "Final"
        detailedState: string;
        statusCode: string;
      };
      teams: {
        away: {
          team: { id: number; abbreviation: string };
          score?: number;
        };
        home: {
          team: { id: number; abbreviation: string };
          score?: number;
        };
      };
      linescore?: {
        currentInning: number;
        currentInningOrdinal: string;
        inningState: string;
      };
      doubleHeader: string; // "Y" | "N" | "S"
      gameNumber: number;
    }[];
  }[];
}

function mapStatus(
  abstractState: string,
  detailedState: string
): MlbGameScore["status"] {
  if (abstractState === "Final") return "final";
  if (abstractState === "Live") return "in_progress";
  if (detailedState.includes("Postponed")) return "postponed";
  if (detailedState.includes("Suspended")) return "suspended";
  if (detailedState.includes("Cancelled")) return "cancelled";
  return "scheduled";
}

/**
 * Fetch all games for given dates (defaults to Fri–Sun of current weekend).
 * Uses a single API call with hydrate=linescore for efficiency.
 */
export async function fetchGamesForDates(dates: string[]): Promise<MlbGameScore[]> {
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];

  const url = `${MLB_API_BASE}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&hydrate=linescore&language=en`;

  const resp = await fetch(url, {
    headers: { "User-Agent": "SeriesSpreadPool/1.0" },
    // 10s timeout via AbortController
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    throw new Error(`MLB API error: ${resp.status} ${resp.statusText}`);
  }

  const data: MlbScheduleResponse = await resp.json();
  const games: MlbGameScore[] = [];

  for (const date of data.dates ?? []) {
    for (const game of date.games ?? []) {
      const status = mapStatus(
        game.status.abstractGameState,
        game.status.detailedState
      );

      games.push({
        gamePk: game.gamePk,
        gameDate: date.date,
        gameTime: game.gameDate,
        awayTeamId: game.teams.away.team.id,
        homeTeamId: game.teams.home.team.id,
        awayTeamAbbr: game.teams.away.team.abbreviation,
        homeTeamAbbr: game.teams.home.team.abbreviation,
        awayScore: game.teams.away.score ?? 0,
        homeScore: game.teams.home.score ?? 0,
        status,
        inning: game.linescore?.currentInning ?? null,
        inningState: game.linescore?.inningState ?? null,
        isDoubleheader: game.doubleHeader === "Y" || game.doubleHeader === "S",
      });
    }
  }

  return games;
}

/**
 * Get the Fri–Sun dates for the current or upcoming weekend.
 */
export function getWeekendDates(referenceDate = new Date()): string[] {
  const day = referenceDate.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const dates: string[] = [];

  // Find Friday of current week
  const daysUntilFriday = (5 - day + 7) % 7;
  const friday = new Date(referenceDate);
  friday.setDate(friday.getDate() + (daysUntilFriday === 0 && day !== 5 ? 7 : daysUntilFriday));

  // If we're past Sunday (Mon-Thu), look at the coming weekend
  const isPastWeekend = day >= 1 && day <= 4;
  if (isPastWeekend) {
    friday.setDate(friday.getDate()); // already next friday
  }

  for (let i = 0; i < 3; i++) {
    const d = new Date(friday);
    d.setDate(friday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  return dates;
}

/**
 * Build a stable series key from two team IDs and start date.
 * Used to group games into series.
 */
export function buildSeriesKey(
  awayTeamId: number,
  homeTeamId: number,
  startDate: string
): string {
  return `${Math.min(awayTeamId, homeTeamId)}-${Math.max(awayTeamId, homeTeamId)}-${startDate}`;
}

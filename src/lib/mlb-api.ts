/**
 * MLB schedule + odds client.
 *
 * Primary source: ESPN scoreboard API (team abbreviations, game times, status)
 * Spreads: ESPN/DraftKings odds API per event
 * Fallback IDs: MLB Stats API gamePk via the ESPN gamePk field
 *
 * ESPN endpoints used:
 *   Scoreboard: https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=YYYYMMDD
 *   Odds:       https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events/{id}/competitions/{id}/odds
 */

export interface MlbGameScore {
  gamePk: number;           // ESPN event id (used as unique key)
  gameDate: string;         // "2026-04-18"
  gameTime: string;         // ISO datetime
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
  // Spread from DraftKings via ESPN odds API
  spread: number | null;       // always positive (e.g. 1.5)
  favorite: "home" | "away" | null; // which side gives up the spread
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: { id: string; abbreviation: string; displayName: string };
  score?: string;
  uid: string;
}

interface EspnEvent {
  id: string;
  shortName: string;
  date: string;
  competitions: {
    id: string;
    startDate: string;
    status: {
      type: {
        name: string;   // "STATUS_SCHEDULED" | "STATUS_IN_PROGRESS" | "STATUS_FINAL"
        completed: boolean;
      };
      period?: number;  // inning number
      displayClock?: string;
    };
    competitors: EspnCompetitor[];
    notes?: { type: string; headline: string }[];
    format?: { regulation?: { periods: number } };
  }[];
}

function mapEspnStatus(typeName: string): MlbGameScore["status"] {
  if (typeName.includes("FINAL") || typeName.includes("COMPLETE")) return "final";
  if (typeName.includes("IN_PROGRESS") || typeName.includes("HALFTIME")) return "in_progress";
  if (typeName.includes("POSTPONED")) return "postponed";
  if (typeName.includes("SUSPENDED")) return "suspended";
  if (typeName.includes("CANCELLED") || typeName.includes("CANCELED")) return "cancelled";
  return "scheduled";
}

async function fetchOddsForEvent(eventId: string): Promise<{ spread: number | null; favorite: "home" | "away" | null }> {
  try {
    const url = `https://sports.core.api.espn.com/v2/sports/baseball/leagues/mlb/events/${eventId}/competitions/${eventId}/odds`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!resp.ok) return { spread: null, favorite: null };

    const data = await resp.json();
    // Prefer DraftKings, fall back to first provider
    const items: Array<{
      provider: { name: string };
      spread?: number;
      awayTeamOdds?: { favorite?: boolean };
      homeTeamOdds?: { favorite?: boolean };
    }> = data.items ?? [];

    const dk = items.find((i) => i.provider?.name?.toLowerCase().includes("draftkings")) ?? items[0];
    if (!dk || dk.spread == null) return { spread: null, favorite: null };

    const spread = Math.abs(dk.spread); // always positive
    const favorite = dk.awayTeamOdds?.favorite ? "away" : dk.homeTeamOdds?.favorite ? "home" : null;
    return { spread, favorite };
  } catch {
    return { spread: null, favorite: null };
  }
}

/**
 * Fetch all MLB games for given dates from ESPN scoreboard, including
 * DraftKings spread data where available.
 */
export async function fetchGamesForDates(dates: string[]): Promise<MlbGameScore[]> {
  const games: MlbGameScore[] = [];

  for (const date of dates) {
    const espnDate = date.replace(/-/g, ""); // "20260418"
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${espnDate}&limit=30`;

    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "SeriesSpreadPool/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) continue;

      const data = await resp.json();
      const events: EspnEvent[] = data.events ?? [];

      for (const event of events) {
        const comp = event.competitions?.[0];
        if (!comp) continue;

        const competitors = comp.competitors ?? [];
        const away = competitors.find((c) => c.homeAway === "away");
        const home = competitors.find((c) => c.homeAway === "home");
        if (!away || !home) continue;

        const status = mapEspnStatus(comp.status?.type?.name ?? "");
        const isDoubleheader = (comp.notes ?? []).some(
          (n) => n.headline?.toLowerCase().includes("game 2") || n.headline?.toLowerCase().includes("doubleheader")
        );

        // Get spread from odds API (non-blocking; defaults to null)
        const odds = await fetchOddsForEvent(event.id);

        games.push({
          gamePk: parseInt(event.id, 10),
          gameDate: date,
          gameTime: comp.startDate,
          awayTeamId: parseInt(away.team.id, 10),
          homeTeamId: parseInt(home.team.id, 10),
          awayTeamAbbr: away.team.abbreviation,
          homeTeamAbbr: home.team.abbreviation,
          awayTeamName: away.team.displayName,
          homeTeamName: home.team.displayName,
          awayScore: parseFloat(away.score ?? "0") || 0,
          homeScore: parseFloat(home.score ?? "0") || 0,
          status,
          inning: comp.status?.period ?? null,
          inningState: null,
          isDoubleheader,
          spread: odds.spread,
          favorite: odds.favorite,
        });
      }
    } catch {
      // Skip dates that fail; don't abort the whole fetch
      continue;
    }
  }

  return games;
}

/**
 * Get the Fri–Sun dates for the upcoming (or current) weekend.
 */
export function getWeekendDates(referenceDate = new Date()): string[] {
  const day = referenceDate.getDay(); // 0=Sun … 6=Sat
  // Days until Friday (if today is Fri/Sat/Sun we use this weekend)
  let daysUntilFriday = (5 - day + 7) % 7;
  if (day === 0) daysUntilFriday = 5; // Sunday → next Friday
  if (day === 6) daysUntilFriday = 6; // Saturday → next Friday? No, this weekend
  // Actually: if Fri/Sat/Sun, use current weekend; Mon–Thu use upcoming Fri
  if (day === 6) daysUntilFriday = -1; // Sat → Fri was yesterday
  if (day === 0) daysUntilFriday = -2; // Sun → Fri was 2 days ago

  const friday = new Date(referenceDate);
  friday.setDate(friday.getDate() + daysUntilFriday);

  return [0, 1, 2].map((i) => {
    const d = new Date(friday);
    d.setDate(friday.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

/**
 * Build a stable series key from two ESPN team IDs and start date.
 */
export function buildSeriesKey(
  awayTeamId: number,
  homeTeamId: number,
  startDate: string
): string {
  return `${awayTeamId}-${homeTeamId}-${startDate}`;
}

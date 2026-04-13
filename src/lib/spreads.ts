/**
 * Spread calculation for MLB series picks.
 *
 * The spread is on CUMULATIVE RUNS across the series, not series wins.
 * Half-point spreads guarantee no pushes (enforced by DB CHECK constraint).
 *
 * spread_at_pick is stored FROM the picked side's perspective:
 *   - Picked BOS -2.5 (favorite)  → spread_at_pick = -2.5
 *   - Picked NYY +2.5 (underdog)  → spread_at_pick = +2.5
 *
 * Cover condition: (pickedSideRuns - otherSideRuns) + spread_at_pick > 0
 */

export interface PickForEval {
  picked_side: "home" | "away";
  spread_at_pick: number;
}

export interface SeriesForEval {
  total_runs_home: number;
  total_runs_away: number;
  is_void: boolean;
  status: "pending" | "in_progress" | "final" | "void";
}

export type PickResult = "win" | "loss" | "void" | "pending";

/**
 * Evaluate a single pick against current series run totals.
 * Returns 'pending' if the series is not yet final.
 */
export function evaluatePick(
  pick: PickForEval,
  series: SeriesForEval
): PickResult {
  if (series.is_void || series.status === "void") return "void";
  if (series.status !== "final") return "pending";

  const margin =
    pick.picked_side === "home"
      ? series.total_runs_home - series.total_runs_away
      : series.total_runs_away - series.total_runs_home;

  const adjustedMargin = margin + pick.spread_at_pick;
  return adjustedMargin > 0 ? "win" : "loss";
}

/**
 * Given a favorite side + spread, compute spread_at_pick for each side.
 * The picked side always gets the spread from their perspective.
 */
export function spreadAtPickFor(
  pickedSide: "home" | "away",
  favoriteSide: "home" | "away",
  spread: number
): number {
  const isFavorite = pickedSide === favoriteSide;
  // Favorite side gets negative spread (e.g. -2.5), underdog gets positive
  return isFavorite ? -Math.abs(spread) : Math.abs(spread);
}

/**
 * Format spread for display.
 * e.g. favorite="home", home="BOS", spread=2.5 → "BOS -2.5"
 */
export function formatSpread(
  favoriteSide: "home" | "away",
  homeAbbr: string,
  awayAbbr: string,
  spread: number
): string {
  const favTeam = favoriteSide === "home" ? homeAbbr : awayAbbr;
  return `${favTeam} -${Math.abs(spread).toFixed(1)}`;
}

/**
 * Compute ticket status from pick results.
 * Returns a status string and correct/total counts.
 */
export function computeTicketStatus(results: PickResult[]): {
  status: "pending" | "winning" | "losing" | "won" | "lost";
  correctPicks: number;
  totalValidPicks: number;
} {
  const wins = results.filter((r) => r === "win").length;
  const losses = results.filter((r) => r === "loss").length;
  const voids = results.filter((r) => r === "void").length;
  const pending = results.filter((r) => r === "pending").length;

  const totalValidPicks = 6 - voids;

  let status: "pending" | "winning" | "losing" | "won" | "lost";
  if (losses > 0 && pending === 0) {
    status = "lost";
  } else if (losses > 0) {
    status = "losing";
  } else if (wins + voids === 6 && pending === 0) {
    status = "won";
  } else if (wins > 0 && losses === 0 && pending > 0) {
    status = "winning";
  } else {
    status = "pending";
  }

  return { status, correctPicks: wins, totalValidPicks };
}

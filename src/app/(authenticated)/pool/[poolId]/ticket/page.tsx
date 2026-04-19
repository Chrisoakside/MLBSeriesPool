import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamLogo } from "@/components/ui/team-logo";
import { getTicketData } from "@/actions/tickets";
import Link from "next/link";

const borderColor: Record<string, string> = {
  winning: "border-l-emerald-500",
  losing: "border-l-red-500",
  pending: "border-l-slate-600",
  won: "border-l-emerald-500",
  lost: "border-l-red-500",
};

const statusBadgeVariant: Record<string, "winning" | "losing" | "pending"> = {
  winning: "winning",
  losing: "losing",
  pending: "pending",
  won: "winning",
  lost: "losing",
};

/** Format an ISO game_time string as a short local start time, e.g. "7:05 PM" */
function formatStartTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "Scheduled";
  try {
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "Scheduled";
  }
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const data = await getTicketData(poolId);

  if (!data || !data.ticket) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No ticket found for this week.</p>
        <Link href={`/pool/${poolId}/picks`}>
          <Button size="sm" className="mt-4">
            Make Your Picks
          </Button>
        </Link>
      </div>
    );
  }

  const { week, ticket } = data;
  const picks = ticket.ticket_picks ?? [];
  const ticketStatus = ticket.status ?? "pending";

  const wins = picks.filter((p: { result: string }) => p.result === "win").length;
  const losses = picks.filter((p: { result: string }) => p.result === "loss").length;
  const pending = picks.filter((p: { result: string }) => p.result === "pending").length;

  const overallLabel =
    ticketStatus === "won"
      ? "WINNER"
      : ticketStatus === "lost"
        ? "ELIMINATED"
        : ticketStatus === "winning"
          ? "IN PLAY"
          : ticketStatus === "losing"
            ? "IN PLAY"
            : "PENDING";

  const overallVariant: "winning" | "losing" | "pending" | "live" =
    ticketStatus === "won" || ticketStatus === "winning"
      ? "winning"
      : ticketStatus === "lost" || ticketStatus === "losing"
        ? "losing"
        : "pending";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Week {week.week_number} Ticket
          </h1>
          <p className="text-sm text-slate-400 mt-1">{week.label}</p>
        </div>
        <Badge variant={overallVariant} className="text-sm px-3 py-1.5">
          {(ticketStatus === "winning" || ticketStatus === "losing") && (
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse-live mr-2" />
          )}
          {overallLabel}
        </Badge>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-emerald-400 font-medium">{wins} Winning</span>
        <span className="text-slate-600">|</span>
        <span className="text-red-400 font-medium">{losses} Losing</span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">{pending} Pending</span>
      </div>

      {/* Pick Cards */}
      <div className="space-y-4">
        {picks.map(
          (pick: {
            id: string;
            picked_side: "home" | "away";
            spread_at_pick: number;
            result: string;
            series: {
              spread: number;
              favorite: string;
              mlb_series: {
                away_team_abbr: string;
                home_team_abbr: string;
                away_team_name: string;
                home_team_name: string;
                total_runs_away: number;
                total_runs_home: number;
                status: string;
                mlb_games: {
                  id: string;
                  game_date: string;
                  game_time: string | null;
                  away_score: number;
                  home_score: number;
                  status: string;
                  inning: number | null;
                  inning_state: string | null;
                }[];
              };
            };
          }) => {
            const mlb = pick.series?.mlb_series;
            if (!mlb) return null;

            const pickedTeam =
              pick.picked_side === "home"
                ? mlb.home_team_abbr
                : mlb.away_team_abbr;
            const otherTeam =
              pick.picked_side === "home"
                ? mlb.away_team_abbr
                : mlb.home_team_abbr;
            const pickedRuns =
              pick.picked_side === "home"
                ? mlb.total_runs_home
                : mlb.total_runs_away;
            const otherRuns =
              pick.picked_side === "home"
                ? mlb.total_runs_away
                : mlb.total_runs_home;

            const margin = pickedRuns - otherRuns;
            const adjustedMargin = margin + (pick.spread_at_pick ?? 0);

            const pickStatus =
              pick.result === "win"
                ? "winning"
                : pick.result === "loss"
                  ? "losing"
                  : "pending";

            const games = (mlb.mlb_games ?? []).sort(
              (a: { game_date: string }, b: { game_date: string }) =>
                a.game_date.localeCompare(b.game_date)
            );
            const dayLabels = ["Game 1", "Game 2", "Game 3", "Game 4"];

            return (
              <Card
                key={pick.id}
                className={`border-l-4 ${borderColor[pickStatus] ?? "border-l-slate-600"}`}
              >
                <CardContent>
                  {/* Header row — team logos + matchup */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Away team */}
                      <div className="flex flex-col items-center gap-1">
                        <TeamLogo abbr={mlb.away_team_abbr} size={36} />
                        <span className="text-[10px] font-bold text-slate-400">
                          {mlb.away_team_abbr}
                        </span>
                      </div>
                      <span className="text-xs text-slate-600 font-medium">@</span>
                      {/* Home team */}
                      <div className="flex flex-col items-center gap-1">
                        <TeamLogo abbr={mlb.home_team_abbr} size={36} />
                        <span className="text-[10px] font-bold text-slate-400">
                          {mlb.home_team_abbr}
                        </span>
                      </div>
                      {/* Picked team highlight */}
                      <div className="ml-2">
                        <p className="text-xs text-slate-500">Your pick</p>
                        <p className="text-sm font-bold text-white">{pickedTeam}</p>
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant[pickStatus] ?? "pending"}>
                      {pick.result === "win"
                        ? "WIN"
                        : pick.result === "loss"
                          ? "LOSS"
                          : pick.result === "void"
                            ? "VOID"
                            : "PENDING"}
                    </Badge>
                  </div>

                  {/* Spread Math */}
                  {mlb.status !== "pending" ? (
                    <div className="bg-slate-900 rounded-lg p-4 mb-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white font-mono">
                            {pickedTeam}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {pickedRuns} runs
                          </span>
                          <span className="text-slate-600">
                            ({pick.spread_at_pick > 0 ? "+" : ""}
                            {pick.spread_at_pick?.toFixed(1)})
                          </span>
                        </div>
                        <span className="text-slate-500">vs</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-mono">
                            {otherRuns} runs
                          </span>
                          <span className="font-bold text-white font-mono">
                            {otherTeam}
                          </span>
                        </div>
                      </div>
                      <p
                        className={`text-xs mt-2 ${adjustedMargin > 0 ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {adjustedMargin > 0
                          ? `Covers by ${Math.abs(adjustedMargin).toFixed(1)} runs`
                          : `Down by ${Math.abs(adjustedMargin).toFixed(1)} runs`}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-900 rounded-lg p-4 mb-3">
                      <p className="text-sm text-slate-500 text-center">
                        Games haven&apos;t started yet
                      </p>
                    </div>
                  )}

                  {/* Game Breakdown */}
                  <div className="space-y-1.5">
                    {games.map(
                      (
                        game: {
                          id: string;
                          game_time: string | null;
                          away_score: number;
                          home_score: number;
                          status: string;
                          inning: number | null;
                          inning_state: string | null;
                        },
                        idx: number
                      ) => {
                        const isLive = game.status === "in_progress";
                        const gameStatus =
                          game.status === "final"
                            ? "FINAL"
                            : game.status === "in_progress"
                              ? `${game.inning_state ?? ""} ${game.inning ?? ""}`.trim()
                              : formatStartTime(game.game_time);

                        return (
                          <div
                            key={game.id}
                            className="flex items-center justify-between text-xs text-slate-400"
                          >
                            <span className="text-slate-500 w-24">
                              {dayLabels[idx] ?? `Game ${idx + 1}`}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono w-16 text-right">
                                {game.status === "scheduled" ? "—" : `${mlb.away_team_abbr} ${game.away_score}`}
                              </span>
                              <span className="text-slate-600">-</span>
                              <span className="font-mono w-16">
                                {game.status === "scheduled" ? "—" : `${game.home_score} ${mlb.home_team_abbr}`}
                              </span>
                            </div>
                            <span
                              className={`w-20 text-right ${isLive ? "text-blue-400" : "text-slate-500"}`}
                            >
                              {isLive && (
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse-live mr-1" />
                              )}
                              {gameStatus}
                            </span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          }
        )}
      </div>
    </div>
  );
}

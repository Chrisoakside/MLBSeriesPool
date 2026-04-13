import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trophy,
  Clock,
  TrendingUp,
  AlertCircle,
  Check,
  X,
  Minus,
  Users,
} from "lucide-react";
import { getPoolDashboard } from "@/actions/pools";
import Link from "next/link";

const statusIcon = {
  win: <Check className="w-3.5 h-3.5" />,
  loss: <X className="w-3.5 h-3.5" />,
  pending: <Minus className="w-3.5 h-3.5" />,
  void: <Minus className="w-3.5 h-3.5" />,
};

const statusColor = {
  win: "text-emerald-400 bg-emerald-500/15",
  loss: "text-red-400 bg-red-500/15",
  pending: "text-slate-400 bg-slate-700/50",
  void: "text-amber-400 bg-amber-500/15",
};

export default async function PoolDashboardPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const data = await getPoolDashboard(poolId);

  if (!data) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">Pool not found or access denied.</p>
      </div>
    );
  }

  const { pool, role, jackpot, currentWeek, ticket, memberCount, recentChat, unpaidCount } = data;
  const isAdmin = role === "admin";

  // Compute ticket stats
  const picks = ticket?.ticket_picks ?? [];
  const wins = picks.filter((p: { result: string }) => p.result === "win").length;
  const losses = picks.filter((p: { result: string }) => p.result === "loss").length;
  const pending = picks.filter((p: { result: string }) => p.result === "pending").length;

  return (
    <div className="space-y-6">
      {/* Admin Action Banner */}
      {isAdmin && unpaidCount > 0 && currentWeek && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-amber-200">
              {unpaidCount} members haven&apos;t paid for Week{" "}
              {currentWeek.week_number}
            </span>
          </div>
          <Link href={`/pool/${poolId}/admin/payments`}>
            <Button variant="ghost" size="sm">
              View Payments
            </Button>
          </Link>
        </div>
      )}

      {/* Jackpot Hero Card */}
      <div className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-800 to-slate-900 p-8 sm:p-10 text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/8 rounded-full blur-3xl animate-shimmer" />
        <div className="relative z-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-400/70 mb-2">
            Current Jackpot
          </p>
          <p className="text-5xl sm:text-6xl font-bold text-white font-mono tabular-nums mb-2">
            ${Number(jackpot).toLocaleString()}
          </p>
          {currentWeek ? (
            <p className="text-sm text-slate-400">
              Week {currentWeek.week_number} — {currentWeek.label}
            </p>
          ) : (
            <p className="text-sm text-slate-400">No active week</p>
          )}
          {jackpot > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse-live" />
              <span className="text-xs text-amber-400">Jackpot rolling</span>
            </div>
          )}
        </div>
      </div>

      {/* Status + Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* This Week's Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-emerald-400" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!currentWeek ? (
              <p className="text-sm text-slate-500">
                No week created yet.{" "}
                {isAdmin && (
                  <Link
                    href={`/pool/${poolId}/admin/lines`}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    Set up lines
                  </Link>
                )}
              </p>
            ) : ticket ? (
              <>
                <div className="text-sm text-slate-400">
                  <span className="text-emerald-400 font-medium">
                    {wins} Winning
                  </span>
                  {" · "}
                  <span className="text-red-400 font-medium">
                    {losses} Losing
                  </span>
                  {" · "}
                  <span className="text-slate-400">{pending} Pending</span>
                </div>
                <Link href={`/pool/${poolId}/ticket`}>
                  <Button size="sm" className="w-full">
                    View Ticket
                  </Button>
                </Link>
              </>
            ) : currentWeek.status === "lines_set" ? (
              <Link href={`/pool/${poolId}/picks`}>
                <Button size="sm" className="w-full">
                  Make Your Picks
                </Button>
              </Link>
            ) : (
              <p className="text-sm text-slate-500">
                Waiting for lines to be set.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
              Pool Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Members</span>
              <span className="text-white font-medium font-mono">
                {memberCount}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Entry Fee</span>
              <span className="text-white font-medium font-mono">
                ${Number(pool.entry_fee).toFixed(0)}/week
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Your Role</span>
              <Badge variant={isAdmin ? "admin" : "member"}>
                {isAdmin ? "Admin" : "Member"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Preview + Activity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Latest Ticket */}
        <Card>
          <CardHeader>
            <CardTitle>Latest Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            {picks.length > 0 ? (
              <div className="space-y-2">
                {picks.map(
                  (pick: {
                    id: string;
                    result: "win" | "loss" | "pending" | "void";
                    series: {
                      spread: number;
                      favorite: string;
                      mlb_series: {
                        away_team_abbr: string;
                        home_team_abbr: string;
                      };
                    };
                  }) => {
                    const mlb = pick.series?.mlb_series;
                    const matchup = mlb
                      ? `${mlb.away_team_abbr} @ ${mlb.home_team_abbr}`
                      : "TBD";
                    const spread = pick.series
                      ? `${pick.series.favorite === "home" ? mlb?.home_team_abbr : mlb?.away_team_abbr} -${Math.abs(pick.series.spread)}`
                      : "";

                    return (
                      <div
                        key={pick.id}
                        className="flex items-center justify-between py-1.5"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${statusColor[pick.result]}`}
                          >
                            {statusIcon[pick.result]}
                          </span>
                          <span className="text-sm text-white">{matchup}</span>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {spread}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                No ticket yet this week.
              </p>
            )}
            {picks.length > 0 && (
              <Link href={`/pool/${poolId}/ticket`}>
                <Button variant="ghost" size="sm" className="w-full mt-4">
                  View Full Ticket
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Recent Chat */}
        <Card>
          <CardHeader>
            <CardTitle>Smack Talk</CardTitle>
          </CardHeader>
          <CardContent>
            {recentChat.length > 0 ? (
              <div className="space-y-3">
                {recentChat.map(
                  (msg: {
                    id: string;
                    content: string;
                    created_at: string;
                    profiles: { display_name: string } | null;
                  }) => {
                    const name =
                      (msg.profiles as unknown as { display_name: string })
                        ?.display_name ?? "Unknown";
                    return (
                      <div key={msg.id} className="flex items-start gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-slate-400 flex-shrink-0">
                          {name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-medium text-slate-300">
                              {name}
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mt-0.5">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">
                No messages yet. Start the conversation!
              </p>
            )}
            <Link href={`/pool/${poolId}/chat`}>
              <Button variant="ghost" size="sm" className="w-full mt-3">
                Open Chat
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link href={`/pool/${poolId}/scores`}>
          <Card interactive className="text-center">
            <CardContent className="py-4">
              <TrendingUp className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-400">Scores</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/pool/${poolId}/board`}>
          <Card interactive className="text-center">
            <CardContent className="py-4">
              <Users className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-400">Picks Board</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/pool/${poolId}/leaderboard`}>
          <Card interactive className="text-center">
            <CardContent className="py-4">
              <Trophy className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-400">Leaderboard</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/pool/${poolId}/chat`}>
          <Card interactive className="text-center">
            <CardContent className="py-4">
              <AlertCircle className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-400">Chat</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

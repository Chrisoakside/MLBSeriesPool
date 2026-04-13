import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import { getLeaderboardData } from "@/actions/tickets";

const podiumIcons = [Trophy, Medal, Award];
const podiumColors = ["text-amber-400", "text-slate-300", "text-amber-600"];
const podiumBorders = ["border-amber-400/30", "border-slate-400/30", "border-amber-600/30"];

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const data = await getLeaderboardData(poolId);

  if (!data || data.standings.length === 0) {
    return (
      <div className="text-center py-16">
        <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">No Results Yet</h2>
        <p className="text-slate-500">
          The leaderboard will populate once weeks are resolved.
        </p>
      </div>
    );
  }

  const { standings, currentUserId } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-sm text-slate-400 mt-1">Season standings</p>
      </div>

      {/* Podium (desktop) */}
      {standings.length >= 3 && (
        <div className="hidden sm:grid grid-cols-3 gap-4">
          {[1, 0, 2].map((idx) => {
            const player = standings[idx];
            if (!player) return null;
            const Icon = podiumIcons[idx];
            return (
              <Card
                key={player.userId}
                className={`border ${podiumBorders[idx]} ${idx === 0 ? "sm:-mt-4" : ""}`}
              >
                <CardContent className="text-center py-6">
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${podiumColors[idx]}`} />
                  <p className={`text-xs font-bold ${podiumColors[idx]}`}>
                    #{idx + 1}
                  </p>
                  <p className="text-lg font-bold text-white mt-1">
                    {player.name}
                  </p>
                  <p className="text-2xl font-bold font-mono text-white mt-1">
                    {player.record}
                  </p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {player.pct} win rate
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Full Table */}
      <Card>
        <CardContent>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="text-left py-3 w-12">#</th>
                  <th className="text-left py-3">Member</th>
                  <th className="text-right py-3">Record</th>
                  <th className="text-right py-3">Win%</th>
                  <th className="text-right py-3">Perfect Weeks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {standings.map((player, idx) => {
                  const isMe = player.userId === currentUserId;
                  const rank = idx + 1;
                  return (
                    <tr
                      key={player.userId}
                      className={isMe ? "bg-emerald-500/5" : "hover:bg-slate-800/30"}
                    >
                      <td
                        className={`py-3 text-sm font-bold ${
                          rank <= 3 ? "text-amber-400" : "text-slate-500"
                        } ${isMe ? "border-l-2 border-emerald-500 pl-2" : "pl-3"}`}
                      >
                        {rank}
                      </td>
                      <td
                        className={`py-3 text-sm ${isMe ? "text-emerald-400 font-medium" : "text-white"}`}
                      >
                        {player.name}
                      </td>
                      <td className="py-3 text-sm text-right font-mono text-slate-300">
                        {player.record}
                      </td>
                      <td className="py-3 text-sm text-right font-mono text-slate-400">
                        {player.pct}
                      </td>
                      <td className="py-3 text-sm text-right">
                        {player.perfectWeeks > 0 ? (
                          <Badge variant="winning">{player.perfectWeeks}</Badge>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            {standings.map((player, idx) => {
              const isMe = player.userId === currentUserId;
              const rank = idx + 1;
              return (
                <div
                  key={player.userId}
                  className={`flex items-center gap-3 py-2.5 px-2 rounded-lg ${
                    isMe ? "bg-emerald-500/5 border-l-2 border-emerald-500" : ""
                  }`}
                >
                  <span
                    className={`text-sm font-bold w-6 text-center ${
                      rank <= 3 ? "text-amber-400" : "text-slate-500"
                    }`}
                  >
                    {rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm ${isMe ? "text-emerald-400 font-medium" : "text-white"}`}
                    >
                      {player.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono text-white">
                      {player.record}
                    </span>
                    <span className="text-xs text-slate-500 ml-2">
                      {player.pct}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

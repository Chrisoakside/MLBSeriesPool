import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";
import { getBoardData } from "@/actions/tickets";

const cellClass: Record<string, string> = {
  win: "bg-emerald-500/20 text-emerald-400",
  loss: "bg-red-500/20 text-red-400",
  pending: "bg-slate-700/50 text-slate-400",
  void: "bg-amber-500/20 text-amber-400",
};

export default async function BoardPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const data = await getBoardData(poolId);

  if (!data || !data.week) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No active week found.</p>
      </div>
    );
  }

  const { week, isLocked, series, board, currentUserId } = data;

  if (!isLocked) {
    return (
      <div className="text-center py-16">
        <Lock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Picks Board Locked</h2>
        <p className="text-slate-500">
          The picks board will be visible after the lock time.
        </p>
      </div>
    );
  }

  const seriesList = (series ?? []) as unknown as {
    id: string;
    spread: number;
    favorite: string;
    mlb_series: { away_team_abbr: string; home_team_abbr: string } | null;
  }[];

  const boardEntries = (board ?? []) as unknown as {
    user_id: string;
    correct_picks: number;
    total_valid_picks: number;
    status: string;
    profiles: { display_name: string } | null;
    ticket_picks: {
      series_id: string;
      picked_side: string;
      result: string;
    }[];
  }[];

  // Build a lookup for each member's picks
  const memberRows = boardEntries.map((entry) => {
    const name =
      (entry.profiles as unknown as { display_name: string })?.display_name ??
      "Unknown";
    const picksMap = new Map<string, string>();
    (entry.ticket_picks ?? []).forEach((tp) => {
      picksMap.set(tp.series_id, tp.result);
    });
    const record = `${entry.correct_picks}/${entry.total_valid_picks}`;
    return {
      userId: entry.user_id,
      name,
      picksMap,
      record,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Picks Board</h1>
        <p className="text-sm text-slate-400 mt-1">
          Week {week.week_number} — All picks visible after lock
        </p>
      </div>

      {/* Matrix View */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-wider">
              <th className="sticky left-0 bg-slate-950 z-10 text-left py-2 pr-4 w-28">
                Member
              </th>
              {seriesList.map((s) => {
                const mlb = s.mlb_series;
                const label = mlb
                  ? `${mlb.away_team_abbr}@${mlb.home_team_abbr}`
                  : "TBD";
                return (
                  <th key={s.id} className="py-2 px-1 text-center whitespace-nowrap">
                    {label}
                  </th>
                );
              })}
              <th className="py-2 px-2 text-center">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {memberRows.map((row) => {
              const isMe = row.userId === currentUserId;
              return (
                <tr
                  key={row.userId}
                  className={isMe ? "bg-emerald-500/5" : "hover:bg-slate-800/30"}
                >
                  <td
                    className={`sticky left-0 z-10 py-2 pr-4 text-sm ${
                      isMe
                        ? "bg-emerald-500/5 text-emerald-400 font-medium border-l-2 border-emerald-500 pl-2"
                        : "bg-slate-950 text-slate-300 pl-3"
                    }`}
                  >
                    {row.name}
                  </td>
                  {seriesList.map((s) => {
                    const result = row.picksMap.get(s.id);
                    return (
                      <td key={s.id} className="py-2 px-1 text-center">
                        {result ? (
                          <span
                            className={`inline-flex w-6 h-6 rounded items-center justify-center text-[10px] font-bold ${cellClass[result] ?? cellClass.pending}`}
                          >
                            {result === "win"
                              ? "W"
                              : result === "loss"
                                ? "L"
                                : result === "void"
                                  ? "V"
                                  : "·"}
                          </span>
                        ) : (
                          <span className="inline-flex w-6 h-6" />
                        )}
                      </td>
                    );
                  })}
                  <td className="py-2 px-2 text-center text-xs font-mono text-slate-400">
                    {row.record}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {boardEntries.length === 0 && (
        <div className="text-center py-8">
          <p className="text-slate-500">No tickets submitted for this week.</p>
        </div>
      )}
    </div>
  );
}

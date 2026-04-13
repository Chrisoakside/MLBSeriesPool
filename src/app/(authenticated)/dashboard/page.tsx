import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, Users } from "lucide-react";
import { getMyPools } from "@/actions/pools";
import Link from "next/link";

export default async function DashboardPage() {
  const pools = await getMyPools();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Your Pools</h1>
        <p className="text-slate-400 mt-1">
          {pools.length > 0
            ? "Choose a pool to view or manage this week's action."
            : "Create or join a pool to get started."}
        </p>
      </div>

      {/* Pool Cards */}
      {pools.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pools.map((pool) => (
            <Link key={pool!.id} href={`/pool/${pool!.id}/dashboard`}>
              <Card interactive className="group h-full">
                <CardContent>
                  {/* Pool Name + Role */}
                  <div className="flex items-start justify-between mb-4">
                    <CardTitle className="group-hover:text-emerald-400 transition-colors">
                      {pool!.name}
                    </CardTitle>
                    <Badge
                      variant={pool!.role === "admin" ? "admin" : "member"}
                    >
                      {pool!.role === "admin" ? "Admin" : "Member"}
                    </Badge>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center gap-2 text-sm">
                      <Trophy className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-400">Jackpot:</span>
                      <span className="text-emerald-400 font-bold font-mono tabular-nums">
                        ${Number(pool!.jackpot).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-400">
                        {pool!.members} members
                      </span>
                    </div>
                    {pool!.weekNumber && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-400">
                          Week {pool!.weekNumber}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <Button
                    variant={
                      pool!.weekStatus === "Make Picks"
                        ? "primary"
                        : "secondary"
                    }
                    size="sm"
                    className="w-full"
                  >
                    {pool!.weekStatus}
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-slate-500 text-lg mb-6">
            You haven&apos;t joined any pools yet.
          </p>
        </div>
      )}

      {/* Create / Join Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/pool/create">
          <Button size="lg">Create New Pool</Button>
        </Link>
        <Link href="/pool/join">
          <Button variant="secondary" size="lg">
            Join a Pool
          </Button>
        </Link>
      </div>
    </div>
  );
}

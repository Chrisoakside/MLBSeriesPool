"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users, DollarSign, Trophy, Lock, ArrowRight } from "lucide-react";
import { getPublicPools, joinPool, joinPoolById } from "@/actions/pools";

interface PublicPool {
  id: string;
  name: string;
  entryFee: number;
  memberCount: number;
  jackpot: number;
  isMember: boolean;
}

export default function BrowsePoolsPage() {
  const router = useRouter();
  const [pools, setPools] = useState<PublicPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Per-card join state
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Private pool code entry
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);

  useEffect(() => {
    getPublicPools().then((data) => {
      setPools(data as PublicPool[]);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return pools;
    const q = search.toLowerCase();
    return pools.filter((p) => p.name.toLowerCase().includes(q));
  }, [pools, search]);

  // ── Join a public pool ───────────────────────────────────────────
  const handleJoinPublic = async (pool: PublicPool) => {
    if (pool.isMember) {
      router.push(`/pool/${pool.id}/dashboard`);
      return;
    }
    setJoiningId(pool.id);
    setJoinError(null);
    const result = await joinPoolById(pool.id);
    if (result.error) {
      setJoinError(result.error);
      setJoiningId(null);
    } else {
      router.push(`/pool/${result.poolId}/dashboard`);
    }
  };

  // ── Join via code (private pool) ─────────────────────────────────
  const handleJoinByCode = async () => {
    if (code.trim().length < 6) return;
    setCodeLoading(true);
    setCodeError("");
    const result = await joinPool(code.trim());
    if (result.error) {
      setCodeError(result.error);
      setCodeLoading(false);
      return;
    }
    router.push(`/pool/${result.poolId}/dashboard`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Find a Pool</h1>
        <p className="text-sm text-slate-400 mt-1">
          Browse open pools to join, or enter a code to join a private one.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Public Pools ──────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Public Pools
            </h2>
            {!loading && (
              <span className="text-xs text-slate-500">
                {filtered.length} {filtered.length === 1 ? "pool" : "pools"}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by pool name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>

          {joinError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-sm text-red-400">{joinError}</p>
            </div>
          )}

          {/* Pool list */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 border border-slate-800 rounded-xl">
              <p className="text-slate-400 text-sm">
                {search
                  ? "No pools match your search."
                  : "No public pools are open right now."}
              </p>
              {!search && (
                <p className="text-slate-500 text-xs mt-1">
                  Create your own or join a private pool with a code.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((pool) => (
                <Card key={pool.id}>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      {/* Pool info */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white truncate">
                            {pool.name}
                          </h3>
                          {pool.isMember && (
                            <Badge variant="winning" className="text-[10px] shrink-0">
                              Joined
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="font-mono text-emerald-400 font-semibold">
                              ${pool.jackpot.toLocaleString()}
                            </span>
                            <span className="text-slate-500">jackpot</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {pool.memberCount}{" "}
                            {pool.memberCount === 1 ? "member" : "members"}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" />
                            ${pool.entryFee}/week entry
                          </span>
                        </div>
                      </div>

                      {/* Action button */}
                      <Button
                        size="sm"
                        variant={pool.isMember ? "secondary" : "default"}
                        onClick={() => handleJoinPublic(pool)}
                        disabled={joiningId === pool.id}
                        className="shrink-0"
                      >
                        {joiningId === pool.id ? (
                          "Joining…"
                        ) : pool.isMember ? (
                          <>
                            <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                            Go to Pool
                          </>
                        ) : (
                          "Join"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Private pool code */}
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
            Private Pool
          </h2>
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800 mx-auto">
                <Lock className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Got a code from a pool admin? Enter it below to join their private pool.
              </p>

              {codeError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                  <p className="text-xs text-red-400">{codeError}</p>
                </div>
              )}

              <Input
                label="Pool Code"
                placeholder="e.g. XKFM7RB2"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setCodeError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleJoinByCode()}
                className="text-center font-mono tracking-widest"
              />
              <Button
                className="w-full"
                onClick={handleJoinByCode}
                disabled={code.trim().length < 6 || codeLoading}
              >
                {codeLoading ? "Joining…" : "Join Pool"}
              </Button>
            </CardContent>
          </Card>

          {/* Create pool CTA */}
          <Card>
            <CardContent className="space-y-3 text-center">
              <p className="text-xs text-slate-400">
                Don&apos;t see what you&apos;re looking for?
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => router.push("/pool/create")}
              >
                Create Your Own Pool
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

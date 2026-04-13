"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getJackpotData, addJackpotAdjustment } from "@/actions/admin";
import { useParams } from "next/navigation";

interface LedgerEntry {
  id: string;
  entry_type: string;
  amount: number;
  running_balance: number;
  description: string;
  created_at: string;
  week_id: string | null;
}

export default function AdminJackpotPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [totalPayouts, setTotalPayouts] = useState(0);
  const [totalRake, setTotalRake] = useState(0);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    const data = await getJackpotData(poolId);
    if (!data) return;
    setLedger(data.ledger as LedgerEntry[]);
    setCurrentBalance(data.currentBalance);
    setTotalCollected(data.totalCollected);
    setTotalPayouts(data.totalPayouts);
    setTotalRake(data.totalRake);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [poolId]);

  const handleAdjustment = async () => {
    if (!adjustAmount || !adjustReason.trim()) return;
    setSubmitting(true);
    setError("");

    const result = await addJackpotAdjustment(
      poolId,
      parseFloat(adjustAmount),
      adjustReason.trim()
    );

    if (result.error) {
      setError(result.error);
    } else {
      setAdjustAmount("");
      setAdjustReason("");
      await loadData();
    }
    setSubmitting(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Manage Jackpot</h1>
        <p className="text-sm text-slate-400 mt-1">Jackpot ledger</p>
      </div>

      {/* Current Pot */}
      <div className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-800 to-slate-900 p-8 text-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-emerald-500/8 rounded-full blur-3xl" />
        <div className="relative z-10">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400/70 mb-2">
            Current Jackpot
          </p>
          <p className="text-5xl font-bold text-white font-mono tabular-nums">
            ${Number(currentBalance).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Total Collected
            </p>
            <p className="text-2xl font-bold text-white mt-1 font-mono">
              ${totalCollected.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Total Payouts
            </p>
            <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">
              ${totalPayouts.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Admin Fees
            </p>
            <p className="text-2xl font-bold text-slate-300 mt-1 font-mono">
              ${totalRake.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Adjustment */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Adjustment</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="number"
              label="Amount (+/-)"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              className="sm:w-40"
            />
            <Input
              label="Reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              className="sm:self-end"
              disabled={!adjustAmount || !adjustReason.trim() || submitting}
              onClick={handleAdjustment}
            >
              {submitting ? "Recording..." : "Record"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-4.5 h-4.5 text-emerald-400" />
            Ledger History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No ledger entries yet.
            </p>
          ) : (
            <div className="space-y-0 divide-y divide-slate-800/50">
              {ledger.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                        Number(entry.amount) > 0
                          ? "bg-emerald-500/15 text-emerald-400"
                          : Number(entry.amount) < 0
                            ? "bg-red-500/15 text-red-400"
                            : "bg-slate-700/50 text-slate-400"
                      }`}
                    >
                      {Number(entry.amount) > 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : Number(entry.amount) < 0 ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : (
                        <TrendingUp className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-white">
                        {entry.description || entry.entry_type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(entry.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-mono font-medium ${
                        Number(entry.amount) > 0
                          ? "text-emerald-400"
                          : Number(entry.amount) < 0
                            ? "text-red-400"
                            : "text-slate-400"
                      }`}
                    >
                      {Number(entry.amount) > 0
                        ? `+$${Number(entry.amount).toLocaleString()}`
                        : Number(entry.amount) < 0
                          ? `-$${Math.abs(Number(entry.amount)).toLocaleString()}`
                          : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

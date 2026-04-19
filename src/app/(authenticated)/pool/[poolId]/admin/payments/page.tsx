"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Check, AlertCircle } from "lucide-react";
import {
  getPaymentsData,
  togglePayment as togglePaymentAction,
} from "@/actions/admin";
import { useParams } from "next/navigation";

interface Week {
  id: string;
  week_number: number;
}

interface Member {
  user_id: string;
  profiles: { display_name: string } | null;
}

interface Payment {
  id: string;
  week_id: string;
  user_id: string;
  is_paid: boolean;
  amount: number;
}

export default function AdminPaymentsPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [weeks, setWeeks] = useState<Week[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [entryFee, setEntryFee] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const data = await getPaymentsData(poolId);
      if (!data) {
        setLoading(false);
        return;
      }
      setWeeks(data.weeks);
      setMembers(data.members as unknown as Member[]);
      setEmailMap(data.emailMap ?? {});
      setPayments(data.payments as unknown as Payment[]);
      setEntryFee(data.entryFee);
      setLoading(false);
    }
    load();
  }, [poolId]);

  const getPaymentStatus = (userId: string, weekId: string): boolean => {
    return payments.some(
      (p) => p.user_id === userId && p.week_id === weekId && p.is_paid
    );
  };

  const handleToggle = async (userId: string, weekId: string) => {
    const key = `${userId}-${weekId}`;
    setToggling(key);
    setToggleError(null);

    const currentlyPaid = getPaymentStatus(userId, weekId);
    const result = await togglePaymentAction(
      poolId,
      weekId,
      userId,
      !currentlyPaid,
      entryFee
    );

    if (result.error) {
      setToggleError(result.error);
    } else {
      // Update local state
      setPayments((prev) => {
        const existing = prev.find(
          (p) => p.user_id === userId && p.week_id === weekId
        );
        if (existing) {
          return prev.map((p) =>
            p.user_id === userId && p.week_id === weekId
              ? { ...p, is_paid: !currentlyPaid }
              : p
          );
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            week_id: weekId,
            user_id: userId,
            is_paid: !currentlyPaid,
            amount: entryFee,
          },
        ];
      });
    }
    setToggling(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-lg">No weeks created yet.</p>
      </div>
    );
  }

  const currentWeekId = weeks[0]?.id;
  const paidThisWeek = members.filter((m) =>
    getPaymentStatus(m.user_id, currentWeekId)
  ).length;

  const totalPaid = payments.filter((p) => p.is_paid).length * entryFee;
  const totalOwed = members.length * weeks.length * entryFee;
  const totalOutstanding = totalOwed - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Payments</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track weekly entry fee payments — checking a box marks that member paid and adds their fee to the jackpot.
          </p>
        </div>
      </div>

      {toggleError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{toggleError}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Week {weeks[0]?.week_number} Paid
            </p>
            <p className="text-2xl font-bold text-white mt-1 font-mono">
              {paidThisWeek}/{members.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Total Collected
            </p>
            <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
              ${totalPaid.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Outstanding
            </p>
            <p className="text-2xl font-bold text-red-400 mt-1 font-mono">
              ${totalOutstanding.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments Table */}
      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                  <th className="text-left py-3">Member</th>
                  {weeks.map((w) => (
                    <th key={w.id} className="text-center py-3 w-24">
                      Wk {w.week_number}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {members.map((member) => {
                  const name =
                    (member.profiles as unknown as { display_name: string })
                      ?.display_name ?? "Unknown";
                  const email = emailMap[member.user_id] ?? "";
                  return (
                    <tr key={member.user_id} className="hover:bg-slate-800/30">
                      <td className="py-3">
                        <p className="text-sm text-white">{name}</p>
                        {email && (
                          <p className="text-xs text-slate-500">{email}</p>
                        )}
                      </td>
                      {weeks.map((w) => {
                        const isPaid = getPaymentStatus(member.user_id, w.id);
                        const key = `${member.user_id}-${w.id}`;
                        return (
                          <td key={w.id} className="py-3 text-center">
                            <button
                              onClick={() => handleToggle(member.user_id, w.id)}
                              disabled={toggling === key}
                              title={isPaid ? "Mark unpaid" : "Mark paid"}
                              className={`mx-auto w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                toggling === key
                                  ? "opacity-40"
                                  : "cursor-pointer active:scale-90"
                              } ${
                                isPaid
                                  ? "bg-emerald-500 border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600"
                                  : "border-slate-600 hover:border-emerald-500 bg-transparent"
                              }`}
                            >
                              {isPaid && (
                                <Check className="w-3 h-3 text-white" strokeWidth={3} />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Shield, UserMinus, Check, AlertTriangle } from "lucide-react";
import { QRCodeDisplay } from "@/components/ui/qr-code";
import {
  getPoolSettings,
  updatePoolSettings,
  removeMember,
} from "@/actions/admin";
import { useParams } from "next/navigation";

interface Member {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: { display_name: string } | null;
}

export default function AdminSettingsPage() {
  const params = useParams();
  const poolId = params.poolId as string;

  const [poolName, setPoolName] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const data = await getPoolSettings(poolId);
      if (!data || !data.pool) {
        setLoading(false);
        return;
      }
      setPoolName(data.pool.name);
      setEntryFee(String(data.pool.entry_fee));
      setJoinCode(data.pool.join_code);
      setMembers(data.members as unknown as Member[]);
      setEmailMap((data as unknown as { emailMap: Record<string, string> }).emailMap ?? {});
      setLoading(false);
    }
    load();
  }, [poolId]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    const result = await updatePoolSettings(poolId, {
      name: poolName.trim(),
      entry_fee: parseFloat(entryFee) || 0,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleRemoveMember = async () => {
    if (!confirmRemove) return;
    setRemovingId(confirmRemove.userId);
    setConfirmRemove(null);
    const result = await removeMember(poolId, confirmRemove.userId);
    if (!result.error) {
      setMembers((prev) => prev.filter((m) => m.user_id !== confirmRemove.userId));
    }
    setRemovingId(null);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="h-48 bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-48 bg-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Pool Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your pool configuration
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Pool Name"
            value={poolName}
            onChange={(e) => setPoolName(e.target.value)}
          />
          <Input
            label="Entry Fee ($)"
            type="number"
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
          />
          <div className="flex gap-3">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Join Code */}
      <Card>
        <CardHeader>
          <CardTitle>Invite Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 font-mono text-lg text-white tracking-widest text-center">
              {joinCode}
            </div>
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center justify-center py-6">
            <QRCodeDisplay code={joinCode} size={160} />
          </div>
          <p className="text-xs text-slate-500 text-center">
            Share this code or QR with friends to invite them to your pool.
          </p>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-slate-800/50">
            {members.map((member) => {
              const name =
                (member.profiles as unknown as { display_name: string })
                  ?.display_name ?? "Unknown";
              const email = emailMap[member.user_id] ?? "";
              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300 flex-shrink-0">
                      {name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm text-white">{name}</span>
                      {email && (
                        <p className="text-xs text-slate-500">{email}</p>
                      )}
                      <p className="text-xs text-slate-600">
                        Joined {formatDate(member.joined_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={member.role === "admin" ? "admin" : "member"}
                    >
                      {member.role === "admin" ? (
                        <>
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </>
                      ) : (
                        "Member"
                      )}
                    </Badge>
                    {member.role !== "admin" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300 px-2"
                        disabled={removingId === member.user_id}
                        onClick={() => setConfirmRemove({ userId: member.user_id, name })}
                      >
                        {removingId === member.user_id
                          ? <span className="text-xs">Removing…</span>
                          : <UserMinus className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Remove Member Confirmation Modal ─────────────────────── */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmRemove(null)}
          />
          <div className="relative bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-5 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Remove Member</h2>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Are you sure you want to remove{" "}
              <span className="font-semibold text-white">{confirmRemove.name}</span>{" "}
              from this pool? They will lose access to all pool data and their picks history.
            </p>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => setConfirmRemove(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={handleRemoveMember}
              >
                <UserMinus className="w-3.5 h-3.5 mr-1.5" />
                Yes, Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

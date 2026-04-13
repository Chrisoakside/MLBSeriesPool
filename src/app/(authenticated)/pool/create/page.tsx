"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Check, ChevronRight } from "lucide-react";
import { QRCodeDisplay } from "@/components/ui/qr-code";
import { createPool } from "@/actions/pools";
import Link from "next/link";

const WEEK_OPTIONS = [4, 8, 10, 12, 16, 20];

export default function CreatePoolPage() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState("100");
  const [totalWeeks, setTotalWeeks] = useState(10);
  const [isPrivate, setIsPrivate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [poolId, setPoolId] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("entryFee", entryFee);
    formData.set("isPrivate", isPrivate ? "true" : "false");
    formData.set("totalWeeks", String(totalWeeks));

    const result = await createPool(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setPoolId(result.poolId ?? "");
    setJoinCode(result.joinCode ?? "");
    setStep("success");
    setLoading(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === "success") {
    return (
      <div className="max-w-md mx-auto space-y-6 pt-8">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Pool Created!</h1>
          <p className="text-sm text-slate-400 mt-2">
            Share the code below to invite members to{" "}
            <span className="text-white">{name}</span>.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {totalWeeks > 0 ? `${totalWeeks}-week season` : "Open-ended season"} · ${entryFee} entry
          </p>
        </div>

        <Card>
          <CardContent className="text-center space-y-4 py-6">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Join Code
            </p>
            <p className="text-3xl font-bold font-mono tracking-[0.3em] text-white">
              {joinCode}
            </p>
            <div className="flex items-center justify-center py-4">
              <QRCodeDisplay code={joinCode} size={160} />
            </div>
            <div className="flex gap-2 justify-center">
              <Button variant="secondary" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Code
                  </>
                )}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `Join ${name}`,
                      text: `Join my MLB Series Spread pool! Code: ${joinCode}`,
                    });
                  }
                }}
              >
                <Share2 className="w-3.5 h-3.5 mr-1.5" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Link href={`/pool/${poolId}/admin/lines`}>
            <Button className="w-full">
              Set This Week&apos;s Lines
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
          <Link href={`/pool/${poolId}/dashboard`}>
            <Button variant="secondary" className="w-full">
              Go to Pool Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pt-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Create a Pool</h1>
        <p className="text-sm text-slate-400 mt-1">
          Set up a new MLB series spread pool for your group.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <Card>
        <CardContent className="space-y-5">
          <Input
            label="Pool Name"
            placeholder="e.g. The Boys League"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            label="Entry Fee ($)"
            type="number"
            placeholder="100"
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
          />

          {/* Season Length */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Season Length
            </label>
            <div className="grid grid-cols-3 gap-2">
              {WEEK_OPTIONS.map((w) => (
                <button
                  key={w}
                  onClick={() => setTotalWeeks(w)}
                  className={`py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                    totalWeeks === w
                      ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                      : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                  }`}
                >
                  {w} weeks
                </button>
              ))}
            </div>
            <button
              onClick={() => setTotalWeeks(0)}
              className={`mt-2 w-full py-2.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                totalWeeks === 0
                  ? "bg-emerald-500/15 border-emerald-500 text-emerald-400"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              Open-ended (no fixed end)
            </button>
            <p className="text-xs text-slate-500 mt-1.5">
              {totalWeeks > 0
                ? `Pool runs for ${totalWeeks} weekends. Estimated prize pool: $${(parseFloat(entryFee) || 0) * totalWeeks > 0 ? ((parseFloat(entryFee) || 0) * totalWeeks).toLocaleString() : "—"} per member total.`
                : "You control when the season ends — create a new week each weekend as you go."}
            </p>
          </div>

          {/* Private toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Private Pool</p>
              <p className="text-xs text-slate-500">
                Members need approval to join
              </p>
            </div>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                isPrivate ? "bg-emerald-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  isPrivate ? "translate-x-5.5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          <Button
            className="w-full"
            onClick={handleCreate}
            disabled={!name.trim() || loading}
          >
            {loading ? "Creating..." : "Create Pool"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

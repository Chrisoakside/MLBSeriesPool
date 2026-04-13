"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Check } from "lucide-react";
import { QRCodeDisplay } from "@/components/ui/qr-code";
import { createPool } from "@/actions/pools";
import Link from "next/link";

export default function CreatePoolPage() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [name, setName] = useState("");
  const [entryFee, setEntryFee] = useState("100");
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

        <Link href={`/pool/${poolId}/dashboard`}>
          <Button className="w-full">Go to Pool Dashboard</Button>
        </Link>
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Private Pool</p>
              <p className="text-xs text-slate-500">
                Members need approval to join
              </p>
            </div>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
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

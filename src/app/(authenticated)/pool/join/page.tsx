"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Check, Users, Trophy } from "lucide-react";
import { joinPool } from "@/actions/pools";
import { useRouter } from "next/navigation";

export default function JoinPoolPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [poolId, setPoolId] = useState("");
  const [step, setStep] = useState<"enter" | "joined">("enter");
  const router = useRouter();

  const handleJoin = async () => {
    if (code.length < 6) return;
    setLoading(true);
    setError("");

    const result = await joinPool(code.trim());

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setPoolId(result.poolId ?? "");
    setStep("joined");
    setLoading(false);
  };

  if (step === "joined") {
    return (
      <div className="max-w-md mx-auto space-y-6 pt-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
          <Check className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          You&apos;re In!
        </h1>
        <p className="text-sm text-slate-400">
          Head to the dashboard to get started.
        </p>
        <Button className="w-full" onClick={() => router.push(`/pool/${poolId}/dashboard`)}>
          Go to Pool Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 pt-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Join a Pool</h1>
        <p className="text-sm text-slate-400 mt-1">
          Enter the pool code shared by your pool admin.
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
            label="Pool Code"
            placeholder="e.g. XKFM7RB2"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="text-center text-lg font-mono tracking-[0.2em]"
          />
          <Button
            className="w-full"
            onClick={handleJoin}
            disabled={code.length < 6 || loading}
          >
            {loading ? "Joining..." : "Join Pool"}
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-slate-800 px-3 text-xs text-slate-500">
                or
              </span>
            </div>
          </div>
          <Button variant="secondary" className="w-full" disabled>
            <Camera className="w-4 h-4 mr-2" />
            Scan QR Code
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

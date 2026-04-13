"use client";

import { Diamond } from "lucide-react";

interface TopBarProps {
  poolName?: string;
  jackpot?: number;
  userName?: string;
}

export function TopBar({
  poolName = "Select Pool",
  jackpot = 0,
  userName = "U",
}: TopBarProps) {
  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4">
      {/* Left: Pool name */}
      <button className="flex items-center gap-2 cursor-pointer">
        <Diamond className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-medium text-white truncate max-w-[120px]">
          {poolName}
        </span>
      </button>

      {/* Center: Jackpot */}
      <div className="flex items-center">
        <span className="text-sm font-bold text-emerald-400 font-mono tabular-nums">
          ${jackpot.toLocaleString()}
        </span>
      </div>

      {/* Right: User avatar */}
      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">
        {userName.charAt(0).toUpperCase()}
      </div>
    </header>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Diamond, ChevronDown, Check } from "lucide-react";
import { getActivePoolContext } from "@/actions/pools";
import type { PoolEntry } from "@/app/(authenticated)/layout";

interface TopBarProps {
  pools: PoolEntry[];
  userName?: string;
}

export function TopBar({ pools, userName = "U" }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [jackpot, setJackpot] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activePoolId = pathname.match(/^\/pool\/([^/]+)/)?.[1] ?? null;
  const activePool = pools.find((p) => p.id === activePoolId) ?? null;

  // Fetch jackpot for the active pool
  useEffect(() => {
    if (!activePoolId) { setJackpot(0); return; }
    getActivePoolContext(activePoolId).then((ctx) => setJackpot(ctx.jackpot));
  }, [activePoolId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Close on navigation
  useEffect(() => { setDropdownOpen(false); }, [pathname]);

  function switchPool(poolId: string) {
    setDropdownOpen(false);
    router.push(`/pool/${poolId}/dashboard`);
  }

  return (
    <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4">
      {/* Left: Pool name / switcher */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => pools.length > 0 && setDropdownOpen((o) => !o)}
          className="flex items-center gap-1.5 cursor-pointer"
        >
          <Diamond className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="text-sm font-medium text-white truncate max-w-[130px]">
            {activePool?.name ?? "Select Pool"}
          </span>
          {pools.length > 1 && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-500 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            />
          )}
        </button>

        {/* Pool picker dropdown */}
        {dropdownOpen && pools.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
            <div className="py-1">
              {pools.map((pool) => (
                <button
                  key={pool.id}
                  onClick={() => switchPool(pool.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span className={pool.id === activePoolId ? "text-emerald-400 font-medium" : "text-white"}>
                    {pool.name}
                  </span>
                  <div className="flex items-center gap-2">
                    {pool.role === "admin" && (
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-800 rounded px-1">
                        ADMIN
                      </span>
                    )}
                    {pool.id === activePoolId && (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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

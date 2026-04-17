"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/actions/auth";
import { getActivePoolContext } from "@/actions/pools";
import {
  LayoutDashboard,
  ListChecks,
  Ticket,
  Activity,
  Grid3x3,
  Trophy,
  MessageSquare,
  Settings2,
  DollarSign,
  Vault,
  Cog,
  Diamond,
  LogOut,
  ChevronDown,
  Search,
  Check,
} from "lucide-react";
import type { PoolEntry } from "@/app/(authenticated)/layout";

const memberNav = [
  { label: "Dashboard", icon: LayoutDashboard, href: "dashboard" },
  { label: "Make Picks", icon: ListChecks, href: "picks" },
  { label: "My Ticket", icon: Ticket, href: "ticket" },
  { label: "Scores", icon: Activity, href: "scores" },
  { label: "Picks Board", icon: Grid3x3, href: "board" },
  { label: "Leaderboard", icon: Trophy, href: "leaderboard" },
  { label: "Chat", icon: MessageSquare, href: "chat" },
];

const adminNav = [
  { label: "Set Lines", icon: Settings2, href: "admin/lines" },
  { label: "Payments", icon: DollarSign, href: "admin/payments" },
  { label: "Manage Pot", icon: Vault, href: "admin/jackpot" },
  { label: "Pool Settings", icon: Cog, href: "admin/settings" },
];

interface SidebarProps {
  pools: PoolEntry[];
  userName?: string;
}

export function Sidebar({ pools, userName = "User" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [jackpot, setJackpot] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Extract the active poolId from the current URL path (/pool/<id>/...)
  const activePoolId = pathname.match(/^\/pool\/([^/]+)/)?.[1] ?? null;
  const activePool = pools.find((p) => p.id === activePoolId) ?? null;
  const isAdmin = activePool?.role === "admin";
  const basePath = activePoolId ? `/pool/${activePoolId}` : "";

  // Fetch jackpot whenever the active pool changes
  useEffect(() => {
    if (!activePoolId) { setJackpot(0); return; }
    getActivePoolContext(activePoolId).then((ctx) => setJackpot(ctx.jackpot));
  }, [activePoolId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Close dropdown on navigation
  useEffect(() => { setDropdownOpen(false); }, [pathname]);

  function switchPool(poolId: string) {
    setDropdownOpen(false);
    router.push(`/pool/${poolId}/dashboard`);
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-slate-950 border-r border-slate-800 fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
        <Diamond className="w-5 h-5 text-emerald-500" />
        <span className="font-bold tracking-tight uppercase text-white text-sm">
          Series Spread
        </span>
      </div>

      {/* Pool Switcher */}
      <div className="px-3 py-3 relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
        >
          <span className="text-sm font-medium text-white truncate">
            {activePool?.name ?? "Select Pool"}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown */}
        {dropdownOpen && (
          <div className="absolute top-full left-3 right-3 z-50 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
            {pools.length === 0 ? (
              <p className="text-xs text-slate-500 px-3 py-3 text-center">No pools yet</p>
            ) : (
              <div className="py-1">
                {pools.map((pool) => (
                  <button
                    key={pool.id}
                    onClick={() => switchPool(pool.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-slate-800 transition-colors cursor-pointer"
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
            )}
            <div className="border-t border-slate-800 px-3 py-2">
              <Link
                href="/browse"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
              >
                <Search className="w-3 h-3" />
                Find another pool
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Jackpot Display */}
      {activePoolId && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400/70">
            Jackpot
          </p>
          <p className="text-lg font-bold text-emerald-400 font-mono tabular-nums">
            ${jackpot.toLocaleString()}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {memberNav.map((item) => {
          const href = `${basePath}/${item.href}`;
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={item.href}
              href={activePoolId ? href : "/browse"}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Discover */}
        <div className="pt-4 pb-2 px-3">
          <span className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">
            Discover
          </span>
        </div>
        <Link
          href="/browse"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
            pathname === "/browse"
              ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
              : "text-slate-400 hover:text-white hover:bg-slate-800/50"
          }`}
        >
          <Search className="w-4.5 h-4.5 flex-shrink-0" />
          <span>Find a Pool</span>
        </Link>

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <span className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">
                Admin
              </span>
            </div>
            {adminNav.map((item) => {
              const href = `${basePath}/${item.href}`;
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={item.href}
                  href={activePoolId ? href : "/browse"}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-slate-800 px-3 py-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-slate-300 truncate flex-1">{userName}</span>
          <button
            onClick={() => signOut()}
            className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

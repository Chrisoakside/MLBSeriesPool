"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/actions/auth";
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
} from "lucide-react";

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
  poolId?: string;
  poolName?: string;
  jackpot?: number;
  isAdmin?: boolean;
  userName?: string;
}

export function Sidebar({
  poolId,
  poolName = "Select Pool",
  jackpot = 0,
  isAdmin = false,
  userName = "User",
}: SidebarProps) {
  const pathname = usePathname();
  const basePath = poolId ? `/pool/${poolId}` : "";

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
      <div className="px-3 py-3">
        <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer">
          <span className="text-sm font-medium text-white truncate">
            {poolName}
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
        </button>
      </div>

      {/* Jackpot Display */}
      {poolId && (
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
              href={poolId ? href : "/dashboard"}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500 ml-0"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Global — visible regardless of active pool */}
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
              const isActive =
                pathname === href || pathname.startsWith(href + "/");

              return (
                <Link
                  key={item.href}
                  href={poolId ? href : "/dashboard"}
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
          <span className="text-sm text-slate-300 truncate flex-1">
            {userName}
          </span>
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

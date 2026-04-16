"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ListChecks,
  Ticket,
  Grid3x3,
  Menu,
  X,
  Activity,
  Trophy,
  MessageSquare,
  Settings2,
  DollarSign,
  Vault,
  Cog,
  Search,
} from "lucide-react";

interface BottomNavProps {
  poolId?: string;
  isAdmin?: boolean;
}

const memberItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "dashboard" },
  { label: "Make Picks", icon: ListChecks, href: "picks" },
  { label: "My Ticket", icon: Ticket, href: "ticket" },
  { label: "Scores", icon: Activity, href: "scores" },
  { label: "Picks Board", icon: Grid3x3, href: "board" },
  { label: "Leaderboard", icon: Trophy, href: "leaderboard" },
  { label: "Chat", icon: MessageSquare, href: "chat" },
];

const adminItems = [
  { label: "Set Lines", icon: Settings2, href: "admin/lines" },
  { label: "Payments", icon: DollarSign, href: "admin/payments" },
  { label: "Manage Pot", icon: Vault, href: "admin/jackpot" },
  { label: "Pool Settings", icon: Cog, href: "admin/settings" },
];

export function BottomNav({ poolId, isAdmin = false }: BottomNavProps) {
  const pathname = usePathname();
  const basePath = poolId ? `/pool/${poolId}` : "";
  const [sheetOpen, setSheetOpen] = useState(false);

  const tabs = [
    { label: "Home", icon: LayoutDashboard, href: `${basePath}/dashboard` },
    { label: "Picks", icon: ListChecks, href: `${basePath}/picks` },
    { label: "Ticket", icon: Ticket, href: `${basePath}/ticket` },
    { label: "Board", icon: Grid3x3, href: `${basePath}/board` },
  ];

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.label}
                href={poolId ? tab.href : "/dashboard"}
                className={`flex flex-col items-center justify-center gap-1 px-3 py-1 transition-colors ${
                  isActive
                    ? "text-emerald-400"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px]">{tab.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setSheetOpen(true)}
            className={`flex flex-col items-center justify-center gap-1 px-3 py-1 transition-colors ${
              sheetOpen ? "text-emerald-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>

      {/* Bottom Sheet Overlay */}
      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSheetOpen(false)}
          />

          {/* Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 rounded-t-2xl pb-[env(safe-area-inset-bottom)]">
            {/* Handle + close */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="w-10 h-1 rounded-full bg-slate-700 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <span className="text-sm font-semibold text-white">Menu</span>
              <button
                onClick={() => setSheetOpen(false)}
                className="text-slate-400 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pb-4 space-y-1 max-h-[70vh] overflow-y-auto">
              {/* Member nav items */}
              {memberItems.map((item) => {
                const href = poolId ? `${basePath}/${item.href}` : "/dashboard";
                const isActive =
                  pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={() => setSheetOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}

              {/* Find a Pool */}
              <Link
                href="/browse"
                onClick={() => setSheetOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                  pathname === "/browse"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Search className="w-5 h-5 flex-shrink-0" />
                <span>Find a Pool</span>
              </Link>

              {/* Admin section */}
              {isAdmin && (
                <>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] uppercase tracking-widest text-slate-600 font-medium">
                      Admin
                    </span>
                  </div>
                  {adminItems.map((item) => {
                    const href = poolId
                      ? `${basePath}/${item.href}`
                      : "/dashboard";
                    const isActive =
                      pathname === href || pathname.startsWith(href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        onClick={() => setSheetOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                          isActive
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

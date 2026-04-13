"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  Ticket,
  Grid3x3,
  Menu,
} from "lucide-react";

interface BottomNavProps {
  poolId?: string;
}

export function BottomNav({ poolId }: BottomNavProps) {
  const pathname = usePathname();
  const basePath = poolId ? `/pool/${poolId}` : "";

  const tabs = [
    { label: "Home", icon: LayoutDashboard, href: `${basePath}/dashboard` },
    { label: "Picks", icon: ListChecks, href: `${basePath}/picks` },
    { label: "Ticket", icon: Ticket, href: `${basePath}/ticket` },
    { label: "Board", icon: Grid3x3, href: `${basePath}/board` },
    { label: "More", icon: Menu, href: "#more" },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950 border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive =
            tab.href !== "#more" &&
            (pathname === tab.href || pathname.startsWith(tab.href + "/"));

          if (tab.href === "#more") {
            return (
              <button
                key={tab.label}
                className="flex flex-col items-center justify-center gap-1 px-3 py-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <tab.icon className="w-5 h-5" />
                <span className="text-[10px]">{tab.label}</span>
              </button>
            );
          }

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
      </div>
    </nav>
  );
}

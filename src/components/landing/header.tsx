"use client";

import { useState, useEffect } from "react";
import { Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToAuth = () => {
    document.getElementById("auth-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-all duration-300 ${
        scrolled
          ? "bg-slate-950/95 backdrop-blur-md border-b border-slate-800/50"
          : "bg-transparent"
      }`}
    >
      <div className="flex items-center gap-2">
        <Diamond className="w-6 h-6 text-emerald-500" />
        <span className="text-lg font-bold tracking-tight uppercase text-white">
          Series Spread
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={scrollToAuth}
          className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          Log In
        </button>
        <Button size="sm" onClick={scrollToAuth}>
          Get Started
        </Button>
      </div>
    </header>
  );
}

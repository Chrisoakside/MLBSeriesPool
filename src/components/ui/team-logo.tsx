"use client";

import { useState } from "react";

const ESPN_SLUG_OVERRIDES: Record<string, string> = {
  AZ: "ari",
  CWS: "chw",
};

export function TeamLogo({ abbr, size = 32 }: { abbr: string; size?: number }) {
  const [errored, setErrored] = useState(false);
  const slug = ESPN_SLUG_OVERRIDES[abbr] ?? abbr.toLowerCase();

  if (errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-300 flex-shrink-0"
      >
        {abbr.slice(0, 3)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://a.espncdn.com/i/teamlogos/mlb/500/${slug}.png`}
      alt={abbr}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className="object-contain flex-shrink-0"
    />
  );
}

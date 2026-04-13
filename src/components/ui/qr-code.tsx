"use client";

import { useEffect, useState } from "react";

interface QRCodeDisplayProps {
  code: string;
  size?: number;
}

export function QRCodeDisplay({ code, size = 160 }: QRCodeDisplayProps) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/qr?code=${encodeURIComponent(code)}`)
      .then((r) => r.text())
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [code]);

  if (!svg) {
    return (
      <div
        className="bg-slate-700 rounded-xl animate-pulse"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="bg-white rounded-xl p-2 flex items-center justify-center"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

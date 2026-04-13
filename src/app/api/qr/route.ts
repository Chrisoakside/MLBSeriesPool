import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return new NextResponse("Missing code parameter", { status: 400 });
  }

  // Generate join URL — the value encoded in the QR
  const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/pool/join?code=${encodeURIComponent(code)}`;

  const svg = await QRCode.toString(joinUrl, {
    type: "svg",
    color: {
      dark: "#0f172a",  // slate-900
      light: "#ffffff",
    },
    margin: 2,
    width: 200,
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

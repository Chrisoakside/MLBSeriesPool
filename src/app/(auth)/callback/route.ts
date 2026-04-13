import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // Build the redirect response first so we can set cookies directly on it.
    // If we set cookies via cookies() from next/headers they don't get attached
    // to the NextResponse.redirect() and the middleware sees no session.
    const redirectTo = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectTo.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectTo;
    }
    // Surface the real error message so it's visible in the URL for debugging
    return NextResponse.redirect(
      `${origin}/?error=${encodeURIComponent(error.message)}`
    );
  }

  // No code in the URL at all
  return NextResponse.redirect(`${origin}/?error=missing_code`);
}

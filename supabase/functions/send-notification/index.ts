/**
 * send-notification Edge Function
 *
 * Stub for push notification dispatch.
 * Called after week resolution or other significant events.
 * V1: no-op. V2: integrate with Web Push (VAPID).
 */

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const ingestSecret = Deno.env.get("INGEST_SECRET");
  const providedSecret = req.headers.get("x-ingest-secret");
  if (!ingestSecret || providedSecret !== ingestSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // V1 stub — no-op
  return new Response(
    JSON.stringify({ message: "Notifications not yet implemented" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

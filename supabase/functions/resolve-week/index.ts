/**
 * resolve-week Edge Function
 *
 * Resolves weeks where all series are final or void.
 * - Computes final ticket statuses
 * - Creates jackpot ledger entries (payout if winner, rollover if not)
 * - Sets weeks.status = 'resolved'
 * - Broadcasts resolution event to affected pools
 *
 * Authentication: requires X-Ingest-Secret header.
 * Called by ingest-scores after recomputation, or manually by admin.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Find weeks in 'locked' status where all mlb_series are final/void
    const { data: lockedWeeks } = await supabase
      .from("weeks")
      .select("id, pool_id, week_number, label")
      .eq("status", "locked");

    if (!lockedWeeks || lockedWeeks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No locked weeks to resolve" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedWeeks: string[] = [];

    for (const week of lockedWeeks) {
      // Check if all series for this week are final/void
      const { data: seriesList } = await supabase
        .from("series")
        .select("mlb_series_id, mlb_series(status, is_void)")
        .eq("week_id", week.id);

      if (!seriesList || seriesList.length === 0) continue;

      const allResolved = seriesList.every((s: { mlb_series: { status: string; is_void: boolean } | null }) => {
        const ms = s.mlb_series;
        return ms && (ms.status === "final" || ms.status === "void" || ms.is_void);
      });

      if (!allResolved) continue;

      // Check if any ticket has status 'won' (perfect 6/6)
      const { data: winners } = await supabase
        .from("tickets")
        .select("id, user_id, correct_picks")
        .eq("week_id", week.id)
        .eq("pool_id", week.pool_id)
        .eq("status", "won");

      // Get current jackpot balance
      const { data: latestLedger } = await supabase
        .from("jackpot_ledger")
        .select("running_balance")
        .eq("pool_id", week.pool_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const currentBalance = latestLedger?.running_balance ?? 0;

      if (winners && winners.length > 0) {
        // Split jackpot among winners
        const payoutPerWinner = currentBalance / winners.length;

        for (const winner of winners) {
          await supabase.from("jackpot_ledger").insert({
            pool_id: week.pool_id,
            week_id: week.id,
            entry_type: "payout",
            amount: -payoutPerWinner,
            description: `Jackpot payout — Week ${week.week_number} winner (${winner.correct_picks}/6)`,
            created_by: winner.user_id,
          });
        }
      } else {
        // No winner — record rollover
        await supabase.from("jackpot_ledger").insert({
          pool_id: week.pool_id,
          week_id: week.id,
          entry_type: "rollover",
          amount: 0,
          description: `No winner — Week ${week.week_number} rolls over`,
        });
      }

      // Mark week as resolved
      await supabase
        .from("weeks")
        .update({ status: "resolved" })
        .eq("id", week.id);

      resolvedWeeks.push(week.id);

      // Broadcast resolution to the pool
      const hasWinner = winners && winners.length > 0;
      await supabase.channel(`pool:${week.pool_id}`).send({
        type: "broadcast",
        event: "week_resolved",
        payload: {
          weekId: week.id,
          weekNumber: week.week_number,
          hasWinner,
          winnerCount: winners?.length ?? 0,
          jackpot: currentBalance,
        },
      });
    }

    return new Response(
      JSON.stringify({
        message: "Week resolution complete",
        resolvedWeeks: resolvedWeeks.length,
        weekIds: resolvedWeeks,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("resolve-week error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

"use server";

import { createClient } from "@/lib/supabase/server";

export async function createWeek(
  poolId: string,
  weekNumber: number,
  label: string,
  lockTime: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_week", {
    p_pool_id: poolId,
    p_week_number: weekNumber,
    p_label: label,
    p_lock_time: lockTime,
  });
  if (error) return { error: error.message };
  return { weekId: data };
}

export async function upsertSeries(
  weekId: string,
  seriesEntries: {
    mlb_series_id: string;
    spread: number;
    favorite: "home" | "away";
  }[]
) {
  const supabase = await createClient();

  // Delete existing series for this week, then insert new ones
  await supabase.from("series").delete().eq("week_id", weekId);

  const rows = seriesEntries.map((s) => ({
    week_id: weekId,
    mlb_series_id: s.mlb_series_id,
    spread: s.spread,
    favorite: s.favorite,
  }));

  const { error } = await supabase.from("series").insert(rows);
  if (error) return { error: error.message };
  return { success: true };
}

export async function publishLines(weekId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_lines", {
    p_week_id: weekId,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function getAdminLinesData(poolId: string) {
  const supabase = await createClient();

  // Current week (most recent)
  const { data: week } = await supabase
    .from("weeks")
    .select("*")
    .eq("pool_id", poolId)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();

  // Available MLB series (always fetch, used for new week creation too)
  const { data: mlbSeries } = await supabase
    .from("mlb_series")
    .select("*")
    .order("series_start_date", { ascending: false })
    .limit(30);

  // If no week yet, return enough to show the "create week" form
  if (!week) {
    return {
      week: null,
      series: [],
      mlbSeries: mlbSeries ?? [],
      nextWeekNumber: 1,
    };
  }

  // Existing series for this week
  const { data: seriesList } = await supabase
    .from("series")
    .select("*, mlb_series(*)")
    .eq("week_id", week.id);

  return {
    week,
    series: seriesList ?? [],
    mlbSeries: mlbSeries ?? [],
    nextWeekNumber: week.week_number + 1,
  };
}

export async function getPaymentsData(poolId: string) {
  const supabase = await createClient();

  // Get recent weeks
  const { data: weeks } = await supabase
    .from("weeks")
    .select("id, week_number")
    .eq("pool_id", poolId)
    .order("week_number", { ascending: false })
    .limit(3);

  if (!weeks?.length) return null;

  // Get all members
  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id, profiles(display_name)")
    .eq("pool_id", poolId)
    .eq("is_approved", true);

  // Get payments for recent weeks
  const weekIds = weeks.map((w) => w.id);
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("pool_id", poolId)
    .in("week_id", weekIds);

  // Get pool entry fee
  const { data: pool } = await supabase
    .from("pools")
    .select("entry_fee")
    .eq("id", poolId)
    .single();

  return {
    weeks: weeks ?? [],
    members: members ?? [],
    payments: payments ?? [],
    entryFee: pool?.entry_fee ?? 0,
  };
}

export async function togglePayment(
  poolId: string,
  weekId: string,
  userId: string,
  isPaid: boolean,
  amount: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Upsert payment record
  const { error } = await supabase
    .from("payments")
    .upsert(
      {
        pool_id: poolId,
        week_id: weekId,
        user_id: userId,
        amount,
        is_paid: isPaid,
        paid_at: isPaid ? new Date().toISOString() : null,
        marked_by: user.id,
      },
      { onConflict: "pool_id,week_id,user_id" }
    );

  if (error) return { error: error.message };
  return { success: true };
}

export async function getJackpotData(poolId: string) {
  const supabase = await createClient();

  const { data: ledger } = await supabase
    .from("jackpot_ledger")
    .select("*")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false })
    .limit(50);

  const currentBalance = ledger?.[0]?.running_balance ?? 0;

  // Totals
  const totalCollected = (ledger ?? [])
    .filter((e) => e.entry_type === "entry_fee")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalPayouts = (ledger ?? [])
    .filter((e) => e.entry_type === "payout")
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);
  const totalRake = (ledger ?? [])
    .filter((e) => e.entry_type === "rake")
    .reduce((sum, e) => sum + Math.abs(Number(e.amount)), 0);

  return {
    ledger: ledger ?? [],
    currentBalance,
    totalCollected,
    totalPayouts,
    totalRake,
  };
}

export async function addJackpotAdjustment(
  poolId: string,
  amount: number,
  description: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("jackpot_ledger").insert({
    pool_id: poolId,
    entry_type: "adjustment",
    amount,
    description,
    created_by: user.id,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function getPoolSettings(poolId: string) {
  const supabase = await createClient();

  const { data: pool } = await supabase
    .from("pools")
    .select("*")
    .eq("id", poolId)
    .single();

  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id, role, joined_at, profiles(display_name)")
    .eq("pool_id", poolId)
    .eq("is_approved", true)
    .order("joined_at", { ascending: true });

  return { pool, members: members ?? [] };
}

export async function updatePoolSettings(
  poolId: string,
  updates: { name?: string; entry_fee?: number }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pools")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", poolId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function removeMember(poolId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pool_members")
    .delete()
    .eq("pool_id", poolId)
    .eq("user_id", userId);

  if (error) return { error: error.message };
  return { success: true };
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPool(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const entryFee = parseFloat(formData.get("entryFee") as string) || 25;
  const isPrivate = formData.get("isPrivate") === "true";
  const totalWeeks = parseInt(formData.get("totalWeeks") as string) || 0;

  const { data, error } = await supabase.rpc("create_pool", {
    p_name: name,
    p_entry_fee: entryFee,
    p_is_private: isPrivate,
    p_total_weeks: totalWeeks,
  });

  if (error) return { error: error.message };

  // Fetch the created pool to get the join code
  const { data: pool } = await supabase
    .from("pools")
    .select("id, join_code")
    .eq("id", data)
    .single();

  return { poolId: pool?.id, joinCode: pool?.join_code };
}

export async function joinPool(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase.rpc("join_pool", {
    p_join_code: code,
  });

  if (error) return { error: error.message };
  return { poolId: data };
}

/** Join a public pool directly by its UUID (no code required). */
export async function joinPoolById(poolId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Fetch the join code for this public pool
  const { data: pool, error: fetchErr } = await supabase
    .from("pools")
    .select("join_code, is_private")
    .eq("id", poolId)
    .single();

  if (fetchErr || !pool) return { error: "Pool not found" };
  if (pool.is_private) return { error: "This pool is private — ask the admin for a code" };

  const { data, error } = await supabase.rpc("join_pool", {
    p_join_code: pool.join_code,
  });

  if (error) return { error: error.message };
  return { poolId: data as string };
}

export async function getMyPools() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("pool_members")
    .select(`
      role,
      pools (
        id, name, entry_fee, is_active, join_code
      )
    `)
    .eq("user_id", user.id)
    .eq("is_approved", true);

  if (!data) return [];

  // Enrich with jackpot and member count
  const pools = await Promise.all(
    data.map(async (membership) => {
      const pool = membership.pools as unknown as {
        id: string; name: string; entry_fee: number; is_active: boolean; join_code: string;
      };
      if (!pool) return null;

      // Get member count
      const { count } = await supabase
        .from("pool_members")
        .select("*", { count: "exact", head: true })
        .eq("pool_id", pool.id)
        .eq("is_approved", true);

      // Get current jackpot
      const { data: ledger } = await supabase
        .from("jackpot_ledger")
        .select("running_balance")
        .eq("pool_id", pool.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Get current week
      const { data: week } = await supabase
        .from("weeks")
        .select("id, week_number, status, lock_time")
        .eq("pool_id", pool.id)
        .order("week_number", { ascending: false })
        .limit(1)
        .single();

      // Check if user has submitted ticket for current week
      let weekStatus = "No Active Week";
      if (week) {
        const { data: ticket } = await supabase
          .from("tickets")
          .select("id")
          .eq("week_id", week.id)
          .eq("user_id", user.id)
          .single();

        if (week.status === "resolved") weekStatus = "View Results";
        else if (ticket) weekStatus = "Picks Submitted";
        else if (week.status === "lines_set") weekStatus = "Make Picks";
        else if (week.status === "locked") weekStatus = "Locked";
        else weekStatus = "Pending";
      }

      return {
        id: pool.id,
        name: pool.name,
        members: count ?? 0,
        role: membership.role as "admin" | "member",
        jackpot: ledger?.running_balance ?? 0,
        weekStatus,
        weekNumber: week?.week_number,
        entryFee: pool.entry_fee,
      };
    })
  );

  return pools.filter(Boolean);
}

export async function getPublicPools() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch all active public pools
  const { data: pools } = await supabase
    .from("pools")
    .select("id, name, entry_fee, created_at")
    .eq("is_private", false)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!pools || pools.length === 0) return [];

  // Which pools is the user already in?
  const { data: myMemberships } = await supabase
    .from("pool_members")
    .select("pool_id")
    .eq("user_id", user.id);
  const myPoolIds = new Set(myMemberships?.map((m) => m.pool_id) ?? []);

  // Enrich each pool with member count and current jackpot
  const enriched = await Promise.all(
    pools.map(async (pool) => {
      const { count: memberCount } = await supabase
        .from("pool_members")
        .select("*", { count: "exact", head: true })
        .eq("pool_id", pool.id)
        .eq("is_approved", true);

      const { data: ledger } = await supabase
        .from("jackpot_ledger")
        .select("running_balance")
        .eq("pool_id", pool.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return {
        id: pool.id,
        name: pool.name,
        entryFee: pool.entry_fee as number,
        memberCount: memberCount ?? 0,
        jackpot: (ledger?.running_balance as number) ?? 0,
        isMember: myPoolIds.has(pool.id),
      };
    })
  );

  return enriched;
}

export async function getPoolDashboard(poolId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Pool info
  const { data: pool } = await supabase
    .from("pools")
    .select("*")
    .eq("id", poolId)
    .single();
  if (!pool) return null;

  // User's membership
  const { data: membership } = await supabase
    .from("pool_members")
    .select("role")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .single();
  if (!membership) return null;

  // Current jackpot
  const { data: ledger } = await supabase
    .from("jackpot_ledger")
    .select("running_balance")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Current week
  const { data: currentWeek } = await supabase
    .from("weeks")
    .select("*")
    .eq("pool_id", poolId)
    .order("week_number", { ascending: false })
    .limit(1)
    .single();

  // User's ticket for current week
  let ticket = null;
  if (currentWeek) {
    const { data: t } = await supabase
      .from("tickets")
      .select("*, ticket_picks(*, series(*, mlb_series(*)))")
      .eq("week_id", currentWeek.id)
      .eq("user_id", user.id)
      .single();
    ticket = t;
  }

  // Leaderboard (top 5 by correct_picks across all weeks)
  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id, profiles(display_name)")
    .eq("pool_id", poolId)
    .eq("is_approved", true);

  // Recent chat messages
  const { data: recentChat } = await supabase
    .from("chat_messages")
    .select("*, profiles(display_name)")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false })
    .limit(3);

  // Member count
  const { count: memberCount } = await supabase
    .from("pool_members")
    .select("*", { count: "exact", head: true })
    .eq("pool_id", poolId)
    .eq("is_approved", true);

  // Unpaid count for current week (admin)
  let unpaidCount = 0;
  if (membership.role === "admin" && currentWeek) {
    const { count } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("pool_id", poolId)
      .eq("week_id", currentWeek.id)
      .eq("is_paid", false);
    unpaidCount = count ?? 0;
  }

  // Total weeks played
  const { count: totalWeeks } = await supabase
    .from("weeks")
    .select("*", { count: "exact", head: true })
    .eq("pool_id", poolId)
    .in("status", ["locked", "resolved"]);

  return {
    pool,
    role: membership.role,
    jackpot: ledger?.running_balance ?? 0,
    currentWeek,
    ticket,
    members: members ?? [],
    memberCount: memberCount ?? 0,
    recentChat: (recentChat ?? []).reverse(),
    unpaidCount,
    totalWeeks: totalWeeks ?? 0,
  };
}

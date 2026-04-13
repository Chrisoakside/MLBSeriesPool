"use server";

import { createClient } from "@/lib/supabase/server";

export async function getChatMessages(poolId: string, limit = 50) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("chat_messages")
    .select("*, profiles(display_name)")
    .eq("pool_id", poolId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).reverse();
}

export async function sendChatMessage(poolId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("chat_messages").insert({
    pool_id: poolId,
    user_id: user.id,
    content: content.trim(),
  });

  if (error) return { error: error.message };
  return { success: true };
}

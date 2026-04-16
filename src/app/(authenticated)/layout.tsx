import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { TopBar } from "@/components/navigation/top-bar";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Fetch user's pool memberships
  const { data: memberships } = await supabase
    .from("pool_members")
    .select("pool_id, role, pools(id, name, entry_fee)")
    .eq("user_id", user.id)
    .eq("is_approved", true);

  const userName = profile?.display_name ?? user.email ?? "User";

  // Determine active pool context (first pool for now)
  const firstMembership = memberships?.[0];
  const pool = firstMembership?.pools as unknown as { id: string; name: string } | null;
  const poolId = pool?.id;
  const poolName = pool?.name ?? "Select Pool";
  const isAdmin = firstMembership?.role === "admin";

  // Get jackpot for active pool
  let jackpot = 0;
  if (poolId) {
    const { data: ledger } = await supabase
      .from("jackpot_ledger")
      .select("running_balance")
      .eq("pool_id", poolId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    jackpot = ledger?.running_balance ?? 0;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Desktop Sidebar */}
      <Sidebar
        poolId={poolId}
        poolName={poolName}
        jackpot={jackpot}
        isAdmin={isAdmin}
        userName={userName}
      />

      {/* Mobile Top Bar */}
      <TopBar
        poolName={poolName}
        jackpot={jackpot}
        userName={userName}
      />

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav poolId={poolId ?? "demo"} isAdmin={isAdmin} />
    </div>
  );
}

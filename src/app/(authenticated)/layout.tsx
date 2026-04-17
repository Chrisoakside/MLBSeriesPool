import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/sidebar";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { TopBar } from "@/components/navigation/top-bar";

export type PoolEntry = {
  id: string;
  name: string;
  role: "admin" | "member";
};

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

  // Fetch ALL pool memberships — the sidebar uses the URL to determine which is active
  const { data: memberships } = await supabase
    .from("pool_members")
    .select("pool_id, role, pools(id, name)")
    .eq("user_id", user.id)
    .eq("is_approved", true);

  const userName = profile?.display_name ?? user.email ?? "User";

  const allPools: PoolEntry[] = (memberships ?? [])
    .map((m) => {
      const pool = m.pools as unknown as { id: string; name: string } | null;
      if (!pool) return null;
      return { id: pool.id, name: pool.name, role: m.role as "admin" | "member" };
    })
    .filter(Boolean) as PoolEntry[];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Desktop Sidebar */}
      <Sidebar pools={allPools} userName={userName} />

      {/* Mobile Top Bar */}
      <TopBar pools={allPools} userName={userName} />

      {/* Main Content */}
      <main className="lg:ml-64 pt-14 lg:pt-0 pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav pools={allPools} />
    </div>
  );
}

-- ============================================================
-- RLS Policies - Comprehensive security for ALL tables
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Returns pool IDs the current user belongs to (approved only)
CREATE OR REPLACE FUNCTION public.get_my_pool_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pool_id FROM public.pool_members
  WHERE user_id = auth.uid() AND is_approved = true;
$$;

-- Check if current user is admin of a specific pool
CREATE OR REPLACE FUNCTION public.is_pool_admin(p_pool_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pool_members
    WHERE pool_id = p_pool_id
      AND user_id = auth.uid()
      AND role = 'admin'
      AND is_approved = true
  );
$$;

-- ============================================================
-- PROFILES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users read co-pool-member profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT pm.user_id FROM public.pool_members pm
      WHERE pm.pool_id IN (SELECT public.get_my_pool_ids())
        AND pm.is_approved = true
    )
  );

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- INSERT handled by trigger, DELETE denied
CREATE POLICY "No direct profile inserts"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No profile deletes"
  ON public.profiles FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- POOLS
-- ============================================================
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their pools"
  ON public.pools FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_my_pool_ids()));

-- Allow reading pool by join_code for joining (anyone authenticated)
CREATE POLICY "Authenticated read pool by code"
  ON public.pools FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated create pools"
  ON public.pools FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admin update pool"
  ON public.pools FOR UPDATE TO authenticated
  USING (public.is_pool_admin(id))
  WITH CHECK (public.is_pool_admin(id));

CREATE POLICY "No pool deletes"
  ON public.pools FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- POOL MEMBERS
-- ============================================================
ALTER TABLE public.pool_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own memberships"
  ON public.pool_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins see pool members"
  ON public.pool_members FOR SELECT TO authenticated
  USING (public.is_pool_admin(pool_id));

CREATE POLICY "Members see approved co-members"
  ON public.pool_members FOR SELECT TO authenticated
  USING (
    pool_id IN (SELECT public.get_my_pool_ids())
    AND is_approved = true
  );

-- INSERT via SECURITY DEFINER functions only
CREATE POLICY "No direct member inserts"
  ON public.pool_members FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE denied entirely (prevents role escalation)
CREATE POLICY "No member updates"
  ON public.pool_members FOR UPDATE TO authenticated
  USING (false);

-- Admin can remove members (except themselves)
CREATE POLICY "Admin remove members"
  ON public.pool_members FOR DELETE TO authenticated
  USING (
    public.is_pool_admin(pool_id)
    AND user_id != auth.uid()
  );

-- ============================================================
-- WEEKS
-- ============================================================
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pool members read weeks"
  ON public.weeks FOR SELECT TO authenticated
  USING (pool_id IN (SELECT public.get_my_pool_ids()));

-- All writes via service_role or SECURITY DEFINER
CREATE POLICY "No user week inserts"
  ON public.weeks FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No user week updates"
  ON public.weeks FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No user week deletes"
  ON public.weeks FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- MLB SERIES (shared, public read)
-- ============================================================
ALTER TABLE public.mlb_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mlb_series"
  ON public.mlb_series FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "No user mlb_series writes"
  ON public.mlb_series FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No user mlb_series updates"
  ON public.mlb_series FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No user mlb_series deletes"
  ON public.mlb_series FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- MLB GAMES (shared, public read)
-- ============================================================
ALTER TABLE public.mlb_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mlb_games"
  ON public.mlb_games FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "No user mlb_games writes"
  ON public.mlb_games FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No user mlb_games updates"
  ON public.mlb_games FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No user mlb_games deletes"
  ON public.mlb_games FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- SERIES (pool-specific)
-- ============================================================
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pool members read series"
  ON public.series FOR SELECT TO authenticated
  USING (
    week_id IN (
      SELECT w.id FROM public.weeks w
      WHERE w.pool_id IN (SELECT public.get_my_pool_ids())
    )
  );

CREATE POLICY "Admin insert series"
  ON public.series FOR INSERT TO authenticated
  WITH CHECK (
    public.is_pool_admin(
      (SELECT pool_id FROM public.weeks WHERE id = week_id)
    )
  );

CREATE POLICY "Admin update series"
  ON public.series FOR UPDATE TO authenticated
  USING (
    public.is_pool_admin(
      (SELECT pool_id FROM public.weeks WHERE id = week_id)
    )
  );

CREATE POLICY "No series deletes"
  ON public.series FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- TICKETS
-- ============================================================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Users always see own tickets
CREATE POLICY "Users see own tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Pool members see all tickets AFTER lock_time (transparency)
CREATE POLICY "Pool members see tickets after lock"
  ON public.tickets FOR SELECT TO authenticated
  USING (
    pool_id IN (SELECT public.get_my_pool_ids())
    AND week_id IN (
      SELECT w.id FROM public.weeks w WHERE w.lock_time <= now()
    )
  );

-- INSERT via SECURITY DEFINER submit_ticket() only
CREATE POLICY "No direct ticket inserts"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (false);

-- No user updates (status managed by service_role)
CREATE POLICY "No ticket updates"
  ON public.tickets FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No ticket deletes"
  ON public.tickets FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- TICKET PICKS
-- ============================================================
ALTER TABLE public.ticket_picks ENABLE ROW LEVEL SECURITY;

-- Visibility mirrors tickets (own always, pool after lock)
CREATE POLICY "Users see own picks"
  ON public.ticket_picks FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT t.id FROM public.tickets t WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Pool members see picks after lock"
  ON public.ticket_picks FOR SELECT TO authenticated
  USING (
    ticket_id IN (
      SELECT t.id FROM public.tickets t
      JOIN public.weeks w ON t.week_id = w.id
      WHERE t.pool_id IN (SELECT public.get_my_pool_ids())
        AND w.lock_time <= now()
    )
  );

-- INSERT via submit_ticket() only
CREATE POLICY "No direct pick inserts"
  ON public.ticket_picks FOR INSERT TO authenticated
  WITH CHECK (false);

-- No updates (prevents tampering)
CREATE POLICY "No pick updates"
  ON public.ticket_picks FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No pick deletes"
  ON public.ticket_picks FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- PAYMENTS
-- ============================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin see pool payments"
  ON public.payments FOR SELECT TO authenticated
  USING (public.is_pool_admin(pool_id));

-- INSERT via SECURITY DEFINER only
CREATE POLICY "No direct payment inserts"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (false);

-- Admin can toggle payment status for their pool
CREATE POLICY "Admin update payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (public.is_pool_admin(pool_id))
  WITH CHECK (public.is_pool_admin(pool_id));

CREATE POLICY "No payment deletes"
  ON public.payments FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- JACKPOT LEDGER (append-only, read-only for users)
-- ============================================================
ALTER TABLE public.jackpot_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pool members read ledger"
  ON public.jackpot_ledger FOR SELECT TO authenticated
  USING (pool_id IN (SELECT public.get_my_pool_ids()));

-- All writes via SECURITY DEFINER functions only
CREATE POLICY "No direct ledger inserts"
  ON public.jackpot_ledger FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "No ledger updates"
  ON public.jackpot_ledger FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No ledger deletes"
  ON public.jackpot_ledger FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pool members read chat"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (pool_id IN (SELECT public.get_my_pool_ids()));

CREATE POLICY "Pool members post chat"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND pool_id IN (SELECT public.get_my_pool_ids())
  );

CREATE POLICY "No chat updates"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No chat deletes"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (false);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- System-created only
CREATE POLICY "No direct notification inserts"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (false);

-- Users can mark own as read
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "No notification deletes"
  ON public.notifications FOR DELETE TO authenticated
  USING (false);

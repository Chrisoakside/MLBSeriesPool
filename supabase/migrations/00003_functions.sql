-- ============================================================
-- SECURITY DEFINER functions for critical operations
-- ============================================================

-- ============================================================
-- GENERATE JOIN CODE (8-char alphanumeric, uppercase)
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- ============================================================
-- CREATE POOL
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_pool(
  p_name TEXT,
  p_entry_fee NUMERIC DEFAULT 25.00,
  p_is_private BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pool_id UUID;
  v_code TEXT;
  v_attempts INT := 0;
BEGIN
  -- Generate unique join code
  LOOP
    v_code := public.generate_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.pools WHERE join_code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Could not generate unique join code';
    END IF;
  END LOOP;

  -- Create pool
  INSERT INTO public.pools (name, join_code, created_by, entry_fee, is_private)
  VALUES (p_name, v_code, auth.uid(), p_entry_fee, p_is_private)
  RETURNING id INTO v_pool_id;

  -- Add creator as admin
  INSERT INTO public.pool_members (pool_id, user_id, role, is_approved)
  VALUES (v_pool_id, auth.uid(), 'admin', true);

  RETURN v_pool_id;
END;
$$;

-- ============================================================
-- JOIN POOL
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_pool(p_join_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pool RECORD;
  v_member_id UUID;
BEGIN
  -- Look up pool (uniform error for security)
  SELECT id, is_private, is_active INTO v_pool
  FROM public.pools
  WHERE join_code = UPPER(p_join_code);

  IF v_pool IS NULL OR NOT v_pool.is_active THEN
    RAISE EXCEPTION 'Invalid code or pool not available';
  END IF;

  -- Check not already a member
  IF EXISTS (
    SELECT 1 FROM public.pool_members
    WHERE pool_id = v_pool.id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member of this pool';
  END IF;

  -- Add member (auto-approved for public, pending for private)
  INSERT INTO public.pool_members (pool_id, user_id, role, is_approved)
  VALUES (v_pool.id, auth.uid(), 'member', NOT v_pool.is_private)
  RETURNING id INTO v_member_id;

  RETURN v_pool.id;
END;
$$;

-- ============================================================
-- SUBMIT TICKET (atomic: validates + inserts ticket + 6 picks)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_ticket(
  p_pool_id UUID,
  p_week_id UUID,
  p_picks JSONB -- array of { "series_id": uuid, "picked_side": "home"|"away" }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket_id UUID;
  v_lock_time TIMESTAMPTZ;
  v_week_status TEXT;
  v_pick JSONB;
  v_pick_count INT;
  v_series_week_id UUID;
BEGIN
  -- 1. Validate user is approved member
  IF NOT EXISTS (
    SELECT 1 FROM public.pool_members
    WHERE pool_id = p_pool_id AND user_id = auth.uid() AND is_approved = true
  ) THEN
    RAISE EXCEPTION 'Not an approved member of this pool';
  END IF;

  -- 2. Validate lock_time not passed
  SELECT lock_time, status INTO v_lock_time, v_week_status
  FROM public.weeks
  WHERE id = p_week_id AND pool_id = p_pool_id;

  IF v_lock_time IS NULL THEN
    RAISE EXCEPTION 'Week not found for this pool';
  END IF;

  IF v_lock_time <= now() THEN
    RAISE EXCEPTION 'Submissions are locked for this week';
  END IF;

  IF v_week_status != 'lines_set' THEN
    RAISE EXCEPTION 'Lines are not yet available for this week';
  END IF;

  -- 3. Validate exactly 6 picks
  v_pick_count := jsonb_array_length(p_picks);
  IF v_pick_count != 6 THEN
    RAISE EXCEPTION 'Exactly 6 picks required, got %', v_pick_count;
  END IF;

  -- 4. Validate all series belong to this week
  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    SELECT week_id INTO v_series_week_id
    FROM public.series
    WHERE id = (v_pick ->> 'series_id')::UUID;

    IF v_series_week_id IS NULL OR v_series_week_id != p_week_id THEN
      RAISE EXCEPTION 'Series % does not belong to week %',
        v_pick ->> 'series_id', p_week_id;
    END IF;

    IF (v_pick ->> 'picked_side') NOT IN ('home', 'away') THEN
      RAISE EXCEPTION 'Invalid picked_side: %', v_pick ->> 'picked_side';
    END IF;
  END LOOP;

  -- 5. Delete existing ticket if editing before lock
  DELETE FROM public.tickets
  WHERE week_id = p_week_id AND user_id = auth.uid() AND pool_id = p_pool_id;

  -- 6. Insert ticket
  INSERT INTO public.tickets (week_id, user_id, pool_id)
  VALUES (p_week_id, auth.uid(), p_pool_id)
  RETURNING id INTO v_ticket_id;

  -- 7. Insert picks (spread_at_pick set by trigger)
  FOR v_pick IN SELECT * FROM jsonb_array_elements(p_picks)
  LOOP
    INSERT INTO public.ticket_picks (ticket_id, series_id, picked_side, spread_at_pick)
    VALUES (
      v_ticket_id,
      (v_pick ->> 'series_id')::UUID,
      v_pick ->> 'picked_side',
      0 -- placeholder, overridden by trigger
    );
  END LOOP;

  RETURN v_ticket_id;
END;
$$;

-- ============================================================
-- SET-BASED TICKET RECOMPUTATION (called by score ingestion)
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_tickets_for_series(
  p_changed_mlb_series_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Step 1: Update pick results for finalized/voided series
  UPDATE public.ticket_picks tp
  SET result = CASE
    WHEN ms.is_void THEN 'void'
    WHEN ms.status NOT IN ('final', 'void') THEN 'pending'
    WHEN (
      CASE WHEN tp.picked_side = 'home'
        THEN ms.total_runs_home - ms.total_runs_away
        ELSE ms.total_runs_away - ms.total_runs_home
      END
    ) + tp.spread_at_pick > 0
    THEN 'win'
    ELSE 'loss'
  END
  FROM public.series s
  JOIN public.mlb_series ms ON s.mlb_series_id = ms.id
  WHERE tp.series_id = s.id
    AND ms.id = ANY(p_changed_mlb_series_ids);

  -- Step 2: Recompute ticket status from picks
  UPDATE public.tickets t
  SET
    correct_picks = sub.wins,
    total_valid_picks = 6 - sub.voids,
    status = CASE
      WHEN sub.losses > 0 AND sub.pending = 0 THEN 'lost'
      WHEN sub.losses > 0 THEN 'losing'
      WHEN sub.wins + sub.voids = 6 AND sub.pending = 0 THEN 'won'
      WHEN sub.wins > 0 AND sub.losses = 0 AND sub.pending > 0 THEN 'winning'
      ELSE 'pending'
    END,
    resolved_at = CASE WHEN sub.pending = 0 THEN now() ELSE NULL END
  FROM (
    SELECT
      tp.ticket_id,
      COUNT(*) FILTER (WHERE tp.result = 'win') AS wins,
      COUNT(*) FILTER (WHERE tp.result = 'loss') AS losses,
      COUNT(*) FILTER (WHERE tp.result = 'void') AS voids,
      COUNT(*) FILTER (WHERE tp.result = 'pending') AS pending
    FROM public.ticket_picks tp
    JOIN public.tickets t2 ON tp.ticket_id = t2.id
    WHERE t2.week_id IN (SELECT id FROM public.weeks WHERE status = 'locked')
    GROUP BY tp.ticket_id
  ) sub
  WHERE t.id = sub.ticket_id;
END;
$$;

-- ============================================================
-- ADMIN: APPROVE MEMBER
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_member(
  p_pool_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_pool_admin(p_pool_id) THEN
    RAISE EXCEPTION 'Only admins can approve members';
  END IF;

  UPDATE public.pool_members
  SET is_approved = true
  WHERE pool_id = p_pool_id AND user_id = p_user_id;
END;
$$;

-- ============================================================
-- ADMIN: CREATE WEEK
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_week(
  p_pool_id UUID,
  p_week_number INT,
  p_label TEXT,
  p_lock_time TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_week_id UUID;
BEGIN
  IF NOT public.is_pool_admin(p_pool_id) THEN
    RAISE EXCEPTION 'Only admins can create weeks';
  END IF;

  INSERT INTO public.weeks (pool_id, week_number, label, lock_time)
  VALUES (p_pool_id, p_week_number, p_label, p_lock_time)
  RETURNING id INTO v_week_id;

  RETURN v_week_id;
END;
$$;

-- ============================================================
-- ADMIN: PUBLISH LINES
-- ============================================================
CREATE OR REPLACE FUNCTION public.publish_lines(p_week_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pool_id UUID;
  v_series_count INT;
BEGIN
  SELECT pool_id INTO v_pool_id FROM public.weeks WHERE id = p_week_id;

  IF NOT public.is_pool_admin(v_pool_id) THEN
    RAISE EXCEPTION 'Only admins can publish lines';
  END IF;

  SELECT COUNT(*) INTO v_series_count FROM public.series WHERE week_id = p_week_id;
  IF v_series_count < 1 THEN
    RAISE EXCEPTION 'No series set for this week';
  END IF;

  UPDATE public.weeks
  SET status = 'lines_set', lines_posted_at = now(), updated_at = now()
  WHERE id = p_week_id;
END;
$$;

-- ============================================================
-- MLB Series Spread Pool App - Core Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  push_token TEXT,
  total_winnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. POOLS
-- ============================================================
CREATE TABLE public.pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  join_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  entry_fee NUMERIC(10,2) NOT NULL DEFAULT 25.00 CHECK (entry_fee >= 0),
  admin_fee_pct NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (admin_fee_pct >= 0 AND admin_fee_pct <= 100),
  is_private BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_pools_join_code ON pools(join_code);

-- ============================================================
-- 3. POOL MEMBERS
-- ============================================================
CREATE TABLE public.pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  is_approved BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pool_id, user_id)
);

CREATE INDEX idx_pool_members_user_pool ON pool_members(user_id, pool_id);
CREATE INDEX idx_pool_members_pool ON pool_members(pool_id);

-- ============================================================
-- 4. WEEKS
-- ============================================================
CREATE TABLE public.weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  week_number INT NOT NULL CHECK (week_number > 0),
  label TEXT NOT NULL,
  lines_posted_at TIMESTAMPTZ,
  lock_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'lines_set', 'locked', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pool_id, week_number)
);

CREATE INDEX idx_weeks_pool_status ON weeks(pool_id, status);

-- ============================================================
-- 5. MLB SERIES (shared across all pools)
-- ============================================================
CREATE TABLE public.mlb_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_year INT NOT NULL,
  series_start_date DATE NOT NULL,
  series_end_date DATE NOT NULL,
  away_team_abbr TEXT NOT NULL,
  home_team_abbr TEXT NOT NULL,
  away_team_name TEXT NOT NULL,
  home_team_name TEXT NOT NULL,
  total_runs_away INT NOT NULL DEFAULT 0,
  total_runs_home INT NOT NULL DEFAULT 0,
  games_completed INT NOT NULL DEFAULT 0,
  total_games_scheduled INT NOT NULL DEFAULT 3,
  is_void BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'final', 'void')),
  mlb_api_series_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. MLB GAMES (shared across all pools)
-- ============================================================
CREATE TABLE public.mlb_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mlb_series_id UUID NOT NULL REFERENCES public.mlb_series(id) ON DELETE CASCADE,
  mlb_game_pk INT NOT NULL UNIQUE,
  game_date DATE NOT NULL,
  game_time TIMESTAMPTZ NOT NULL,
  away_score INT,
  home_score INT,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'warmup', 'in_progress', 'final', 'postponed', 'suspended', 'cancelled')),
  detailed_status TEXT,
  is_doubleheader BOOLEAN NOT NULL DEFAULT false,
  inning INT,
  inning_state TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mlb_games_series_status ON mlb_games(mlb_series_id, status);
CREATE INDEX idx_mlb_games_date ON mlb_games(game_date);
CREATE INDEX idx_mlb_games_status_partial ON mlb_games(status)
  WHERE status IN ('scheduled', 'warmup', 'in_progress');

-- ============================================================
-- 7. SERIES (pool-specific, links to shared mlb_series)
-- ============================================================
CREATE TABLE public.series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  mlb_series_id UUID NOT NULL REFERENCES public.mlb_series(id),
  spread NUMERIC(4,1) NOT NULL,
  favorite TEXT NOT NULL CHECK (favorite IN ('home', 'away')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_half_point_spread CHECK (
    spread != 0 AND (ABS(spread) * 10) % 10 = 5
  )
);

CREATE INDEX idx_series_week ON series(week_id);

-- ============================================================
-- 8. TICKETS
-- ============================================================
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'winning', 'losing', 'won', 'lost')),
  correct_picks INT NOT NULL DEFAULT 0,
  total_valid_picks INT NOT NULL DEFAULT 6,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(week_id, user_id, pool_id)
);

CREATE INDEX idx_tickets_week_pool ON tickets(week_id, pool_id);
CREATE INDEX idx_tickets_week_status ON tickets(week_id, status);
CREATE INDEX idx_tickets_user ON tickets(user_id);

-- ============================================================
-- 9. TICKET PICKS
-- ============================================================
CREATE TABLE public.ticket_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  picked_side TEXT NOT NULL CHECK (picked_side IN ('home', 'away')),
  spread_at_pick NUMERIC(4,1) NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending'
    CHECK (result IN ('win', 'loss', 'void', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, series_id)
);

CREATE INDEX idx_ticket_picks_ticket_series ON ticket_picks(ticket_id, series_id);
CREATE INDEX idx_ticket_picks_series ON ticket_picks(series_id);

-- ============================================================
-- 10. PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  marked_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pool_id, week_id, user_id)
);

-- ============================================================
-- 11. JACKPOT LEDGER (append-only)
-- ============================================================
CREATE TABLE public.jackpot_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  week_id UUID REFERENCES public.weeks(id),
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('entry_fee', 'payout', 'rollover', 'adjustment', 'rake')),
  amount NUMERIC(12,2) NOT NULL,
  running_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jackpot_pool_time ON jackpot_ledger(pool_id, created_at DESC);

-- Running balance trigger
CREATE OR REPLACE FUNCTION public.update_running_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.running_balance := COALESCE(
    (SELECT running_balance FROM public.jackpot_ledger
     WHERE pool_id = NEW.pool_id
     ORDER BY created_at DESC LIMIT 1),
    0
  ) + NEW.amount;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_jackpot_running_balance
  BEFORE INSERT ON public.jackpot_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_running_balance();

-- ============================================================
-- 12. CHAT MESSAGES
-- ============================================================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES public.pools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_id UUID REFERENCES public.weeks(id),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_pool_time ON chat_messages(pool_id, created_at DESC);

-- ============================================================
-- 13. NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID REFERENCES public.pools(id),
  user_id UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL
    CHECK (type IN ('lines_posted', 'lock_reminder', 'winner', 'general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- ============================================================
-- SPREAD SNAPSHOT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.snapshot_spread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT s.spread INTO NEW.spread_at_pick
  FROM public.series s
  WHERE s.id = NEW.series_id;

  IF NEW.spread_at_pick IS NULL THEN
    RAISE EXCEPTION 'Series not found: %', NEW.series_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_snapshot_spread
  BEFORE INSERT ON public.ticket_picks
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_spread();

-- ============================================================
-- AUTOVACUUM TUNING for hot tables
-- ============================================================
ALTER TABLE mlb_games SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE mlb_series SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE tickets SET (autovacuum_vacuum_scale_factor = 0.01);
ALTER TABLE ticket_picks SET (autovacuum_vacuum_scale_factor = 0.01);

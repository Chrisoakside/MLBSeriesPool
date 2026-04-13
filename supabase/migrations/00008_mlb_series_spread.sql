-- Store the DraftKings opening spread on mlb_series so admins can see it
-- when setting their pool's lines. They can override it in the UI.
ALTER TABLE public.mlb_series
  ADD COLUMN IF NOT EXISTS dk_spread NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS dk_favorite TEXT CHECK (dk_favorite IN ('home', 'away'));

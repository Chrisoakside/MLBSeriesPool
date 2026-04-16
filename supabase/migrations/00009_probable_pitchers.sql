-- Add probable pitcher columns to mlb_games
ALTER TABLE public.mlb_games
  ADD COLUMN IF NOT EXISTS away_probable_pitcher TEXT,
  ADD COLUMN IF NOT EXISTS home_probable_pitcher TEXT;

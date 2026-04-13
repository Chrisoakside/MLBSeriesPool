-- ============================================================
-- Realtime Configuration
-- Only enable on low-cardinality tables
-- ============================================================

-- Shared MLB data (changes broadcast by Edge Function via Broadcast channels)
ALTER PUBLICATION supabase_realtime ADD TABLE mlb_games;
ALTER PUBLICATION supabase_realtime ADD TABLE mlb_series;

-- Chat messages (human-typed, low volume)
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- NOTE: tickets and ticket_picks are NOT in Realtime
-- Score updates are delivered via Supabase Broadcast channels
-- to avoid overwhelming Realtime at scale

-- Enable Realtime on specific tables only
-- Per architecture plan: mlb_games, mlb_series, chat_messages only
-- Tickets/picks use Broadcast channel instead (avoids fan-out at scale)

-- Add tables to supabase_realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mlb_games'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mlb_games;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mlb_series'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mlb_series;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;
END $$;

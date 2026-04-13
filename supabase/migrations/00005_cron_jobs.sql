-- Enable pg_cron and pg_net extensions (if not already enabled)
-- These are enabled via the Supabase dashboard, not migrations,
-- but we document the setup here for reference.
-- Extensions: pg_cron, pg_net

-- pg_cron jobs for adaptive score ingestion
-- Jobs call the Edge Function via pg_net HTTP request
-- The INGEST_SECRET is stored in vault.secrets

-- Helper function to call the ingest-scores edge function
CREATE OR REPLACE FUNCTION call_ingest_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url text;
  ingest_secret text;
BEGIN
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url';

  SELECT decrypted_secret INTO ingest_secret
  FROM vault.decrypted_secrets
  WHERE name = 'ingest_secret';

  PERFORM net.http_post(
    url := project_url || '/functions/v1/ingest-scores',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-secret', ingest_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Helper function to call the resolve-week edge function
CREATE OR REPLACE FUNCTION call_resolve_week()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  project_url text;
  ingest_secret text;
BEGIN
  SELECT decrypted_secret INTO project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url';

  SELECT decrypted_secret INTO ingest_secret
  FROM vault.decrypted_secrets
  WHERE name = 'ingest_secret';

  PERFORM net.http_post(
    url := project_url || '/functions/v1/resolve-week',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ingest-secret', ingest_secret
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule: every 2 minutes during game hours (Fri 6pm - Sun 11:59pm ET, i.e. 23:00-04:59 UTC)
-- We use a broad schedule and let the edge function decide if there's work to do
SELECT cron.schedule(
  'ingest-scores-frequent',
  '*/2 * * * *',  -- every 2 minutes
  'SELECT call_ingest_scores()'
);

-- Schedule: resolve week check every 10 minutes
SELECT cron.schedule(
  'resolve-week',
  '*/10 * * * *',
  'SELECT call_resolve_week()'
);

-- Note: For production, consider narrowing the schedule to game days/hours:
-- Fri-Sun: '*/2 22-23,0-4 * * 5,6,0' (UTC, covers 6pm-midnight ET)
-- But a simple every-2-min with early-exit logic in the Edge Function is simpler.

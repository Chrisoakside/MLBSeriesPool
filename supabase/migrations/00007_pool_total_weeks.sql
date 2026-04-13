-- Add total_weeks to pools so commissioners can set the season length
ALTER TABLE public.pools
  ADD COLUMN IF NOT EXISTS total_weeks INT NOT NULL DEFAULT 0;

-- Update create_pool RPC to accept the new parameter
CREATE OR REPLACE FUNCTION public.create_pool(
  p_name TEXT,
  p_entry_fee NUMERIC DEFAULT 25.00,
  p_is_private BOOLEAN DEFAULT false,
  p_total_weeks INT DEFAULT 0
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
  INSERT INTO public.pools (name, join_code, created_by, entry_fee, is_private, total_weeks)
  VALUES (p_name, v_code, auth.uid(), p_entry_fee, p_is_private, p_total_weeks)
  RETURNING id INTO v_pool_id;

  -- Add creator as admin
  INSERT INTO public.pool_members (pool_id, user_id, role, is_approved)
  VALUES (v_pool_id, auth.uid(), 'admin', true);

  RETURN v_pool_id;
END;
$$;

-- Allow all authenticated users to read KPI targets (including bankrot-helper metrics)
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kpi_targets'
      AND policyname = 'Allow authenticated read kpi_targets'
  ) THEN
    CREATE POLICY "Allow authenticated read kpi_targets"
    ON public.kpi_targets
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;
-- Create table for KPI targets
CREATE TABLE public.kpi_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company TEXT NOT NULL DEFAULT 'Спасение',
  kpi_name TEXT NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 0,
  month DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company, kpi_name, month)
);

-- Enable RLS
ALTER TABLE public.kpi_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all kpi targets"
ON public.kpi_targets
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert kpi targets"
ON public.kpi_targets
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all kpi targets"
ON public.kpi_targets
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all kpi targets"
ON public.kpi_targets
FOR DELETE
USING (auth.role() = 'authenticated');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_kpi_targets_updated_at
BEFORE UPDATE ON public.kpi_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create table for manual balance adjustments per company
CREATE TABLE IF NOT EXISTS public.company_balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company text NOT NULL,
  adjusted_balance numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company)
);

-- Enable RLS
ALTER TABLE public.company_balance_adjustments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view all balance adjustments"
  ON public.company_balance_adjustments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert balance adjustments"
  ON public.company_balance_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all balance adjustments"
  ON public.company_balance_adjustments
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete all balance adjustments"
  ON public.company_balance_adjustments
  FOR DELETE
  TO authenticated
  USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_company_balance_adjustments_updated_at
  BEFORE UPDATE ON public.company_balance_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
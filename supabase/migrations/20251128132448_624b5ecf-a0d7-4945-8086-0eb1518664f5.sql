-- Create table for department bonus budget
CREATE TABLE IF NOT EXISTS public.department_bonus_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  total_budget NUMERIC NOT NULL DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(department_id, month)
);

-- Add RLS policies
ALTER TABLE public.department_bonus_budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all bonus budgets"
  ON public.department_bonus_budget
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert bonus budgets"
  ON public.department_bonus_budget
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all bonus budgets"
  ON public.department_bonus_budget
  FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete all bonus budgets"
  ON public.department_bonus_budget
  FOR DELETE
  USING (true);

-- Add trigger to update updated_at
CREATE TRIGGER update_department_bonus_budget_updated_at
  BEFORE UPDATE ON public.department_bonus_budget
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_department_bonus_budget_month ON public.department_bonus_budget(month);
CREATE INDEX idx_department_bonus_budget_department_id ON public.department_bonus_budget(department_id);

COMMENT ON TABLE public.department_bonus_budget IS 'Stores the total bonus budget for each department by month';
COMMENT ON COLUMN public.department_bonus_budget.total_budget IS 'Total budget allocated for department bonuses in rubles';
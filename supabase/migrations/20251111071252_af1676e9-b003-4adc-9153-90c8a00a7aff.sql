-- Create sales table for tracking sales department performance
CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  payment_amount NUMERIC NOT NULL DEFAULT 0,
  contract_amount NUMERIC NOT NULL DEFAULT 0,
  city TEXT NOT NULL,
  lead_source TEXT NOT NULL,
  manager_bonus NUMERIC NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Create policies for sales table
CREATE POLICY "Authenticated users can view all sales"
ON public.sales
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert sales"
ON public.sales
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all sales"
ON public.sales
FOR UPDATE
USING (true);

CREATE POLICY "Authenticated users can delete all sales"
ON public.sales
FOR DELETE
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
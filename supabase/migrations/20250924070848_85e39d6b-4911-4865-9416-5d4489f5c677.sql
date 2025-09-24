-- Create a table for lead generation data
CREATE TABLE public.lead_generation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company TEXT NOT NULL DEFAULT 'Спасение',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_leads INTEGER NOT NULL DEFAULT 0,
  qualified_leads INTEGER NOT NULL DEFAULT 0,
  debt_above_300k INTEGER NOT NULL DEFAULT 0,
  contracts INTEGER NOT NULL DEFAULT 0,
  payments INTEGER NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.lead_generation ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own lead generation data" 
ON public.lead_generation 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own lead generation data" 
ON public.lead_generation 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lead generation data" 
ON public.lead_generation 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lead generation data" 
ON public.lead_generation 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_lead_generation_updated_at
BEFORE UPDATE ON public.lead_generation
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
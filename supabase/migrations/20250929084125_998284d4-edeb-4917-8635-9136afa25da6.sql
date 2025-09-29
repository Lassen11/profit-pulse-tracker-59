-- Update RLS policies for transactions table to allow all authenticated users access to all data
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON public.transactions;

-- Create new policies for transactions allowing all authenticated users to access all data
CREATE POLICY "Authenticated users can view all transactions" 
ON public.transactions 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create transactions" 
ON public.transactions 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all transactions" 
ON public.transactions 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all transactions" 
ON public.transactions 
FOR DELETE 
TO authenticated
USING (true);

-- Update RLS policies for lead_generation table
DROP POLICY IF EXISTS "Users can view their own lead generation data" ON public.lead_generation;
DROP POLICY IF EXISTS "Users can create their own lead generation data" ON public.lead_generation;
DROP POLICY IF EXISTS "Users can update their own lead generation data" ON public.lead_generation;
DROP POLICY IF EXISTS "Users can delete their own lead generation data" ON public.lead_generation;

-- Create new policies for lead_generation allowing all authenticated users to access all data
CREATE POLICY "Authenticated users can view all lead generation data" 
ON public.lead_generation 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create lead generation data" 
ON public.lead_generation 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all lead generation data" 
ON public.lead_generation 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all lead generation data" 
ON public.lead_generation 
FOR DELETE 
TO authenticated
USING (true);
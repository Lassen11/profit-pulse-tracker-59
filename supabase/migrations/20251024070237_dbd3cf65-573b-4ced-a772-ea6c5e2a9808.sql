-- Add organization_name column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN organization_name text;
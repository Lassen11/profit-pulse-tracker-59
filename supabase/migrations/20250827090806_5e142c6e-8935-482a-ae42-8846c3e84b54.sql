-- Add client_name field to transactions table for income operations
ALTER TABLE public.transactions 
ADD COLUMN client_name TEXT;
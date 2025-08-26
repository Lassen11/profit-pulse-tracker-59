-- Add subcategory column to transactions table
ALTER TABLE public.transactions 
ADD COLUMN subcategory TEXT;
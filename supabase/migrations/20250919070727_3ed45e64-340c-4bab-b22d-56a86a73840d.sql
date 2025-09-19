-- Add account fields to transactions table
ALTER TABLE public.transactions 
ADD COLUMN income_account text,
ADD COLUMN expense_account text;
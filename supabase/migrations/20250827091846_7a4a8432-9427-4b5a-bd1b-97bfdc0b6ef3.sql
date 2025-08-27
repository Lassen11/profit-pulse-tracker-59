-- Add installment fields to transactions table for installment sales
ALTER TABLE public.transactions 
ADD COLUMN contract_amount NUMERIC,
ADD COLUMN first_payment NUMERIC,
ADD COLUMN installment_period INTEGER;
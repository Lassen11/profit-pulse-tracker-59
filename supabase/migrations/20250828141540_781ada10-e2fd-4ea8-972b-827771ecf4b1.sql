-- Add lump_sum column to transactions table for единовременный платеж (ЕП)
ALTER TABLE public.transactions 
ADD COLUMN lump_sum numeric DEFAULT NULL;
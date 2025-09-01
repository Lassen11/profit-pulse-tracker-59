-- Add company field to transactions table
ALTER TABLE public.transactions 
ADD COLUMN company TEXT NOT NULL DEFAULT 'Спасение';

-- Add index for better performance when filtering by company
CREATE INDEX idx_transactions_company ON public.transactions(company);

-- Update existing transactions to have default company
UPDATE public.transactions 
SET company = 'Спасение' 
WHERE company IS NULL;
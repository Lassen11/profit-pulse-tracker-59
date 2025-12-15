-- Add company column to sales table to track which project the sale belongs to
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS company text NOT NULL DEFAULT 'Дело Бизнеса';

-- Update existing sales to have company = 'Дело Бизнеса' (since they were all created for that project)
UPDATE public.sales SET company = 'Дело Бизнеса' WHERE company IS NULL OR company = '';
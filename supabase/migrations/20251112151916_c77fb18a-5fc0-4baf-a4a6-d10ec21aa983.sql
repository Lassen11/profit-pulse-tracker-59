-- Add new columns to transactions table for client details from bankrot-helper
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS manager text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS lead_source text,
ADD COLUMN IF NOT EXISTS payment_day integer,
ADD COLUMN IF NOT EXISTS contract_date date;

-- Add comments for documentation
COMMENT ON COLUMN public.transactions.manager IS 'Менеджер, работающий с клиентом';
COMMENT ON COLUMN public.transactions.city IS 'Город клиента';
COMMENT ON COLUMN public.transactions.lead_source IS 'Источник лида (Авито, Сайт, Квиз и т.д.)';
COMMENT ON COLUMN public.transactions.payment_day IS 'День ежемесячного платежа';
COMMENT ON COLUMN public.transactions.contract_date IS 'Дата заключения договора';
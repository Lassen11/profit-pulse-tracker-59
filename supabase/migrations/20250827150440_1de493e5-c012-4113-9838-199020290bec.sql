-- Remove duplicate RLS policy
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.transactions;

-- Add performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_date ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_type ON public.transactions (user_id, type);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_created_at ON public.transactions (user_id, created_at DESC);

-- Optimize the table for better performance
ANALYZE public.transactions;
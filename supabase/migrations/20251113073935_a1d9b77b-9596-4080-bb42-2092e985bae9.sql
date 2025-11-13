-- Создаем таблицу для клиентов из bankrot-helper
CREATE TABLE IF NOT EXISTS public.bankrot_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  contract_amount NUMERIC NOT NULL,
  installment_period INTEGER NOT NULL,
  first_payment NUMERIC NOT NULL,
  monthly_payment NUMERIC NOT NULL,
  remaining_amount NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  deposit_paid NUMERIC DEFAULT 0,
  deposit_target NUMERIC DEFAULT 70000,
  payment_day INTEGER DEFAULT 1,
  employee_id UUID,
  contract_date DATE DEFAULT CURRENT_DATE,
  city TEXT,
  source TEXT,
  manager TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Включаем RLS
ALTER TABLE public.bankrot_clients ENABLE ROW LEVEL SECURITY;

-- Создаем политики доступа
CREATE POLICY "Authenticated users can view all clients"
ON public.bankrot_clients
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create clients"
ON public.bankrot_clients
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all clients"
ON public.bankrot_clients
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete all clients"
ON public.bankrot_clients
FOR DELETE
TO authenticated
USING (true);

-- Создаем индексы для оптимизации
CREATE INDEX idx_bankrot_clients_employee_id ON public.bankrot_clients(employee_id);
CREATE INDEX idx_bankrot_clients_created_at ON public.bankrot_clients(created_at DESC);
CREATE INDEX idx_bankrot_clients_user_id ON public.bankrot_clients(user_id);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_bankrot_clients_updated_at
BEFORE UPDATE ON public.bankrot_clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
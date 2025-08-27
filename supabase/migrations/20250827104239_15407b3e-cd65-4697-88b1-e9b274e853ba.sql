-- Добавляем колонку для статуса договора
ALTER TABLE public.transactions 
ADD COLUMN contract_status text DEFAULT 'active' CHECK (contract_status IN ('active', 'terminated'));

-- Добавляем дату расторжения договора
ALTER TABLE public.transactions 
ADD COLUMN termination_date date;

-- Создаем индекс для быстрого поиска по статусу
CREATE INDEX idx_transactions_contract_status ON public.transactions(contract_status);
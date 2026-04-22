-- business_clients table
CREATE TABLE public.business_clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL,
  inn text NULL,
  contact text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.business_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all business clients"
  ON public.business_clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create business clients"
  ON public.business_clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update all business clients"
  ON public.business_clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete all business clients"
  ON public.business_clients FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_business_clients_updated_at
  BEFORE UPDATE ON public.business_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- business_client_payments table
CREATE TABLE public.business_client_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.business_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  service text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  is_paid boolean NOT NULL DEFAULT false,
  paid_account text NULL,
  paid_at date NULL,
  transaction_id uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.business_client_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all business client payments"
  ON public.business_client_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create business client payments"
  ON public.business_client_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update all business client payments"
  ON public.business_client_payments FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete all business client payments"
  ON public.business_client_payments FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_business_client_payments_updated_at
  BEFORE UPDATE ON public.business_client_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_client_payments_client_id ON public.business_client_payments(client_id);
CREATE INDEX idx_business_client_payments_payment_date ON public.business_client_payments(payment_date);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_clients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.business_client_payments;
ALTER TABLE public.business_clients REPLICA IDENTITY FULL;
ALTER TABLE public.business_client_payments REPLICA IDENTITY FULL;
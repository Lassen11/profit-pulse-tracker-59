-- business_clients: открыть доступ всем авторизованным
DROP POLICY IF EXISTS "Users can view their own business clients" ON public.business_clients;
DROP POLICY IF EXISTS "Users can create their own business clients" ON public.business_clients;
DROP POLICY IF EXISTS "Users can update their own business clients" ON public.business_clients;
DROP POLICY IF EXISTS "Users can delete their own business clients" ON public.business_clients;

CREATE POLICY "Authenticated users can view all business clients"
  ON public.business_clients FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create business clients"
  ON public.business_clients FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all business clients"
  ON public.business_clients FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete all business clients"
  ON public.business_clients FOR DELETE
  TO authenticated
  USING (true);

-- business_client_payments: открыть доступ всем авторизованным
DROP POLICY IF EXISTS "Users can view their own business client payments" ON public.business_client_payments;
DROP POLICY IF EXISTS "Users can create their own business client payments" ON public.business_client_payments;
DROP POLICY IF EXISTS "Users can update their own business client payments" ON public.business_client_payments;
DROP POLICY IF EXISTS "Users can delete their own business client payments" ON public.business_client_payments;

CREATE POLICY "Authenticated users can view all business client payments"
  ON public.business_client_payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create business client payments"
  ON public.business_client_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all business client payments"
  ON public.business_client_payments FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete all business client payments"
  ON public.business_client_payments FOR DELETE
  TO authenticated
  USING (true);
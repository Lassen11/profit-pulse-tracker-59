-- business_clients: tighten RLS to owner only
DROP POLICY IF EXISTS "Authenticated users can view all business clients" ON public.business_clients;
DROP POLICY IF EXISTS "Authenticated users can create business clients" ON public.business_clients;
DROP POLICY IF EXISTS "Authenticated users can update all business clients" ON public.business_clients;
DROP POLICY IF EXISTS "Authenticated users can delete all business clients" ON public.business_clients;

CREATE POLICY "Users can view their own business clients"
  ON public.business_clients FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own business clients"
  ON public.business_clients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own business clients"
  ON public.business_clients FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own business clients"
  ON public.business_clients FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- business_client_payments: tighten RLS to owner only
DROP POLICY IF EXISTS "Authenticated users can view all business client payments" ON public.business_client_payments;
DROP POLICY IF EXISTS "Authenticated users can create business client payments" ON public.business_client_payments;
DROP POLICY IF EXISTS "Authenticated users can update all business client payments" ON public.business_client_payments;
DROP POLICY IF EXISTS "Authenticated users can delete all business client payments" ON public.business_client_payments;

CREATE POLICY "Users can view their own business client payments"
  ON public.business_client_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own business client payments"
  ON public.business_client_payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own business client payments"
  ON public.business_client_payments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own business client payments"
  ON public.business_client_payments FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
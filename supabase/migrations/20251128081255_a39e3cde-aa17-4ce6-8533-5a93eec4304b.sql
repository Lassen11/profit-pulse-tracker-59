-- Fix search_path for new functions using CREATE OR REPLACE
CREATE OR REPLACE FUNCTION set_department_employee_month()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.month IS NULL THEN
    NEW.month := date_trunc('month', CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_payroll_payment_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.month IS NULL THEN
    NEW.month := date_trunc('month', NEW.payment_date);
  END IF;
  RETURN NEW;
END;
$$;
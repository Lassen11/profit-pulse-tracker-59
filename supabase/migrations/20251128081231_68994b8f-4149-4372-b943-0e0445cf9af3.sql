-- Add month field to department_employees table without default
ALTER TABLE department_employees 
ADD COLUMN month DATE;

-- Set current month for all existing records
UPDATE department_employees 
SET month = date_trunc('month', CURRENT_DATE);

-- Now make it NOT NULL after setting values
ALTER TABLE department_employees 
ALTER COLUMN month SET NOT NULL;

-- Create index for better performance on month filtering
CREATE INDEX idx_department_employees_month ON department_employees(month);

-- Create index for department_id and month combination
CREATE INDEX idx_department_employees_dept_month ON department_employees(department_id, month);

-- Create trigger function to set month automatically
CREATE OR REPLACE FUNCTION set_department_employee_month()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.month IS NULL THEN
    NEW.month := date_trunc('month', CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER set_month_before_insert
  BEFORE INSERT ON department_employees
  FOR EACH ROW
  EXECUTE FUNCTION set_department_employee_month();

-- Add month field to payroll_payments
ALTER TABLE payroll_payments 
ADD COLUMN month DATE;

-- Set month from payment_date for existing records
UPDATE payroll_payments 
SET month = date_trunc('month', payment_date);

-- Make it NOT NULL
ALTER TABLE payroll_payments 
ALTER COLUMN month SET NOT NULL;

-- Create trigger function for payroll_payments
CREATE OR REPLACE FUNCTION set_payroll_payment_month()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.month IS NULL THEN
    NEW.month := date_trunc('month', NEW.payment_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payroll_payments
CREATE TRIGGER set_month_before_insert_payment
  BEFORE INSERT ON payroll_payments
  FOR EACH ROW
  EXECUTE FUNCTION set_payroll_payment_month();
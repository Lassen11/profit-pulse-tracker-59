-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  project_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Enable RLS on departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Create policies for departments
CREATE POLICY "Authenticated users can view all departments" 
ON public.departments 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create departments" 
ON public.departments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all departments" 
ON public.departments 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete all departments" 
ON public.departments 
FOR DELETE 
USING (true);

-- Create department_employees table (links employees to departments with salary info)
CREATE TABLE public.department_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  white_salary NUMERIC DEFAULT 0,
  gray_salary NUMERIC DEFAULT 0,
  advance NUMERIC DEFAULT 0,
  ndfl NUMERIC DEFAULT 0,
  contributions NUMERIC DEFAULT 0,
  bonus NUMERIC DEFAULT 0,
  next_month_bonus NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  net_salary NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  UNIQUE(department_id, employee_id)
);

-- Enable RLS on department_employees
ALTER TABLE public.department_employees ENABLE ROW LEVEL SECURITY;

-- Create policies for department_employees
CREATE POLICY "Authenticated users can view all department employees" 
ON public.department_employees 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create department employees" 
ON public.department_employees 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all department employees" 
ON public.department_employees 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete all department employees" 
ON public.department_employees 
FOR DELETE 
USING (true);

-- Create payroll_payments table (tracks salary payments)
CREATE TABLE public.payroll_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_employee_id UUID NOT NULL REFERENCES public.department_employees(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL,
  payment_type TEXT NOT NULL, -- 'white', 'gray', 'advance', 'bonus', etc.
  notes TEXT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL
);

-- Enable RLS on payroll_payments
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for payroll_payments
CREATE POLICY "Authenticated users can view all payroll payments" 
ON public.payroll_payments 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create payroll payments" 
ON public.payroll_payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update all payroll payments" 
ON public.payroll_payments 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete all payroll payments" 
ON public.payroll_payments 
FOR DELETE 
USING (true);

-- Create trigger for departments updated_at
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for department_employees updated_at
CREATE TRIGGER update_department_employees_updated_at
BEFORE UPDATE ON public.department_employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
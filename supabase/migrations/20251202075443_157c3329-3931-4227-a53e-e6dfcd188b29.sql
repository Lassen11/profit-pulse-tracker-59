-- Drop existing unique constraint that doesn't include month
ALTER TABLE public.department_employees 
DROP CONSTRAINT department_employees_department_id_employee_id_key;

-- Create new unique constraint that includes month
ALTER TABLE public.department_employees 
ADD CONSTRAINT department_employees_department_id_employee_id_month_key 
UNIQUE (department_id, employee_id, month);
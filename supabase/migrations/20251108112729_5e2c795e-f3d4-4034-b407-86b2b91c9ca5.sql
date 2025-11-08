-- Add company column to department_employees table
ALTER TABLE public.department_employees
ADD COLUMN company text NOT NULL DEFAULT 'Спасение';

-- Add comment to explain the column
COMMENT ON COLUMN public.department_employees.company IS 'Company/project that the employee belongs to for this department';
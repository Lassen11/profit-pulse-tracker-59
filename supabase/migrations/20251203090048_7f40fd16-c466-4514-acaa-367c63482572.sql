
-- Fix net_salary for all department_employees records
-- Formula: (white_salary - ndfl + gray_salary) - sum of net_salary payments - advance
WITH payment_totals AS (
  SELECT 
    department_employee_id,
    SUM(CASE WHEN payment_type = 'net_salary' THEN amount ELSE 0 END) as net_salary_payments
  FROM payroll_payments
  GROUP BY department_employee_id
)
UPDATE department_employees de
SET net_salary = (
  COALESCE(de.white_salary, 0) - COALESCE(de.ndfl, 0) + COALESCE(de.gray_salary, 0) 
  - COALESCE(de.advance, 0)
  - COALESCE(pt.net_salary_payments, 0)
)
FROM payment_totals pt
WHERE de.id = pt.department_employee_id;

-- Also fix records without any payments (reset to calculated value)
UPDATE department_employees de
SET net_salary = (
  COALESCE(de.white_salary, 0) - COALESCE(de.ndfl, 0) + COALESCE(de.gray_salary, 0) 
  - COALESCE(de.advance, 0)
)
WHERE de.id NOT IN (SELECT DISTINCT department_employee_id FROM payroll_payments);

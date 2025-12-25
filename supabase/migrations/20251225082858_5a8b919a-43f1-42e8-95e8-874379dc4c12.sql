-- Reset the AU department bonus budget for December 2025 since no transactions have au_department_bonus saved
UPDATE department_bonus_budget 
SET total_budget = 0, updated_at = now()
WHERE department_id = '3ebfc615-572d-40fd-a3d0-34f62252c28b' 
AND month = '2025-12-01';
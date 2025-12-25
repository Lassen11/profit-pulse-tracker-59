-- Add column to store legal department bonus in transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS legal_department_bonus numeric DEFAULT NULL;

-- Reset the Legal Department bonus budget for December 2025 since no transactions have legal_department_bonus saved
UPDATE department_bonus_budget 
SET total_budget = 0, updated_at = now()
WHERE department_id = 'be686883-1a38-4335-86b4-7699ad317ac0' 
AND month = '2025-12-01';
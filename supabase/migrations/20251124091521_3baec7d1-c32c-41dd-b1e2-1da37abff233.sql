-- Update account name from "Касса офис Диана" to "Касса офис"
UPDATE transactions 
SET income_account = 'Касса офис' 
WHERE income_account = 'Касса офис Диана';

UPDATE transactions 
SET expense_account = 'Касса офис' 
WHERE expense_account = 'Касса офис Диана';
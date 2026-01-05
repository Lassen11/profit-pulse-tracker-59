-- Update December 2025 completed cases data to match bankrot-helper values (8 / 95694.44)
UPDATE kpi_targets 
SET target_value = 8, updated_at = NOW() 
WHERE company = 'Спасение' 
  AND kpi_name = 'completed_cases_count' 
  AND month = '2025-12-30';

UPDATE kpi_targets 
SET target_value = 95694.44, updated_at = NOW() 
WHERE company = 'Спасение' 
  AND kpi_name = 'completed_cases_monthly_payment_sum' 
  AND month = '2025-12-30';
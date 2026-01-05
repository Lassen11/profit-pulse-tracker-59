-- Update December 2025 data to match bankrot-helper values (18 / 241777.78)
UPDATE kpi_targets 
SET target_value = 18, updated_at = NOW() 
WHERE company = 'Спасение' 
  AND kpi_name = 'new_clients_count' 
  AND month = '2025-12-30';

UPDATE kpi_targets 
SET target_value = 241777.78, updated_at = NOW() 
WHERE company = 'Спасение' 
  AND kpi_name = 'new_clients_monthly_payment_sum' 
  AND month = '2025-12-30';
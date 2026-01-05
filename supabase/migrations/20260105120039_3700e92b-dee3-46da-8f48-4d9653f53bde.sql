-- Reset January 2026 KPI data to 0 (matching bankrot-helper)
UPDATE kpi_targets 
SET target_value = 0, updated_at = NOW() 
WHERE company = 'Спасение' 
  AND kpi_name IN ('new_clients_count', 'new_clients_monthly_payment_sum', 'completed_cases_count', 'completed_cases_monthly_payment_sum') 
  AND month >= '2026-01-01' AND month < '2026-02-01';
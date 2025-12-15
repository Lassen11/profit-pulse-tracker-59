-- Delete duplicate bankrot_clients, keeping only the record with the most data or most recent
DELETE FROM bankrot_clients
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY full_name, contract_date 
        ORDER BY 
          (CASE WHEN source IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN city IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN manager IS NOT NULL THEN 1 ELSE 0 END +
           CASE WHEN installment_period > 0 THEN 1 ELSE 0 END +
           CASE WHEN monthly_payment > 0 THEN 1 ELSE 0 END) DESC,
          created_at DESC
      ) as rn
    FROM bankrot_clients
  ) ranked
  WHERE rn > 1
)
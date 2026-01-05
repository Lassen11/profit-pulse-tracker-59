-- Normalize kpi_targets.month to always be the last day of its month.
-- If normalization would create duplicates (same user_id+company+kpi_name+month), keep the latest updated row and delete the rest.

WITH norm AS (
  SELECT
    id,
    user_id,
    company,
    kpi_name,
    month,
    (date_trunc('month', month) + interval '1 month - 1 day')::date AS norm_month,
    updated_at
  FROM public.kpi_targets
), ranked AS (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY user_id, company, kpi_name, norm_month
        ORDER BY updated_at DESC, id
      ) AS rn
    FROM norm
  ) t
  WHERE rn > 1
)
DELETE FROM public.kpi_targets
WHERE id IN (SELECT id FROM ranked);

UPDATE public.kpi_targets
SET month = (date_trunc('month', month) + interval '1 month - 1 day')::date
WHERE month <> (date_trunc('month', month) + interval '1 month - 1 day')::date;
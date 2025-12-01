-- Убираем лишние пробелы из названий отделов
UPDATE departments 
SET name = TRIM(name)
WHERE name != TRIM(name);
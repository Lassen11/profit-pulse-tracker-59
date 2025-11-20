import { useEffect, useCallback } from 'react';

interface UseFormPersistenceOptions<T> {
  key: string;
  values: T;
  enabled: boolean;
}

export function useFormPersistence<T extends Record<string, any>>({
  key,
  values,
  enabled
}: UseFormPersistenceOptions<T>) {
  // Сохранение в localStorage при изменении значений
  useEffect(() => {
    if (enabled && Object.keys(values).length > 0) {
      const hasValues = Object.values(values).some(val => {
        if (typeof val === 'string') return val.length > 0;
        if (val instanceof Date) return true;
        return val !== null && val !== undefined && val !== '';
      });
      
      if (hasValues) {
        try {
          localStorage.setItem(key, JSON.stringify(values));
        } catch (error) {
          console.error('Error saving form values:', error);
        }
      }
    }
  }, [key, values, enabled]);

  // Восстановление из localStorage
  const restoreValues = useCallback((): T | null => {
    if (!enabled) return null;
    
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Восстанавливаем даты
        Object.keys(parsed).forEach(k => {
          if (parsed[k] && typeof parsed[k] === 'string' && /^\d{4}-\d{2}-\d{2}/.test(parsed[k])) {
            try {
              parsed[k] = new Date(parsed[k]);
            } catch (e) {
              // Оставляем как есть если не получилось преобразовать
            }
          }
        });
        return parsed;
      }
    } catch (error) {
      console.error('Error restoring form values:', error);
    }
    return null;
  }, [key, enabled]);

  // Очистка localStorage
  const clearStoredValues = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing form values:', error);
    }
  }, [key]);

  return {
    restoreValues,
    clearStoredValues
  };
}

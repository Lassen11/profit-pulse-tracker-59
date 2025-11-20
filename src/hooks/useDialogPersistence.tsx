import { useEffect, useCallback } from 'react';

interface DialogPersistenceOptions<T = any> {
  key: string;
  data?: T;
  enabled?: boolean;
}

interface DialogPersistenceReturn<T = any> {
  restoreState: () => T | null;
  clearState: () => void;
  saveState: (data: T) => void;
}

/**
 * Hook for persisting dialog state across page reloads and tab switches
 * 
 * @param key - Unique key for localStorage
 * @param data - Data to persist (optional)
 * @param enabled - Whether persistence is enabled (default: true)
 * 
 * @example
 * const { restoreState, clearState, saveState } = useDialogPersistence({
 *   key: 'my-dialog',
 *   data: { employeeId: '123', someField: 'value' },
 *   enabled: isOpen
 * });
 */
export function useDialogPersistence<T = any>({
  key,
  data,
  enabled = true,
}: DialogPersistenceOptions<T>): DialogPersistenceReturn<T> {
  
  // Auto-save when data changes and enabled is true
  useEffect(() => {
    if (!enabled || !data) return;

    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving dialog state for ${key}:`, error);
    }
  }, [key, data, enabled]);

  // Restore state from localStorage
  const restoreState = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      return JSON.parse(stored) as T;
    } catch (error) {
      console.error(`Error restoring dialog state for ${key}:`, error);
      localStorage.removeItem(key);
      return null;
    }
  }, [key]);

  // Clear state from localStorage
  const clearState = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error clearing dialog state for ${key}:`, error);
    }
  }, [key]);

  // Manually save state
  const saveState = useCallback((newData: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(newData));
    } catch (error) {
      console.error(`Error manually saving dialog state for ${key}:`, error);
    }
  }, [key]);

  return {
    restoreState,
    clearState,
    saveState,
  };
}

/**
 * Hook for managing dialog open state with persistence
 * Combines dialog state management with persistence
 * 
 * @example
 * const { isOpen, openDialog, closeDialog, restoreDialog } = usePersistedDialog({
 *   key: 'payment-dialog',
 *   onRestore: (data) => {
 *     setEmployee(data.employee);
 *   }
 * });
 */
export function usePersistedDialog<T = any>(options: {
  key: string;
  onRestore?: (data: T) => void;
}) {
  const { restoreState, clearState, saveState } = useDialogPersistence<T>({
    key: options.key,
    enabled: false, // We'll manually control saving
  });

  const openDialog = useCallback((data?: T) => {
    if (data) {
      saveState(data);
    }
  }, [saveState]);

  const closeDialog = useCallback(() => {
    clearState();
  }, [clearState]);

  const restoreDialog = useCallback(() => {
    const data = restoreState();
    if (data && options.onRestore) {
      options.onRestore(data);
      return true;
    }
    return false;
  }, [restoreState, options]);

  return {
    openDialog,
    closeDialog,
    restoreDialog,
    restoreState,
    clearState,
    saveState,
  };
}

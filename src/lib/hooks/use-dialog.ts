import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

interface UseDialogReturn {
  open: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  toggleDialog: () => void;
}

export const useDialog = (initialState = false): UseDialogReturn => {
  const [open, setOpen] = useState(initialState);

  const openDialog = useCallback(() => setOpen(true), []);
  const closeDialog = useCallback(() => setOpen(false), []);
  const toggleDialog = useCallback(() => setOpen(prev => !prev), []);

  return {
    open,
    openDialog,
    closeDialog,
    toggleDialog
  };
};

interface UsePersistentDialogReturn {
  open: boolean;
  openDialog: (data?: Record<string, string>) => void;
  closeDialog: () => void;
  toggleDialog: () => void;
  removeDialogData: (dataKey: string) => void;
  data: Record<string, string> | null;
}

export const usePersistentDialog = (dialogKey: string): UsePersistentDialogReturn => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Use ref to track current search params
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  
  // Check if dialog should be open based on URL params
  const isOpenFromUrl = searchParams.get(dialogKey) === 'true';
  const [open, setOpen] = useState(isOpenFromUrl);
  
  // Extract data from URL params
  const getDataFromUrl = useCallback(() => {
    const data: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key.startsWith(`${dialogKey}_`)) {
        const dataKey = key.replace(`${dialogKey}_`, '');
        data[dataKey] = value;
      }
    });
    return Object.keys(data).length > 0 ? data : null;
  }, [searchParams, dialogKey]);

  const [data, setData] = useState<Record<string, string> | null>(getDataFromUrl());

  // Update state when URL changes
  useEffect(() => {
    const isOpen = searchParams.get(dialogKey) === 'true';
    setOpen(isOpen);
    setData(getDataFromUrl());
  }, [searchParams, dialogKey, getDataFromUrl]);

  const openDialog = useCallback((dialogData?: Record<string, string>) => {
    
    // Immediately update local state
    setOpen(true);
    setData(dialogData || null);
    
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set(dialogKey, 'true');
    
    // Add data to URL params
    if (dialogData) {
      Object.entries(dialogData).forEach(([key, value]) => {
        newSearchParams.set(`${dialogKey}_${key}`, value);
      });
    }
    
    const newUrl = `${pathname}?${newSearchParams.toString()}`;
    // Use setTimeout to avoid conflicts with Next.js
    setTimeout(() => {
      router.push(newUrl);
    }, 200);
  }, [router, pathname, searchParams, dialogKey]);

    const closeDialog = useCallback(() => {
    // Immediately update local state
    setOpen(false);
    setData(null);
    
    // Use setTimeout to avoid conflicts with Next.js
    setTimeout(() => {
      const newSearchParams = new URLSearchParams(searchParamsRef.current);
      newSearchParams.delete(dialogKey);
      
      // Remove all data params for this dialog
      const keysToDelete: string[] = [];
      newSearchParams.forEach((value, key) => {
        if (key.startsWith(`${dialogKey}_`)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => newSearchParams.delete(key));
      
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    }, 100);
  }, [router, pathname, dialogKey]);

  const removeDialogData = useCallback((dataKey: string) => {
    // Immediately update local state
    if (data) {
      const newData = { ...data };
      delete newData[dataKey];
      setData(Object.keys(newData).length > 0 ? newData : null);
    }
    
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.delete(`${dialogKey}_${dataKey}`);
    // Use setTimeout to avoid conflicts with Next.js
    setTimeout(() => {
      router.replace(`${pathname}?${newSearchParams.toString()}`);
    }, 100);
  }, [router, pathname, searchParams, dialogKey, data]);

  const toggleDialog = useCallback(() => {
    if (open) {
      closeDialog();
    } else {
      openDialog();
    }
  }, [open, openDialog, closeDialog]);

  return {
    open,
    openDialog,
    closeDialog,
    toggleDialog,
    removeDialogData,
    data
  };
};

// Helper function to create dialog keys
export const createDialogKey = (baseKey: string, suffix?: string): string => {
  return suffix ? `${baseKey}_${suffix}` : baseKey;
};

// Specific hook for recipe modals
export const useRecipeModal = () => {
  return usePersistentDialog('recipe');
};

// Specific hook for food item modals
export const useFoodItemModal = () => {
  return usePersistentDialog('foodItem');
};

// Specific hook for meal plan modals
export const useMealPlanModal = () => {
  return usePersistentDialog('mealPlan');
};

interface UseConfirmDialogReturn<T = unknown> {
  open: boolean;
  data: T | null;
  openDialog: (data?: T) => void;
  closeDialog: () => void;
  confirm: () => void;
  cancel: () => void;
}

export const useConfirmDialog = <T = unknown>(): UseConfirmDialogReturn<T> => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const openDialog = useCallback((dialogData?: T) => {
    setData(dialogData || null);
    setOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setData(null);
  }, []);

  const confirm = useCallback(() => {
    setOpen(false);
    // Note: You'll need to handle the actual confirmation logic in your component
  }, []);

  const cancel = useCallback(() => {
    setOpen(false);
    setData(null);
  }, []);

  return {
    open,
    data,
    openDialog,
    closeDialog,
    confirm,
    cancel
  };
}; 
import { useState, useCallback } from 'react';

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
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseDebouncedSearchOptions {
  delay?: number;
  onSearch?: (term: string) => void;
}

export interface UseDebouncedSearchReturn {
  searchTerm: string;
  debouncedSearchTerm: string;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
}

export function useDebouncedSearch(
  options?: UseDebouncedSearchOptions
): UseDebouncedSearchReturn {
  const delay = options?.delay ?? 300;
  const onSearchRef = useRef(options?.onSearch);
  onSearchRef.current = options?.onSearch;

  const [searchTerm, setSearchTermState] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const isInitialMount = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
  }, []);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [searchTerm, delay]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onSearchRef.current?.(debouncedSearchTerm);
  }, [debouncedSearchTerm]);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
    setDebouncedSearchTerm('');
    onSearchRef.current?.('');
  }, []);

  return {
    searchTerm,
    debouncedSearchTerm,
    setSearchTerm,
    clearSearch,
  };
}

import { useState, useEffect, useMemo, useTransition, useCallback } from 'react';

interface UseSearchPaginationOptions<T> {
  data: T[];
  itemsPerPage?: number;
  searchFields?: (keyof T)[];
  searchFunction?: (item: T, searchTerm: string) => boolean;
}

interface UseSearchPaginationReturn<T> {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isSearchPending: boolean;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  filteredData: T[];
  paginatedData: T[];
  totalPages: number;
  totalItems: number;
  resetPagination: () => void;
}

export const useSearchPagination = <T>({
  data,
  itemsPerPage = 25,
  searchFields,
  searchFunction,
}: UseSearchPaginationOptions<T>): UseSearchPaginationReturn<T> => {
  const [searchTerm, setSearchTermImmediate] = useState('');
  const [deferredSearchTerm, setDeferredSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermImmediate(term);
    startTransition(() => {
      setDeferredSearchTerm(term);
    });
  }, []);

  // Reset pagination when deferred search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchTerm]);

  // Filter data based on deferred search term (low-priority update)
  const filteredData = useMemo(() => {
    const baseData = Array.isArray(data) ? data : [];
    if (!deferredSearchTerm.trim()) return baseData;

    const term = deferredSearchTerm.toLowerCase();

    if (searchFunction) {
      return baseData.filter((item) => searchFunction(item, term));
    }

    if (searchFields) {
      return baseData.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(term);
          }
          return false;
        })
      );
    }

    // Default search behavior - search all string fields
    return baseData.filter((item) =>
      Object.values(item as Record<string, unknown>).some(
        (value) => typeof value === 'string' && value.toLowerCase().includes(term)
      )
    );
  }, [data, deferredSearchTerm, searchFields, searchFunction]);

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const totalItems = filteredData.length;

  const resetPagination = useCallback(() => {
    setSearchTermImmediate('');
    setDeferredSearchTerm('');
    setCurrentPage(1);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    isSearchPending: isPending,
    currentPage,
    setCurrentPage,
    filteredData,
    paginatedData,
    totalPages,
    totalItems,
    resetPagination,
  };
};

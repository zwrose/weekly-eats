import { useState, useEffect, useMemo } from 'react';

interface UseSearchPaginationOptions<T> {
  data: T[];
  itemsPerPage?: number;
  searchFields?: (keyof T)[];
  searchFunction?: (item: T, searchTerm: string) => boolean;
}

interface UseSearchPaginationReturn<T> {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
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
  searchFunction
}: UseSearchPaginationOptions<T>): UseSearchPaginationReturn<T> => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Ensure data is always an array (compute inside memos to avoid changing deps)

  // Reset pagination when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    const baseData = Array.isArray(data) ? data : [];
    if (!searchTerm.trim()) return baseData;

    const term = searchTerm.toLowerCase();
    
    if (searchFunction) {
      return baseData.filter(item => searchFunction(item, term));
    }

    if (searchFields) {
      return baseData.filter(item =>
        searchFields.some(field => {
          const value = item[field];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(term);
          }
          return false;
        })
      );
    }

    // Default search behavior - search all string fields
    return baseData.filter(item =>
      Object.values(item as Record<string, unknown>).some(value => 
        typeof value === 'string' && value.toLowerCase().includes(term)
      )
    );
  }, [data, searchTerm, searchFields, searchFunction]);

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredData.slice(startIndex, endIndex);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const totalItems = filteredData.length;

  const resetPagination = () => {
    setSearchTerm('');
    setCurrentPage(1);
  };

  return {
    searchTerm,
    setSearchTerm,
    currentPage,
    setCurrentPage,
    filteredData,
    paginatedData,
    totalPages,
    totalItems,
    resetPagination
  };
}; 
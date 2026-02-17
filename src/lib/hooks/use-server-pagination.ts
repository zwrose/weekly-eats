'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ServerPaginationFetchParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface ServerPaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UseServerPaginationOptions<T> {
  fetchFn: (params: ServerPaginationFetchParams) => Promise<ServerPaginationResult<T>>;
  defaultLimit?: number;
  defaultSortBy?: string;
  defaultSortOrder?: 'asc' | 'desc';
  filterKey?: string;
}

export interface UseServerPaginationReturn<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  refetch: () => Promise<void>;
}

export function useServerPagination<T>({
  fetchFn,
  defaultLimit = 10,
  defaultSortBy = 'updatedAt',
  defaultSortOrder = 'desc',
  filterKey,
}: UseServerPaginationOptions<T>): UseServerPaginationReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(defaultLimit);
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(defaultSortOrder);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const fetchData = useCallback(async (params: ServerPaginationFetchParams) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFnRef.current(params);
      setData(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const prevFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    const filterChanged = filterKey !== undefined && prevFilterKeyRef.current !== filterKey;
    prevFilterKeyRef.current = filterKey;

    if (filterChanged && page !== 1) {
      setPage(1);
      return; // page change will re-trigger this effect
    }

    fetchData({ page, limit, sortBy, sortOrder });
  }, [page, limit, sortBy, sortOrder, fetchData, filterKey]);

  const setSort = useCallback((newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  }, []);

  const refetch = useCallback(async () => {
    await fetchData({ page, limit, sortBy, sortOrder });
  }, [page, limit, sortBy, sortOrder, fetchData]);

  return {
    data,
    total,
    page,
    limit,
    totalPages,
    sortBy,
    sortOrder,
    loading,
    error,
    setPage,
    setSort,
    refetch,
  };
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useServerPagination } from '../use-server-pagination';

describe('useServerPagination', () => {
  const mockFetchFn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchFn.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it('fetches data on mount', async () => {
    mockFetchFn.mockResolvedValue({
      data: [{ _id: '1', name: 'Test' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const { result } = renderHook(() =>
      useServerPagination({ fetchFn: mockFetchFn })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([{ _id: '1', name: 'Test' }]);
    expect(result.current.total).toBe(1);
    expect(result.current.totalPages).toBe(1);
    expect(mockFetchFn).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
  });

  it('exposes pagination state', async () => {
    mockFetchFn.mockResolvedValue({
      data: Array.from({ length: 25 }, (_, i) => ({ _id: String(i) })),
      total: 50,
      page: 1,
      limit: 10,
      totalPages: 2,
    });

    const { result } = renderHook(() =>
      useServerPagination({ fetchFn: mockFetchFn })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(10);
    expect(result.current.total).toBe(50);
    expect(result.current.totalPages).toBe(2);
  });

  it('changes page and refetches', async () => {
    mockFetchFn.mockResolvedValue({
      data: [{ _id: '1' }],
      total: 50,
      page: 1,
      limit: 10,
      totalPages: 2,
    });

    const { result } = renderHook(() =>
      useServerPagination({ fetchFn: mockFetchFn })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetchFn.mockResolvedValue({
      data: [{ _id: '26' }],
      total: 50,
      page: 2,
      limit: 10,
      totalPages: 2,
    });

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => {
      expect(result.current.page).toBe(2);
      expect(result.current.data).toEqual([{ _id: '26' }]);
    });

    expect(mockFetchFn).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    });
  });

  it('changes sort and resets to page 1', async () => {
    mockFetchFn.mockResolvedValue({
      data: [{ _id: '1' }],
      total: 50,
      page: 1,
      limit: 10,
      totalPages: 2,
    });

    const { result } = renderHook(() =>
      useServerPagination({ fetchFn: mockFetchFn })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Go to page 2 first
    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });

    // Change sort — should reset to page 1
    act(() => {
      result.current.setSort('title', 'asc');
    });

    await waitFor(() => {
      expect(result.current.page).toBe(1);
      expect(result.current.sortBy).toBe('title');
      expect(result.current.sortOrder).toBe('asc');
    });

    expect(mockFetchFn).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      sortBy: 'title',
      sortOrder: 'asc',
    });
  });

  it('accepts custom defaults', async () => {
    const { result } = renderHook(() =>
      useServerPagination({
        fetchFn: mockFetchFn,
        defaultLimit: 10,
        defaultSortBy: 'name',
        defaultSortOrder: 'asc',
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.limit).toBe(10);
    expect(result.current.sortBy).toBe('name');
    expect(result.current.sortOrder).toBe('asc');
    expect(mockFetchFn).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });

  it('handles fetch errors', async () => {
    mockFetchFn.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useServerPagination({ fetchFn: mockFetchFn })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toEqual([]);
  });

  it('provides a refetch function', async () => {
    mockFetchFn.mockResolvedValue({
      data: [{ _id: '1' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const { result } = renderHook(() =>
      useServerPagination({ fetchFn: mockFetchFn })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchFn).toHaveBeenCalledTimes(1);

    mockFetchFn.mockResolvedValue({
      data: [{ _id: '1' }, { _id: '2' }],
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetchFn).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual([{ _id: '1' }, { _id: '2' }]);
  });

  it('refetches when filterKey changes', async () => {
    mockFetchFn.mockResolvedValue({
      data: [{ _id: '1' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const { result, rerender } = renderHook(
      ({ filterKey }) =>
        useServerPagination({ fetchFn: mockFetchFn, filterKey }),
      { initialProps: { filterKey: 'a' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchFn).toHaveBeenCalledTimes(1);

    mockFetchFn.mockResolvedValue({
      data: [{ _id: '2' }],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    rerender({ filterKey: 'b' });

    await waitFor(() => {
      expect(result.current.data).toEqual([{ _id: '2' }]);
    });

    expect(mockFetchFn).toHaveBeenCalledTimes(2);
  });

  it('resets to page 1 when filterKey changes from a later page', async () => {
    mockFetchFn.mockResolvedValue({
      data: [{ _id: '1' }],
      total: 50,
      page: 1,
      limit: 10,
      totalPages: 2,
    });

    const { result, rerender } = renderHook(
      ({ filterKey }) =>
        useServerPagination({ fetchFn: mockFetchFn, filterKey }),
      { initialProps: { filterKey: 'a' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Go to page 2
    mockFetchFn.mockResolvedValue({
      data: [{ _id: '26' }],
      total: 50,
      page: 2,
      limit: 10,
      totalPages: 2,
    });

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });

    // Change filterKey — should reset to page 1
    mockFetchFn.mockResolvedValue({
      data: [{ _id: 'filtered' }],
      total: 5,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    rerender({ filterKey: 'b' });

    await waitFor(() => {
      expect(result.current.page).toBe(1);
      expect(result.current.data).toEqual([{ _id: 'filtered' }]);
    });
  });

  it('clears error on successful refetch', async () => {
    mockFetchFn.mockRejectedValueOnce(new Error('Fail'));

    const { result } = renderHook(() =>
      useServerPagination({ fetchFn: mockFetchFn })
    );

    await waitFor(() => {
      expect(result.current.error).toBe('Fail');
    });

    mockFetchFn.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
  });
});

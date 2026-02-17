import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedSearch } from '../use-debounced-search';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns initial empty search term and debounced value', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    expect(result.current.searchTerm).toBe('');
    expect(result.current.debouncedSearchTerm).toBe('');
  });

  it('updates searchTerm immediately on setSearchTerm', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.setSearchTerm('hello');
    });

    expect(result.current.searchTerm).toBe('hello');
    // Debounced value should NOT have updated yet
    expect(result.current.debouncedSearchTerm).toBe('');
  });

  it('updates debouncedSearchTerm after delay', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.setSearchTerm('hello');
    });

    expect(result.current.debouncedSearchTerm).toBe('');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('hello');
  });

  it('accepts custom delay', () => {
    const { result } = renderHook(() => useDebouncedSearch({ delay: 500 }));

    act(() => {
      result.current.setSearchTerm('test');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Not yet — custom delay is 500ms
    expect(result.current.debouncedSearchTerm).toBe('');

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.debouncedSearchTerm).toBe('test');
  });

  it('resets the debounce timer on rapid input', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.setSearchTerm('h');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.setSearchTerm('he');
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // 400ms total but timer restarted — should not have fired yet
    expect(result.current.debouncedSearchTerm).toBe('');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Now 300ms since last input
    expect(result.current.debouncedSearchTerm).toBe('he');
  });

  it('calls onSearch callback when debounced value changes', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch({ onSearch }));

    act(() => {
      result.current.setSearchTerm('pizza');
    });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith('pizza');
  });

  it('does not call onSearch for the initial empty value', () => {
    const onSearch = vi.fn();
    renderHook(() => useDebouncedSearch({ onSearch }));

    // Should not fire on mount
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('clears search term and debounced value', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch({ onSearch }));

    act(() => {
      result.current.setSearchTerm('test');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedSearchTerm).toBe('test');

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.debouncedSearchTerm).toBe('');
    expect(onSearch).toHaveBeenCalledWith('');
  });
});

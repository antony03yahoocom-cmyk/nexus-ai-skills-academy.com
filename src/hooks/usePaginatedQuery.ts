import { useState, useCallback } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

interface UsePaginatedQueryOptions<T> extends Omit<UseQueryOptions<any>, 'queryFn' | 'queryKey'> {
  pageSize?: number;
}

/**
 * Pagination hook for list queries to prevent loading unlimited records.
 * Improves performance by loading data in chunks.
 */
export function usePaginatedQuery<T>(
  queryKey: string[],
  queryFn: (page: number, pageSize: number) => Promise<T[]>,
  options: UsePaginatedQueryOptions<T> = {},
) {
  const [page, setPage] = useState(0);
  const pageSize = options.pageSize ?? 20;

  const { data = [], isLoading, isFetching, error } = useQuery({
    queryKey: [...queryKey, page, pageSize],
    queryFn: () => queryFn(page, pageSize),
    ...options,
  });

  const goToNextPage = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  const goToPreviousPage = useCallback(() => {
    setPage((prev) => Math.max(0, prev - 1));
  }, []);

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(0, p));
  }, []);

  const resetPagination = useCallback(() => {
    setPage(0);
  }, []);

  return {
    data,
    page,
    pageSize,
    isLoading,
    isFetching,
    error,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    resetPagination,
    hasMorePages: data.length === pageSize,
  };
}

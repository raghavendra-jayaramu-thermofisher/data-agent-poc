import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { queryKeys } from '../../api/queryKeys';
import { useOrganization } from '../../organizations/OrganizationProvider';
import { listTableRows, type TableQuery, type TableRowsPage } from './table-rows-api';
import { rowsFromPositional, type AnalyticalTableModel } from './table-domain';
import type { TableViewState } from './AnalyticalTable';

/**
 * Rows for a table whose stored result is larger than the execution trace sent. The trace's first
 * page seeds the default view; other sorts and searches are evaluated by the server over every row.
 */
export function useTableRows(model: AnalyticalTableModel, view: TableViewState) {
  const { activeOrganization } = useOrganization();
  const paging = model.paging;
  const [search, setSearch] = useState(view.globalFilter.trim());
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(view.globalFilter.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [view.globalFilter]);
  const query: TableQuery = {
    sort: view.sorting[0]?.id ?? null,
    descending: view.sorting[0]?.desc ?? false,
    search,
  };
  const isDefaultView = query.sort === null && !query.search;
  const seed: TableRowsPage | undefined = paging && {
    columns: model.columns,
    rows: model.rows.map((row) => model.columns.map((column) => row.values[column] ?? null)),
    matching_count: paging.storedRowCount,
    next_cursor: paging.nextCursor,
    has_more: paging.nextCursor !== null,
  };
  const rows = useInfiniteQuery({
    queryKey: queryKeys.jobs.tableRows(
      activeOrganization?.id ?? null,
      paging?.artifactId ?? '',
      query,
    ),
    queryFn: ({ pageParam, signal }) => listTableRows(paging!, query, pageParam, undefined, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    initialData: isDefaultView && seed ? { pages: [seed], pageParams: [null] } : undefined,
    // Keep the previous rows on screen while a new sort or search loads.
    placeholderData: keepPreviousData,
    // Stored rows never change once the job has finished.
    staleTime: Infinity,
    enabled: Boolean(paging),
  });
  const loaded = useMemo(
    () =>
      rowsFromPositional(
        model.columns,
        (rows.data?.pages ?? []).flatMap((page) => page.rows as unknown[][]),
      ),
    [model.columns, rows.data],
  );
  return {
    query,
    rows: loaded,
    matchingCount: rows.data?.pages[0]?.matching_count ?? null,
    isUpdating: rows.isPlaceholderData || search !== view.globalFilter.trim(),
    hasMore: rows.hasNextPage,
    isFetchingMore: rows.isFetchingNextPage,
    isError: rows.isError,
    loadMore: () => void rows.fetchNextPage(),
    retry: () => void rows.refetch(),
  };
}

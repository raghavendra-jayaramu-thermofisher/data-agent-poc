import { useEffect, useRef } from 'react';

type Props = {
  hasMore: boolean;
  isLoading: boolean;
  isError?: boolean;
  onLoadMore(): void;
  /** Shown once every page is loaded; omit to render nothing at the end. */
  endLabel?: string;
  loadingLabel?: string;
  className?: string;
};

/**
 * Requests the next page when it scrolls into view. Without IntersectionObserver, or after a
 * failed page, it falls back to an explicit button so more items can always be requested.
 */
export function LoadMoreSentinel({
  hasMore,
  isLoading,
  isError = false,
  onLoadMore,
  endLabel,
  loadingLabel = 'Loading more…',
  className = '',
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const loadRef = useRef(onLoadMore);
  useEffect(() => {
    loadRef.current = onLoadMore;
  });
  const observe = hasMore && !isLoading && !isError && typeof IntersectionObserver !== 'undefined';

  useEffect(() => {
    const element = ref.current;
    if (!observe || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadRef.current();
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [observe]);

  const classes = `load-more-sentinel ${className}`.trim();
  if (isLoading)
    return (
      <div ref={ref} className={classes} role="status">
        {loadingLabel}
      </div>
    );
  if (!hasMore) return endLabel ? <div className={classes}>{endLabel}</div> : null;
  return (
    <div ref={ref} className={classes}>
      {(isError || !observe) && (
        <button type="button" className="load-more-button" onClick={onLoadMore}>
          {isError ? 'Unable to load more. Retry' : 'Load more'}
        </button>
      )}
    </div>
  );
}

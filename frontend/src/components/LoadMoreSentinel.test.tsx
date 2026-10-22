import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadMoreSentinel } from './LoadMoreSentinel';

type Callback = (entries: { isIntersecting: boolean }[]) => void;

function installObserver() {
  const observers: { callback: Callback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn();
      constructor(callback: Callback) {
        observers.push({ callback, disconnect: this.disconnect });
      }
      observe() {}
    },
  );
  return observers;
}

afterEach(() => vi.unstubAllGlobals());

describe('LoadMoreSentinel', () => {
  it('requests the next page when it scrolls into view', () => {
    const observers = installObserver();
    const onLoadMore = vi.fn();
    render(<LoadMoreSentinel hasMore isLoading={false} onLoadMore={onLoadMore} />);

    observers[0]!.callback([{ isIntersecting: false }]);
    expect(onLoadMore).not.toHaveBeenCalled();
    observers[0]!.callback([{ isIntersecting: true }]);
    expect(onLoadMore).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('stops observing while a page loads and shows the loading state', () => {
    const observers = installObserver();
    const { rerender } = render(
      <LoadMoreSentinel hasMore isLoading={false} onLoadMore={vi.fn()} />,
    );
    rerender(
      <LoadMoreSentinel hasMore isLoading onLoadMore={vi.fn()} loadingLabel="Loading chats…" />,
    );

    expect(observers[0]!.disconnect).toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Loading chats…');
  });

  it('shows the end of the list once every page is loaded', () => {
    installObserver();
    const { rerender, container } = render(
      <LoadMoreSentinel hasMore={false} isLoading={false} onLoadMore={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(
      <LoadMoreSentinel
        hasMore={false}
        isLoading={false}
        onLoadMore={vi.fn()}
        endLabel="All loaded"
      />,
    );
    expect(screen.getByText('All loaded')).toBeInTheDocument();
  });

  it('offers a retry button after a failed page and a button without IntersectionObserver', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <LoadMoreSentinel hasMore isLoading={false} onLoadMore={onLoadMore} />,
    );
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    installObserver();
    rerender(<LoadMoreSentinel hasMore isLoading={false} isError onLoadMore={onLoadMore} />);
    await user.click(screen.getByRole('button', { name: 'Unable to load more. Retry' }));
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });
});

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MetricGroup, MetricTile } from './MetricCard';
import type { MetricCardModel } from './metric-domain';

const card = (overrides: Partial<MetricCardModel> = {}): MetricCardModel => ({
  field: 'backlog',
  label: 'Backlog value',
  format: 'currency',
  unit: 'P$',
  caption: null,
  icon: null,
  tone: 'neutral',
  value: 17552267.65356,
  comparison: null,
  polarity: 'neutral',
  details: [],
  ...overrides,
});

describe('MetricTile', () => {
  it('shows the compact headline with the exact value underneath', () => {
    render(<MetricTile model={card()} />);
    const tile = screen.getByRole('article', { name: 'Backlog value: P$17.55M' });
    expect(within(tile).getByText('Backlog value')).toBeInTheDocument();
    expect(within(tile).getByText('P$17.55M')).toBeInTheDocument();
    expect(within(tile).getByText('P$17,552,267.65')).toBeInTheDocument();
  });

  it('shows the change, its label and spoken wording, coloured by polarity', () => {
    const { container } = render(
      <MetricTile
        model={card({
          comparison: { field: 'previous', label: 'vs previous week', value: 17846061.87 },
          polarity: 'lower_is_better',
        })}
      />,
    );
    expect(screen.getByText('Down 1.65% vs previous week')).toBeInTheDocument();
    expect(screen.getByText('vs previous week')).toBeInTheDocument();
    expect(container.querySelector('.metric-change-positive')).not.toBeNull();
  });

  it('shows no change line when the comparison value is missing', () => {
    const { container } = render(
      <MetricTile model={card({ comparison: { field: 'previous', label: null, value: null } })} />,
    );
    expect(container.querySelector('.metric-change')).toBeNull();
  });

  it('lists supporting figures and a dash for a missing one', () => {
    render(
      <MetricTile
        model={card({
          caption: 'BID · due this quarter',
          details: [
            { field: 'lines', label: 'Open lines', format: 'count', unit: null, value: 17080 },
            { field: 'orders', label: 'Orders', format: 'count', unit: null, value: null },
          ],
        })}
      />,
    );
    expect(screen.getByText('Open lines').nextElementSibling).toHaveTextContent('17,080');
    expect(screen.getByText('Orders').nextElementSibling).toHaveTextContent('—');
    expect(screen.getByText('BID · due this quarter')).toBeInTheDocument();
  });

  it('adds a text cue for every non-neutral tone so colour is never the only signal', () => {
    const { rerender } = render(<MetricTile model={card({ tone: 'warning' })} />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
    rerender(<MetricTile model={card({ tone: 'neutral' })} />);
    expect(screen.queryByText('Warning')).toBeNull();
    rerender(<MetricTile model={card({ tone: 'negative' })} />);
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });
});

describe('MetricGroup', () => {
  const group = (count: number) =>
    Array.from({ length: count }, (_, index) =>
      card({ field: `m${index}`, label: `Metric ${index}`, value: index + 1 }),
    );

  it('renders up to six cards in one wrapping grid with no scroll container', () => {
    const { container } = render(<MetricGroup metrics={group(6)} />);
    expect(screen.getAllByRole('article')).toHaveLength(6);
    const grid = container.querySelector('.metric-group');
    expect(grid).toHaveAttribute('data-count', '6');
    expect(grid?.getAttribute('style')).toBeNull();
    expect(container.querySelectorAll('[style*="overflow"]')).toHaveLength(0);
  });

  it('marks only the first card of a multi-card group as primary', () => {
    const { container } = render(<MetricGroup metrics={group(3)} />);
    const primary = container.querySelectorAll('.metric-tile-primary');
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveTextContent('Metric 0');
  });

  it('does not enlarge a single card', () => {
    const { container } = render(<MetricGroup metrics={group(1)} />);
    expect(container.querySelector('.metric-tile-primary')).toBeNull();
  });
});

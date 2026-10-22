import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AnalyticalTable } from './AnalyticalTable';
import { rowsFromPositional, type AnalyticalTableModel } from './table-domain';

const columns = ['reference', 'amount'];
const model: AnalyticalTableModel = {
  columns,
  rows: rowsFromPositional(
    columns,
    Array.from({ length: 5000 }, (_, index) => [`REF-${index}`, index]),
  ),
  rowCount: 5000,
  truncated: false,
};

function bodyRows() {
  return within(screen.getByRole('table', { name: 'Large result' }))
    .getAllByRole('row')
    .filter((row) => row.closest('tbody'));
}

describe('AnalyticalTable virtualization', () => {
  it('renders a bounded window of a large result while announcing every row', () => {
    render(<AnalyticalTable model={model} label="Large result" hideToolbar />);

    expect(bodyRows().length).toBeLessThanOrEqual(50);
    expect(screen.getByRole('table', { name: 'Large result' })).toHaveAttribute(
      'aria-rowcount',
      '5001',
    );
    expect(bodyRows()[0]).toHaveAttribute('aria-rowindex', '2');
    expect(screen.queryByText('REF-4999')).not.toBeInTheDocument();
  });

  it('sorts across all rows, not only the rendered window', async () => {
    const user = userEvent.setup();
    render(<AnalyticalTable model={model} label="Large result" />);

    // Numeric columns sort descending first.
    await user.click(screen.getByRole('button', { name: /Amount/ }));
    expect(bodyRows()[0]).toHaveTextContent('REF-4999');
  });

  it('filters across all rows, not only the rendered window', () => {
    render(
      <AnalyticalTable
        model={model}
        label="Large result"
        hideToolbar
        viewState={{ sorting: [], globalFilter: 'REF-4321' }}
        onViewStateChange={() => {}}
      />,
    );
    expect(bodyRows()).toHaveLength(1);
    expect(bodyRows()[0]).toHaveTextContent('REF-4321');
    expect(screen.getByRole('table', { name: 'Large result' })).toHaveAttribute(
      'aria-rowcount',
      '2',
    );
  });
});

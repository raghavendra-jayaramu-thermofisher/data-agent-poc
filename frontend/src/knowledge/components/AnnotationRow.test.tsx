import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnnotationRow } from './AnnotationRow';

describe('AnnotationRow', () => {
  const sampleAnnotation = {
    id: 'ann-1',
    data_source_id: 'ds-1',
    scope_type: 'datasource' as const,
    scope_key: null,
    content: 'Fiscal year starts October 1st and ends September 30th.',
    created_at: '2026-10-18T10:00:00Z',
    updated_at: '2026-10-18T10:00:00Z',
  };

  it('renders scope badge and preview snippet in collapsed state', () => {
    render(
      <AnnotationRow
        annotation={sampleAnnotation}
        canManage={true}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isExpanded={false}
      />
    );

    expect(screen.getByText('datasource')).toBeInTheDocument();
    expect(
      screen.getByText(/Fiscal year starts October 1st and ends September 30th./)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Edit$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Delete$/i })).toBeInTheDocument();
  });

  it('expands when clicked and toggles content', async () => {
    const handleToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <AnnotationRow
        annotation={sampleAnnotation}
        canManage={true}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isExpanded={false}
        onToggle={handleToggle}
      />
    );

    await user.click(screen.getByRole('button', { name: /datasource/i }));
    expect(handleToggle).toHaveBeenCalled();
  });

  it('enters editing mode and calls onUpdate on save', async () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AnnotationRow
        annotation={sampleAnnotation}
        canManage={true}
        onUpdate={handleUpdate}
        onDelete={vi.fn()}
        isExpanded={true}
      />
    );

    await user.click(screen.getByRole('button', { name: /^Edit$/i }));

    const textarea = screen.getByPlaceholderText(/Enter markdown knowledge content…/i);
    expect(textarea).toBeInTheDocument();

    await user.clear(textarea);
    await user.type(textarea, 'Updated business rule.');
    await user.click(screen.getByRole('button', { name: /^Save$/i }));

    expect(handleUpdate).toHaveBeenCalledWith('Updated business rule.');
  });
});

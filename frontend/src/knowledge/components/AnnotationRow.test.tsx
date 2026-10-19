import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { annotation } from '../test-fixtures';
import { AnnotationRow } from './AnnotationRow';

describe('AnnotationRow', () => {
  it('keeps actions in More and allows keyboard expansion separately', async () => {
    const toggle = vi.fn();
    const user = userEvent.setup();
    render(
      <AnnotationRow
        annotation={annotation}
        canManage
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onToggle={toggle}
        isExpanded={false}
      />,
    );
    expect(screen.getByText('Data source')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit knowledge' })).not.toBeInTheDocument();
    const disclosure = screen.getByRole('button', { name: 'Fiscal calendar, Data source' });
    disclosure.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: /More actions/ }));
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('menuitem', { name: 'Edit knowledge' })).toBeInTheDocument();
  });

  it('saves edited instructions and keeps server errors visible for retry', async () => {
    const update = vi
      .fn()
      .mockRejectedValueOnce({ message: 'Connection interrupted.' })
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AnnotationRow annotation={annotation} canManage onUpdate={update} onDelete={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: /More actions/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit knowledge' }));
    const input = screen.getByRole('textbox', { name: 'Instructions' });
    await user.clear(input);
    await user.type(input, 'Updated business rule.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted.');
    expect(input).toHaveValue('Updated business rule.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(update).toHaveBeenCalledWith('Updated business rule.');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('awaits deletion and preserves the confirmation on failure', async () => {
    const remove = vi
      .fn()
      .mockRejectedValueOnce({ message: 'Unable to connect.' })
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AnnotationRow annotation={annotation} canManage onUpdate={vi.fn()} onDelete={remove} />,
    );
    await user.click(screen.getByRole('button', { name: /More actions/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete knowledge' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Delete knowledge' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Unable to connect.');
    await user.click(within(dialog).getByRole('button', { name: 'Delete knowledge' }));
    expect(remove).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lets members read instructions without management actions', async () => {
    const user = userEvent.setup();
    render(
      <AnnotationRow
        annotation={annotation}
        canManage={false}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /More actions/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Fiscal calendar, Data source' }));
    expect(screen.getByText('The fiscal year starts on October 1.')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from '../../api/types';
import { ChatComposer } from './ChatComposer';

const source: DataSource = {
  id: 'ds1',
  organization_id: 'org1',
  name: 'Warehouse',
  kind: 'postgres',
  display_type: 'postgres',
  status: 'active',
  config: {},
  created_by: 'u1',
  last_tested_at: null,
  last_error_code: null,
  created_at: '2026-08-24T12:00:00Z',
  updated_at: '2026-08-24T12:00:00Z',
  active_file: null,
};

function EditableComposer({ onSubmit }: { onSubmit(): void }) {
  const [question, setQuestion] = useState('Show revenue');
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  return (
    <ChatComposer
      question={question}
      onQuestionChange={setQuestion}
      onSubmit={onSubmit}
      dataSources={[source]}
      selectedDataSourceIds={sourceIds}
      onDataSourceIdsChange={setSourceIds}
      profiles={[]}
      selectedProfileId={null}
      onProfileIdChange={() => undefined}
      placement="inline"
    />
  );
}

describe('ChatComposer data-source scope', () => {
  it('requires an explicit source selection before the first question can be sent', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<EditableComposer onSubmit={onSubmit} />);

    const send = screen.getByRole('button', { name: 'Send question' });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /select data source/i }));
    await user.click(screen.getByRole('button', { name: /warehouse/i }));
    expect(screen.getByRole('button', { name: /1 source/i })).toBeInTheDocument();
    expect(send).toBeEnabled();
    await user.click(send);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('hides the source picker for follow-ups and keeps the locked conversation usable', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatComposer
        question="Compare regions"
        onQuestionChange={() => undefined}
        onSubmit={onSubmit}
        dataSources={[]}
        selectedDataSourceIds={['ds1']}
        onDataSourceIdsChange={() => undefined}
        profiles={[]}
        selectedProfileId={null}
        onProfileIdChange={() => undefined}
        dataSourceSelection="hidden"
        inputLabel="Ask a follow-up"
      />,
    );

    expect(screen.queryByRole('button', { name: /source/i })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ask a follow-up' })).toBeInTheDocument();
    expect(screen.queryByText(/read-only analytical/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send question' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('closes an open picker when clicking outside', async () => {
    const user = userEvent.setup();
    render(<EditableComposer onSubmit={() => undefined} />);

    await user.click(screen.getByRole('button', { name: /select data source/i }));
    expect(screen.getByRole('dialog', { name: 'Select data sources' })).toBeInTheDocument();

    await user.click(document.body);
    expect(screen.queryByRole('dialog', { name: 'Select data sources' })).not.toBeInTheDocument();
  });

  it('closes an open picker with Escape and only shows one picker at a time', async () => {
    const user = userEvent.setup();
    render(<EditableComposer onSubmit={() => undefined} />);

    await user.click(screen.getByRole('button', { name: /select data source/i }));
    await user.click(screen.getByRole('button', { name: 'Default model' }));
    expect(screen.queryByRole('dialog', { name: 'Select data sources' })).not.toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Select model profile' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox', { name: 'Select model profile' })).not.toBeInTheDocument();
  });
});

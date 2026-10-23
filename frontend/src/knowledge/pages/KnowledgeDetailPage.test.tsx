import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dataSourceApi from '../../data-sources/api/data-source-api';
import * as api from '../api/knowledge-api';
import { annotation, detail, documents, source, status } from '../test-fixtures';
import { KnowledgeDetailPage } from './KnowledgeDetailPage';

const state = vi.hoisted(() => ({ role: 'owner', registerJob: vi.fn() }));
vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({ activeOrganization: { id: 'org-1', role: state.role } }),
}));
vi.mock('../../jobs/JobManagerProvider', () => ({
  useJobManager: () => ({ registerJob: state.registerJob, activeJobs: [] }),
}));
vi.mock('../../data-sources/api/data-source-api');
vi.mock('../api/knowledge-api');

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/knowledge/ds-1']}>
        <Routes>
          <Route path="/knowledge/:dataSourceId" element={<KnowledgeDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.role = 'owner';
  vi.mocked(dataSourceApi.getDataSource).mockResolvedValue(source);
  vi.mocked(api.getStatus).mockResolvedValue(status);
  vi.mocked(api.listDocuments).mockResolvedValue(documents);
  vi.mocked(api.getDocument).mockResolvedValue(detail);
  vi.mocked(api.listAnnotations).mockResolvedValue([annotation]);
});
describe('Knowledge detail', () => {
  it('keeps only schema and business knowledge and loads the first table', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: source.name })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(await screen.findByRole('heading', { name: 'dbo.orders' })).toBeInTheDocument();
    expect(api.getDocument).toHaveBeenCalledWith('ds-1', 'doc-orders');
    expect(api.getIndex).not.toHaveBeenCalled();
    expect(api.listVersions).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/fingerprint|estimated tokens|Active version|Last generated/i),
    ).not.toBeInTheDocument();
  });
  it('allows managing business knowledge without switching away from the data source', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Business knowledge' }));
    expect(await screen.findByText('Fiscal calendar')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add knowledge' }));
    expect(
      await screen.findByRole('dialog', { name: 'Add business knowledge' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Instructions' })).toBeInTheDocument();
  });
  it('copies every table schema in compact form, for members too', async () => {
    state.role = 'member';
    const compact = '-- Warehouse: 2 tables and views\ndbo.orders (table): id INT NOT NULL\n';
    vi.mocked(api.getCompactSchema).mockResolvedValue({
      knowledge_version_id: 'v1',
      table_count: 2,
      text: compact,
    });
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Copy all schemas' }));
    expect(api.getCompactSchema).toHaveBeenCalledWith('ds-1');
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(compact));
    expect(screen.queryByRole('button', { name: /Refresh schema/ })).not.toBeInTheDocument();
  });
  it('starts schema refresh through the existing job system', async () => {
    vi.mocked(api.generate).mockResolvedValue({ job_id: 'job-1', knowledge_base_id: 'kb-1' });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Refresh schema' }));
    expect(api.generate).toHaveBeenCalledWith('ds-1');
    expect(state.registerJob).toHaveBeenCalledWith('job-1');
  });
  it('retains business knowledge before schema setup and limits members to reading', async () => {
    state.role = 'member';
    vi.mocked(api.getStatus).mockResolvedValue({
      ...status,
      status: 'empty',
      current_version_id: null,
    });
    const user = userEvent.setup();
    renderPage();
    expect(
      await screen.findByText('Ask a workspace admin to generate the schema.'),
    ).toBeInTheDocument();
    expect(api.listDocuments).not.toHaveBeenCalled();
    await user.click(screen.getByRole('tab', { name: 'Business knowledge' }));
    expect(await screen.findByText('Fiscal calendar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add knowledge' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /More actions/ })).not.toBeInTheDocument();
  });
});

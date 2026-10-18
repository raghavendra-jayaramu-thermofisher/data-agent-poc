import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as dataSourceApi from '../../data-sources/api/data-source-api';
import * as knowledgeApi from '../api/knowledge-api';
import { KnowledgeDetailPage } from './KnowledgeDetailPage';

vi.mock('../../organizations/OrganizationProvider', () => ({
  useOrganization: () => ({
    activeOrganization: { id: 'org-1', role: 'owner' },
  }),
}));

vi.mock('../../jobs/JobManagerProvider', () => ({
  useJobManager: () => ({
    registerJob: vi.fn(),
  }),
}));

vi.mock('../../data-sources/api/data-source-api');
vi.mock('../api/knowledge-api');

const mockGetDataSource = vi.mocked(dataSourceApi.getDataSource);
const mockGetStatus = vi.mocked(knowledgeApi.getStatus);
const mockGetIndex = vi.mocked(knowledgeApi.getIndex);
const mockListDocuments = vi.mocked(knowledgeApi.listDocuments);
const mockGetDocument = vi.mocked(knowledgeApi.getDocument);
const mockListAnnotations = vi.mocked(knowledgeApi.listAnnotations);
const mockListVersions = vi.mocked(knowledgeApi.listVersions);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/knowledge/ds-1']}>
        <Routes>
          <Route path="/knowledge/:dataSourceId" element={<KnowledgeDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('KnowledgeDetailPage Tabbed Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetDataSource.mockResolvedValue({
      id: 'ds-1',
      name: 'Sales Analytics DB',
      type: 'mssql',
      status: 'active',
      config: {},
      created_at: '2026-10-18T10:00:00Z',
      updated_at: '2026-10-18T10:00:00Z',
    });

    mockGetStatus.mockResolvedValue({
      id: 'kb-1',
      data_source_id: 'ds-1',
      status: 'ready',
      current_version_number: 1,
      object_count: 42,
      schema_fingerprint: 'abcd1234efgh5678',
      generated_at: '2026-10-18T10:00:00Z',
      created_at: '2026-10-18T10:00:00Z',
      updated_at: '2026-10-18T10:00:00Z',
    });

    mockGetIndex.mockResolvedValue({
      id: 'doc-index',
      document_type: 'index',
      document_key: 'schema_index',
      title: 'Compact Index',
      metadata: {},
      estimated_tokens: 300,
      content_markdown: '# Database Index\n\nTables: orders, customers',
      created_at: '2026-10-18T10:00:00Z',
    });

    mockListDocuments.mockResolvedValue([
      {
        id: 'doc-orders',
        document_type: 'table_schema',
        document_key: 'dbo.orders',
        title: 'dbo.orders',
        metadata: {},
        estimated_tokens: 150,
        created_at: '2026-10-18T10:00:00Z',
      },
    ]);

    mockGetDocument.mockResolvedValue({
      id: 'doc-orders',
      document_type: 'table_schema',
      document_key: 'dbo.orders',
      title: 'dbo.orders',
      metadata: {},
      estimated_tokens: 150,
      content_markdown: '### Columns\n- id: int\n- amount: float',
      created_at: '2026-10-18T10:00:00Z',
    });

    mockListAnnotations.mockResolvedValue([
      {
        id: 'ann-1',
        data_source_id: 'ds-1',
        scope_type: 'datasource',
        scope_key: null,
        content: 'Thermo Fisher Fiscal Calendar FY2026 rules',
        created_at: '2026-10-18T10:00:00Z',
        updated_at: '2026-10-18T10:00:00Z',
      },
    ]);

    mockListVersions.mockResolvedValue([
      {
        id: 'v-1',
        knowledge_base_id: 'kb-1',
        version_number: 1,
        schema_fingerprint: 'abcd1234efgh5678',
        created_at: '2026-10-18T10:00:00Z',
      },
    ]);
  });

  it('renders page header, stat bar, and all 3 tabs with count badges', async () => {
    renderPage();

    expect(await screen.findByText('Sales Analytics DB Knowledge Base')).toBeInTheDocument();
    expect(screen.getByText('Active Version')).toBeInTheDocument();
    expect(screen.getAllByText('v1').length).toBeGreaterThanOrEqual(1);

    // Check 3 tabs
    expect(screen.getByRole('button', { name: /Schema Explorer/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Business Knowledge/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Raw Index & Versions/i })).toBeInTheDocument();
  });

  it('switches tabs and displays respective content', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Sales Analytics DB Knowledge Base')).toBeInTheDocument();

    // Switch to Business Knowledge
    await user.click(screen.getByRole('button', { name: /Business Knowledge/i }));
    expect(await screen.findByText(/Thermo Fisher Fiscal Calendar FY2026 rules/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Knowledge/i })).toBeInTheDocument();

    // Switch to Raw Index & Versions
    await user.click(screen.getByRole('button', { name: /Raw Index & Versions/i }));
    expect(await screen.findByText('Compact Schema Index')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Markdown/i })).toBeInTheDocument();
    expect(screen.getByText('Version History')).toBeInTheDocument();

    // Switch back to Schema Explorer
    await user.click(screen.getByRole('button', { name: /Schema Explorer/i }));
    expect(screen.getByRole('button', { name: /Schema Explorer/i })).toHaveClass('is-active');
  });
});

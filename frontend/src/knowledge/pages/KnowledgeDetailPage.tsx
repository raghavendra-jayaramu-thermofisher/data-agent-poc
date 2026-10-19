import { Button, Tabs } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AppError } from '../../api/errors';
import { queryKeys } from '../../api/queryKeys';
import { PageError, PageLoading } from '../../components/PageState';
import { notifications } from '../../components/notifications';
import { getDataSource } from '../../data-sources/api/data-source-api';
import { useJobManager } from '../../jobs/JobManagerProvider';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/knowledge-api';
import { BusinessKnowledgePanel } from '../components/BusinessKnowledgePanel';
import { KnowledgeDocumentsPanel } from '../components/KnowledgeDocumentsPanel';
import { KnowledgeStatus } from '../components/KnowledgeStatus';
import type { AnnotationValues } from '../schemas/annotation-schema';
import '../knowledge.css';

export function KnowledgeDetailPage() {
  const { dataSourceId = '' } = useParams();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const jobs = useJobManager();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('explorer');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<string | null>(null);
  const enabled = Boolean(orgId && dataSourceId);
  const source = useQuery({
    queryKey: queryKeys.dataSources.detail(orgId, dataSourceId),
    queryFn: () => getDataSource(dataSourceId),
    enabled,
  });
  const status = useQuery({
    queryKey: queryKeys.knowledge.status(orgId, dataSourceId),
    queryFn: () => api.getStatus(dataSourceId),
    enabled,
  });
  const hasSchema = status.data?.status === 'ready' || Boolean(status.data?.current_version_id);
  const documents = useQuery({
    queryKey: queryKeys.knowledge.documents(orgId, dataSourceId, ''),
    queryFn: () => api.listDocuments(dataSourceId, 'table_schema', 500),
    enabled: enabled && hasSchema,
  });
  const selectedDocumentId = documents.data?.some((document) => document.id === selection)
    ? selection
    : (documents.data?.[0]?.id ?? null);
  const detail = useQuery({
    queryKey: queryKeys.knowledge.document(orgId, dataSourceId, selectedDocumentId ?? ''),
    queryFn: () => api.getDocument(dataSourceId, selectedDocumentId!),
    enabled: enabled && hasSchema && Boolean(selectedDocumentId),
  });
  const annotations = useQuery({
    queryKey: queryKeys.knowledge.annotations(orgId, dataSourceId),
    queryFn: () => api.listAnnotations(dataSourceId),
    enabled,
  });
  const activeGeneration = jobs.activeJobs?.some(
    ({ job }) =>
      job.job_type === 'knowledge_generation' && job.input.data_source_id === dataSourceId,
  );
  const generate = useMutation({
    mutationFn: () => api.generate(dataSourceId),
    onSuccess: async (result) => {
      await jobs.registerJob(result.job_id);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.knowledge.status(orgId, dataSourceId),
      });
      notifications.info('Schema refresh started.');
    },
  });
  const updating = generate.isPending || activeGeneration || status.data?.status === 'generating';
  const filteredDocuments = useMemo(
    () =>
      (documents.data ?? []).filter((document) =>
        (document.title + ' ' + document.document_key)
          .toLocaleLowerCase()
          .includes(search.trim().toLocaleLowerCase()),
      ),
    [documents.data, search],
  );
  const invalidateAnnotations = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.knowledge.annotations(orgId, dataSourceId),
    });
  async function createAnnotation(values: AnnotationValues) {
    await api.createAnnotation(dataSourceId, {
      scope_type: values.scopeType,
      scope_key: values.scopeType === 'datasource' ? null : values.scopeKey,
      content: values.content,
    });
    await invalidateAnnotations();
    notifications.success('Business knowledge added.');
  }
  async function updateAnnotation(id: string, content: string) {
    await api.updateAnnotation(id, { content });
    await invalidateAnnotations();
    notifications.success('Business knowledge updated.');
  }
  async function deleteAnnotation(id: string) {
    await api.deleteAnnotation(id);
    await invalidateAnnotations();
    notifications.success('Business knowledge deleted.');
  }
  if (source.isLoading || status.isLoading) return <PageLoading label="Loading knowledge…" />;
  if (source.isError || !source.data)
    return (
      <PageError title="Unable to load this data source" retry={() => void source.refetch()} />
    );
  if (status.isError)
    return <PageError title="Unable to load knowledge" retry={() => void status.refetch()} />;
  return (
    <section
      className="knowledge-page knowledge-detail-page"
      aria-labelledby="knowledge-source-title"
    >
      <header className="knowledge-detail-header">
        <div className="knowledge-source-heading">
          <Link to="/knowledge" className="knowledge-back" aria-label="Back to knowledge">
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <h1 id="knowledge-source-title">{source.data.name}</h1>
          <KnowledgeStatus status={updating ? 'generating' : (status.data?.status ?? 'empty')} />
        </div>
        {canManage && (
          <Button
            variant={hasSchema ? 'secondary' : 'primary'}
            isPending={Boolean(updating)}
            isDisabled={Boolean(updating)}
            onPress={() => generate.mutate()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {updating ? 'Updating…' : hasSchema ? 'Refresh schema' : 'Generate schema'}
          </Button>
        )}
      </header>
      {generate.isError && (
        <p role="alert" className="knowledge-inline-error">
          {(generate.error as unknown as AppError)?.message ||
            'Unable to refresh the schema. Please try again.'}
        </p>
      )}
      <Tabs
        className="knowledge-tabs"
        variant="secondary"
        selectedKey={activeTab}
        onSelectionChange={(key) => setActiveTab(String(key))}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Knowledge sections">
            <Tabs.Tab id="explorer">
              Schema explorer
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="annotations">
              Business knowledge
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="explorer">
          {!hasSchema ? (
            <div className="knowledge-empty">
              <h2>{updating ? 'Preparing your schema' : 'Schema not set up yet'}</h2>
              <p>
                {updating
                  ? 'You can leave this page while the schema updates.'
                  : canManage
                    ? 'Generate the schema to browse tables, views, and columns.'
                    : 'Ask a workspace admin to generate the schema.'}
              </p>
            </div>
          ) : documents.isError ? (
            <PageError
              title="Unable to load tables and views"
              retry={() => void documents.refetch()}
            />
          ) : documents.isLoading ? (
            <PageLoading label="Loading tables and views…" />
          ) : (
            <KnowledgeDocumentsPanel
              search={search}
              onSearchChange={setSearch}
              documents={filteredDocuments}
              selectedDocumentId={selectedDocumentId}
              onSelectDocument={setSelection}
              detail={detail.data}
              detailLoading={detail.isLoading}
              detailError={detail.isError}
              onRetryDetail={() => void detail.refetch()}
            />
          )}
        </Tabs.Panel>
        <Tabs.Panel id="annotations">
          {annotations.isLoading ? (
            <PageLoading label="Loading business knowledge…" />
          ) : annotations.isError ? (
            <PageError
              title="Unable to load business knowledge"
              retry={() => void annotations.refetch()}
            />
          ) : (
            <BusinessKnowledgePanel
              annotations={annotations.data ?? []}
              canManage={canManage}
              onCreate={createAnnotation}
              onUpdate={updateAnnotation}
              onDelete={deleteAnnotation}
            />
          )}
        </Tabs.Panel>
      </Tabs>
    </section>
  );
}

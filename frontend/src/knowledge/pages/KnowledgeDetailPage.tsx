import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { BrainCircuit, RefreshCw, ArrowLeft } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { PageState } from '../../components/PageState';
import { StatusChip } from '../../components/StatusChip';
import { notifications } from '../../components/notifications';
import { getDataSource } from '../../data-sources/api/data-source-api';
import { useJobManager } from '../../jobs/JobManagerProvider';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/knowledge-api';
import { BusinessKnowledgePanel } from '../components/BusinessKnowledgePanel';
import { KnowledgeDocumentsPanel } from '../components/KnowledgeDocumentsPanel';
import { KnowledgeSummary } from '../components/KnowledgeSummary';
import { KnowledgeVersionsTable } from '../components/KnowledgeVersionsTable';
import { MarkdownDocument } from '../components/MarkdownDocument';
import type { AnnotationValues } from '../schemas/annotation-schema';

export function KnowledgeDetailPage() {
  const { dataSourceId = '' } = useParams();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const jobs = useJobManager();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const source = useQuery({
    queryKey: queryKeys.dataSources.detail(orgId, dataSourceId),
    queryFn: () => getDataSource(dataSourceId),
    enabled: Boolean(dataSourceId),
  });
  const status = useQuery({
    queryKey: queryKeys.knowledge.status(orgId, dataSourceId),
    queryFn: () => api.getStatus(dataSourceId),
    enabled: Boolean(dataSourceId),
  });
  const ready = status.data?.status === 'ready';
  const index = useQuery({
    queryKey: queryKeys.knowledge.index(orgId, dataSourceId),
    queryFn: () => api.getIndex(dataSourceId),
    enabled: ready,
  });
  const documents = useQuery({
    queryKey: queryKeys.knowledge.documents(orgId, dataSourceId, ''),
    queryFn: () => api.listDocuments(dataSourceId, 'table_schema', 500),
    enabled: ready,
  });
  const detail = useQuery({
    queryKey: queryKeys.knowledge.document(orgId, dataSourceId, selectedDocumentId ?? ''),
    queryFn: () => api.getDocument(dataSourceId, selectedDocumentId!),
    enabled: Boolean(selectedDocumentId),
  });
  const annotations = useQuery({
    queryKey: queryKeys.knowledge.annotations(orgId, dataSourceId),
    queryFn: () => api.listAnnotations(dataSourceId),
    enabled: Boolean(dataSourceId),
  });
  const versions = useQuery({
    queryKey: queryKeys.knowledge.versions(orgId, dataSourceId),
    queryFn: () => api.listVersions(dataSourceId),
    enabled: ready,
  });

  const generate = useMutation({
    mutationFn: () => api.generate(dataSourceId),
    onSuccess: async (result) => {
      await jobs.registerJob(result.job_id);
      notifications.info('Knowledge generation started');
    },
  });

  const filteredDocuments = useMemo(
    () =>
      documents.data?.filter((document) =>
        `${document.title} ${document.document_key}`.toLowerCase().includes(search.toLowerCase())
      ) ?? [],
    [documents.data, search]
  );

  const invalidateAnnotations = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.knowledge.annotations(orgId, dataSourceId),
    });

  const createAnnotation = async (values: AnnotationValues) => {
    await api.createAnnotation(dataSourceId, {
      scope_type: values.scopeType,
      scope_key: values.scopeType === 'datasource' ? null : values.scopeKey,
      content: values.content,
    });
    await invalidateAnnotations();
    notifications.success('Business knowledge added');
  };

  const updateAnnotation = async (annotationId: string, content: string) => {
    await api.updateAnnotation(annotationId, { content });
    await invalidateAnnotations();
  };

  const deleteAnnotation = async (annotationId: string) => {
    await api.deleteAnnotation(annotationId);
    await invalidateAnnotations();
  };

  if (source.isLoading || status.isLoading) return <PageState title="Loading knowledge base" loading />;
  if (source.isError || !source.data) return <PageState title="Data source not found" />;

  return (
    <section className="page max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <Link
            to="/knowledge"
            className="inline-flex items-center gap-1 text-xs text-[#8B848C] hover:text-[#4B123F] mb-1 font-medium"
          >
            <ArrowLeft size={12} />
            <span>Back to Knowledge</span>
          </Link>
          <div className="flex items-center gap-2">
            <BrainCircuit size={22} className="text-[#4B123F]" />
            <h1 className="text-xl font-semibold text-[#252127]">{source.data.name} Knowledge Base</h1>
          </div>
          <p className="text-xs text-[#625C64]">
            Schema index, semantic table documentation, and business domain annotations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusChip status={status.data?.status ?? 'empty'} />
          {canManage && (
            <button
              type="button"
              disabled={generate.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#4B123F] hover:bg-[#3F0E35] text-[#FFF9FD] rounded text-xs font-semibold transition-colors disabled:opacity-50"
              onClick={() => generate.mutate()}
            >
              <RefreshCw size={13} className={generate.isPending ? 'animate-spin' : ''} />
              <span>{ready ? 'Regenerate Knowledge' : 'Generate Knowledge'}</span>
            </button>
          )}
        </div>
      </div>

      <KnowledgeSummary status={status.data} />

      {!ready ? (
        <PageState
          title={status.data?.status === 'generating' ? 'Knowledge is generating' : 'Knowledge not generated'}
          description="Generation runs as a durable background job and continues if you leave this page."
        />
      ) : (
        <>
          <div className="p-4 bg-[#FFFDFC] border border-[#DAD5CD] rounded-md my-4">
            <h2 className="text-sm font-semibold text-[#252127] pb-2 mb-3 border-b border-[#E7E3DC]">
              Compact Index
            </h2>
            {index.isLoading ? (
              <PageState title="Loading index" loading />
            ) : index.data ? (
              <MarkdownDocument>{index.data.content_markdown}</MarkdownDocument>
            ) : (
              <p className="text-xs text-[#8B848C]">Index unavailable.</p>
            )}
          </div>

          <KnowledgeDocumentsPanel
            search={search}
            onSearchChange={setSearch}
            documents={filteredDocuments}
            selectedDocumentId={selectedDocumentId}
            onSelectDocument={setSelectedDocumentId}
            detail={detail.data}
            detailLoading={detail.isLoading}
          />
        </>
      )}

      <BusinessKnowledgePanel
        annotations={annotations.data ?? []}
        canManage={canManage}
        onCreate={createAnnotation}
        onUpdate={updateAnnotation}
        onDelete={deleteAnnotation}
      />

      {ready ? <KnowledgeVersionsTable versions={versions.data ?? []} /> : null}
    </section>
  );
}

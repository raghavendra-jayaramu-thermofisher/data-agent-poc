import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import {
  BrainCircuit,
  RefreshCw,
  ArrowLeft,
  Database,
  BookOpen,
  FileText,
  Copy,
  Check,
} from 'lucide-react';
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
import '../knowledge.css';

type KnowledgeTab = 'explorer' | 'annotations' | 'index';

export function KnowledgeDetailPage() {
  const { dataSourceId = '' } = useParams();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const jobs = useJobManager();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<KnowledgeTab>('explorer');
  const [search, setSearch] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState(false);

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

  const handleCopyIndexMarkdown = async () => {
    if (!index.data?.content_markdown) return;
    try {
      await navigator.clipboard.writeText(index.data.content_markdown);
      setCopiedIndex(true);
      setTimeout(() => setCopiedIndex(false), 2000);
    } catch {
      // ignore
    }
  };

  if (source.isLoading || status.isLoading) return <PageState title="Loading knowledge base" loading />;
  if (source.isError || !source.data) return <PageState title="Data source not found" />;

  const schemaCount = documents.data?.length ?? status.data?.object_count ?? 0;
  const annotationCount = annotations.data?.length ?? 0;
  const versionLabel = status.data?.current_version_number != null ? `v${status.data.current_version_number}` : '—';

  return (
    <section className="page max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="page-header mb-4">
        <div>
          <Link
            to="/knowledge"
            className="inline-flex items-center gap-1.5 text-xs text-[var(--db-text-muted)] hover:text-[var(--db-primary)] mb-2 font-medium transition-colors"
          >
            <ArrowLeft size={13} />
            <span>Knowledge Bases</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--db-primary-soft)] text-[var(--db-primary)]">
              <BrainCircuit size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--db-text-primary)] leading-tight">
                {source.data.name} Knowledge Base
              </h1>
              <p className="text-xs text-[var(--db-text-secondary)] mt-0.5">
                Schema index, semantic table documentation, and business domain annotations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <StatusChip status={status.data?.status ?? 'empty'} />
          {canManage && (
            <button
              type="button"
              disabled={generate.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded-md text-xs font-semibold transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              onClick={() => generate.mutate()}
            >
              <RefreshCw size={13} className={generate.isPending ? 'animate-spin' : ''} />
              <span>{ready ? 'Regenerate Knowledge' : 'Generate Knowledge'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modern Stat Bar */}
      <KnowledgeSummary status={status.data} />

      {/* Tabs Navigation */}
      <nav className="knowledge-tabs-nav" aria-label="Knowledge sections">
        <button
          type="button"
          className={`knowledge-tab-item ${activeTab === 'explorer' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          <Database size={14} />
          <span>Schema Explorer</span>
          <span className="knowledge-tab-badge">{schemaCount}</span>
        </button>

        <button
          type="button"
          className={`knowledge-tab-item ${activeTab === 'annotations' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('annotations')}
        >
          <BookOpen size={14} />
          <span>Business Knowledge</span>
          <span className="knowledge-tab-badge">{annotationCount}</span>
        </button>

        <button
          type="button"
          className={`knowledge-tab-item ${activeTab === 'index' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('index')}
        >
          <FileText size={14} />
          <span>Raw Index & Versions</span>
          <span className="knowledge-tab-badge">{versionLabel}</span>
        </button>
      </nav>

      {/* Tab 1: Schema Explorer */}
      {activeTab === 'explorer' && (
        !ready ? (
          <PageState
            title={status.data?.status === 'generating' ? 'Knowledge is generating' : 'Knowledge not generated'}
            description="Generation runs as a durable background job and continues if you leave this page."
          />
        ) : (
          <KnowledgeDocumentsPanel
            search={search}
            onSearchChange={setSearch}
            documents={filteredDocuments}
            totalCount={documents.data?.length ?? 0}
            selectedDocumentId={selectedDocumentId}
            onSelectDocument={setSelectedDocumentId}
            detail={detail.data}
            detailLoading={detail.isLoading}
          />
        )
      )}

      {/* Tab 2: Business Knowledge Annotations */}
      {activeTab === 'annotations' && (
        <BusinessKnowledgePanel
          annotations={annotations.data ?? []}
          canManage={canManage}
          onCreate={createAnnotation}
          onUpdate={updateAnnotation}
          onDelete={deleteAnnotation}
        />
      )}

      {/* Tab 3: Raw Index & Versions */}
      {activeTab === 'index' && (
        !ready ? (
          <PageState
            title={status.data?.status === 'generating' ? 'Knowledge is generating' : 'Knowledge not generated'}
            description="Generation runs as a durable background job and continues if you leave this page."
          />
        ) : (
          <div className="space-y-5">
            {/* Compact Index Card */}
            <div className="compact-index-card">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-[var(--db-border-subtle)]">
                <div>
                  <h2 className="text-base font-semibold text-[var(--db-text-primary)] m-0 leading-tight">
                    Compact Schema Index
                  </h2>
                  <p className="text-xs text-[var(--db-text-muted)] mt-0.5">
                    Concise schema summary formatted for LLM system prompt context.
                  </p>
                </div>
                {index.data?.content_markdown && (
                  <button
                    type="button"
                    onClick={handleCopyIndexMarkdown}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[var(--db-surface)] hover:bg-[var(--db-surface-hover)] text-[var(--db-text-secondary)] hover:text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded-md transition-colors cursor-pointer"
                  >
                    {copiedIndex ? (
                      <>
                        <Check size={12} className="text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy Markdown</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {index.isLoading ? (
                <PageState title="Loading index…" loading />
              ) : index.data ? (
                <div className="compact-index-body">
                  <MarkdownDocument>{index.data.content_markdown}</MarkdownDocument>
                </div>
              ) : (
                <p className="text-xs text-[var(--db-text-muted)] py-4 text-center">Index unavailable.</p>
              )}
            </div>

            {/* Version History Table */}
            <KnowledgeVersionsTable versions={versions.data ?? []} />
          </div>
        )
      )}
    </section>
  );
}

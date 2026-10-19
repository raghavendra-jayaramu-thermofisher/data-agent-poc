import { Button } from '@heroui/react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ChevronRight, Database, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { queryKeys } from '../../api/queryKeys';
import { PageError, PageLoading } from '../../components/PageState';
import { listDataSources } from '../../data-sources/api/data-source-api';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/knowledge-api';
import { KnowledgeStatus } from '../components/KnowledgeStatus';
import '../knowledge.css';

export function KnowledgePage() {
  const navigate = useNavigate();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';
  const [search, setSearch] = useState('');
  const sources = useQuery({
    queryKey: queryKeys.dataSources.list(orgId),
    queryFn: listDataSources,
    enabled: Boolean(orgId),
  });
  const statuses = useQueries({
    queries: (sources.data ?? []).map((source) => ({
      queryKey: queryKeys.knowledge.status(orgId, source.id),
      queryFn: () => api.getStatus(source.id),
      enabled: Boolean(orgId),
    })),
  });
  if (sources.isLoading) return <PageLoading label="Loading knowledge…" />;
  if (sources.isError)
    return (
      <PageError
        title="Unable to load knowledge"
        message="Check your connection and try again."
        retry={() => void sources.refetch()}
      />
    );
  const visible = (sources.data ?? [])
    .map((source, index) => ({ source, status: statuses[index] }))
    .filter(({ source }) =>
      source.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
    );
  return (
    <section className="knowledge-page" aria-labelledby="knowledge-title">
      <header className="knowledge-page-header">
        <h1 id="knowledge-title">Knowledge</h1>
        <div className="knowledge-search db-icon-search" role="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            className="db-icon-search__input"
            aria-label="Search data sources"
            placeholder="Search data sources…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search && (
            <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      {!sources.data?.length ? (
        <div className="knowledge-empty">
          <Database size={28} aria-hidden="true" />
          <h2>No data sources yet</h2>
          <p>
            {canManage
              ? 'Connect a data source to explore its schema and add business knowledge.'
              : 'Ask a workspace admin to connect a data source.'}
          </p>
          {canManage && (
            <Button variant="primary" onPress={() => void navigate('/data-sources/new')}>
              <Plus size={15} aria-hidden="true" />
              Add data source
            </Button>
          )}
        </div>
      ) : visible.length === 0 ? (
        <div className="knowledge-empty">
          <Search size={24} aria-hidden="true" />
          <h2>No matching data sources</h2>
          <Button variant="secondary" onPress={() => setSearch('')}>
            Clear search
          </Button>
        </div>
      ) : (
        <div className="knowledge-source-list">
          {visible.map(({ source, status }) => (
            <Link className="knowledge-source-row" key={source.id} to={'/knowledge/' + source.id}>
              <span className="knowledge-source-icon">
                <Database size={17} aria-hidden="true" />
              </span>
              <span className="knowledge-source-name">{source.name}</span>
              <KnowledgeStatus
                status={
                  status?.isError
                    ? 'unavailable'
                    : (status?.data?.status ?? (status?.isLoading ? 'loading' : 'empty'))
                }
              />
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

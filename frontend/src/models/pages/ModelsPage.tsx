import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import { Cpu, Plus, Key, Sparkles, CheckCircle2 } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { PageState } from '../../components/PageState';
import { StatusChip } from '../../components/StatusChip';
import { formatLocalDateTime } from '../../lib/datetime';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/models-api';

export function ModelsPage() {
  const navigate = useNavigate();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const canManage = activeOrganization?.role === 'owner' || activeOrganization?.role === 'admin';

  const connections = useQuery({
    queryKey: queryKeys.models.connections(orgId),
    queryFn: api.listConnections,
    enabled: Boolean(orgId),
  });

  const profiles = useQuery({
    queryKey: queryKeys.models.profiles(orgId),
    queryFn: api.listProfiles,
    enabled: Boolean(orgId),
  });

  if ((connections.isLoading || profiles.isLoading) && !connections.data && !profiles.data) {
    return <PageState title="Loading model configuration" loading />;
  }

  if (connections.isError || profiles.isError) {
    return (
      <PageState
        title="Unable to load model configuration"
        description="Check your connection and try again."
      />
    );
  }

  return (
    <section className="page max-w-6xl mx-auto">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={20} className="text-[var(--db-primary)]" />
            <h1 className="text-xl font-semibold text-[var(--db-text-primary)]">Model Connections & Profiles</h1>
          </div>
          <p className="text-xs text-[var(--db-text-secondary)]">
            OpenAI-compatible LLM endpoints and reasoning profiles used for SQL query generation.
          </p>
        </div>
      </div>

      {/* Connections Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--db-border-default)]">
          <h2 className="text-sm font-semibold text-[var(--db-text-primary)]">Endpoints & Connections</h2>
          {canManage && (
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--db-primary)] hover:bg-[var(--db-primary-hover)] text-[var(--db-on-primary)] rounded text-xs font-semibold"
              onClick={() => navigate('/models/connections/new')}
            >
              <Plus size={13} />
              <span>Add Connection</span>
            </button>
          )}
        </div>

        {connections.data?.length ? (
          <div className="analytical-table-shell">
            <table className="analytical-table" aria-label="Model connections">
              <thead>
                <tr>
                  <th>Connection Name</th>
                  <th>Status</th>
                  <th>API Key</th>
                  <th>Last Tested</th>
                </tr>
              </thead>
              <tbody>
                {connections.data.map((connection) => (
                  <tr key={connection.id}>
                    <td>
                      <Link
                        to={`/models/connections/${connection.id}`}
                        className="font-medium text-[var(--db-primary)] hover:underline"
                      >
                        {connection.name}
                      </Link>
                      <div className="text-[11px] text-[var(--db-text-muted)] font-mono">{connection.base_url}</div>
                    </td>
                    <td>
                      <StatusChip status={connection.status} />
                    </td>
                    <td className="text-xs text-[var(--db-text-secondary)]">
                      {connection.has_api_key ? (
                        <span className="inline-flex items-center gap-1 text-[var(--db-success)]">
                          <Key size={11} /> Stored securely
                        </span>
                      ) : (
                        'Not configured'
                      )}
                    </td>
                    <td className="text-xs text-[var(--db-text-secondary)]">
                      {connection.last_tested_at ? formatLocalDateTime(connection.last_tested_at) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <PageState
            title="No model connections"
            description="Add an OpenAI-compatible endpoint before creating a model profile."
          />
        )}
      </div>

      {/* Profiles Section */}
      <div>
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--db-border-default)]">
          <h2 className="text-sm font-semibold text-[var(--db-text-primary)]">Model Profiles</h2>
          {canManage && connections.data?.length ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--db-surface-raised)] hover:bg-[var(--db-surface-muted)] text-[var(--db-text-primary)] border border-[var(--db-border-default)] rounded text-xs font-medium"
              onClick={() => navigate('/models/profiles/new')}
            >
              <Plus size={13} />
              <span>Add Profile</span>
            </button>
          ) : null}
        </div>

        {profiles.data?.length ? (
          <div className="analytical-table-shell">
            <table className="analytical-table" aria-label="Model profiles">
              <thead>
                <tr>
                  <th>Profile Name</th>
                  <th>Model Identifier</th>
                  <th>State</th>
                  <th>Default</th>
                </tr>
              </thead>
              <tbody>
                {profiles.data.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <Link
                        to={`/models/profiles/${profile.id}`}
                        className="font-medium text-[var(--db-primary)] hover:underline flex items-center gap-1.5"
                      >
                        <Sparkles size={12} className="text-[var(--db-text-muted)]" />
                        <span>{profile.display_name}</span>
                      </Link>
                    </td>
                    <td className="font-mono text-xs text-[var(--db-text-primary)]">{profile.model_name}</td>
                    <td>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[11px] font-medium ${
                          profile.enabled
                            ? 'bg-[var(--db-success-soft)] text-[var(--db-success)]'
                            : 'bg-[var(--db-surface-muted)] text-[var(--db-text-muted)]'
                        }`}
                      >
                        {profile.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      {profile.is_default ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[11px] font-semibold bg-[var(--db-signal-soft)] text-[var(--db-warning)]">
                          <CheckCircle2 size={11} /> Default
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[var(--db-text-muted)] p-4 bg-[var(--db-surface-raised)] border border-[var(--db-border-default)] rounded">
            No profiles configured.
          </p>
        )}
      </div>
    </section>
  );
}

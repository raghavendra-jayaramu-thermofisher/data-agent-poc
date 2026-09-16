import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { queryKeys } from '../../api/queryKeys';
import { useAuth } from '../../auth/AuthProvider';
import { PageState } from '../../components/PageState';
import { listDataSources } from '../../data-sources/api/data-source-api';
import { preferences } from '../../lib/preferences';
import { listProfiles } from '../../models/api/models-api';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/conversation-api';
import { ChatComposer } from '../components/ChatComposer';
import { deriveConversationTitle } from '../utils/title';

type PendingConversationState = { pendingQuestion: string; modelProfileId: string | null };

export function AskPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  const dataSources = useQuery({
    queryKey: queryKeys.dataSources.list(orgId),
    queryFn: listDataSources,
    enabled: Boolean(orgId),
  });

  const profiles = useQuery({
    queryKey: queryKeys.models.profiles(orgId),
    queryFn: listProfiles,
    enabled: Boolean(orgId),
  });

  const [question, setQuestion] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(() => {
    return preferences.get('lastSelectedModelProfileId') ?? null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleProfileChange = (id: string | null) => {
    setSelectedProfileId(id);
    preferences.set('lastSelectedModelProfileId', id);
  };

  if (dataSources.isLoading || profiles.isLoading) {
    return <PageState title="Preparing analysis workspace" loading />;
  }

  if (dataSources.isError || profiles.isError) {
    return (
      <PageState
        title="Unable to prepare Ask"
        description="Data sources or model profiles could not be loaded."
      />
    );
  }

  const activeSources = (dataSources.data ?? []).filter((source) => source.status === 'active');
  const enabledProfiles = (profiles.data ?? []).filter((profile) => profile.enabled);
  const effectiveProfileId = enabledProfiles.some((profile) => profile.id === selectedProfileId)
    ? selectedProfileId
    : null;

  const handleSubmit = async () => {
    if (!question.trim() || isSubmitting || selectedSourceIds.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const conversation = await api.createConversation({
        data_source_ids: selectedSourceIds,
        model_profile_id: effectiveProfileId,
        title: deriveConversationTitle(question),
      });

      const state: PendingConversationState = {
        pendingQuestion: question,
        modelProfileId: effectiveProfileId,
      };

      navigate(`/conversations/${conversation.id}`, { state });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to start conversation.');
      setIsSubmitting(false);
    }
  };

  const displayName = user?.display_name?.trim() || user?.email.split('@')[0] || 'there';
  const firstName = displayName.split(/\s+/)[0] || 'there';

  return (
    <div className="chat-workspace chat-workspace--empty">
      <main className="chat-empty-state">
        <div className="chat-empty-state__welcome">
          <p className="chat-empty-state__greeting">Hi {firstName}</p>
          <h1>What would you like to know about your data?</h1>
        </div>
        <div className="w-full max-w-3xl mx-auto">
          {submitError && (
            <div className="p-3 mb-4 bg-[#F7E7E5] border border-[#DAD5CD] rounded text-xs text-[#A84545]" role="alert">
              {submitError}
            </div>
          )}
          {activeSources.length === 0 && (
            <div className="p-4 mb-6 bg-[#F8EDCF] border border-[#DAD5CD] rounded text-xs text-[#8C5A00]">
              No active data sources found. Connect or activate a data source to begin.
            </div>
          )}
        </div>
        <ChatComposer
          question={question}
          onQuestionChange={setQuestion}
          onSubmit={handleSubmit}
          dataSources={activeSources}
          selectedDataSourceIds={selectedSourceIds}
          onDataSourceIdsChange={setSelectedSourceIds}
          profiles={enabledProfiles}
          selectedProfileId={effectiveProfileId}
          onProfileIdChange={handleProfileChange}
          isSubmitting={isSubmitting}
          disabled={activeSources.length === 0}
          placement="inline"
        />
      </main>
    </div>
  );
}

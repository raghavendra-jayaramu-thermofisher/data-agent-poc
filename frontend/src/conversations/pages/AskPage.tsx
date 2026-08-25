import { useQuery } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  Sparkles,
  TrendingUp,
  Users,
  ShoppingBag,
  BarChart3,
  Database,
  ArrowRight,
} from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { PageState } from '../../components/PageState';
import { listDataSources } from '../../data-sources/api/data-source-api';
import { preferences } from '../../lib/preferences';
import { listProfiles } from '../../models/api/models-api';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/conversation-api';
import { ChatComposer } from '../components/ChatComposer';
import { deriveConversationTitle } from '../utils/title';

type PendingConversationState = { pendingQuestion: string; modelProfileId: string | null };

const SUGGESTIONS = [
  {
    icon: TrendingUp,
    title: 'Revenue & Monthly Trend',
    prompt: 'Show total revenue and transaction count grouped by month in ascending order.',
  },
  {
    icon: Users,
    title: 'Top Performing Courses',
    prompt: 'Which courses generate the highest total revenue from payments?',
  },
  {
    icon: ShoppingBag,
    title: 'Transaction Breakdown',
    prompt: 'Show recent transactions with course names, amounts, and dates.',
  },
  {
    icon: BarChart3,
    title: 'Payment Distribution',
    prompt: 'Give me a monthly revenue summary with a comparison chart.',
  },
];

export function AskPage() {
  const navigate = useNavigate();
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
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const restoredPreference = useRef(false);

  // Restore saved data source selection
  useEffect(() => {
    if (restoredPreference.current || !dataSources.data) return;
    restoredPreference.current = true;
    const savedIds = preferences.get('lastAskDataSourceIds') ?? [];
    const activeIds = new Set(
      dataSources.data.filter((source) => source.status === 'active').map((source) => source.id)
    );
    const validSaved = savedIds.filter((id) => activeIds.has(id));
    if (validSaved.length > 0) {
      setSelectedSourceIds(validSaved.slice(0, 10));
    } else {
      // Default to first active source if available
      const firstActive = dataSources.data.find((s) => s.status === 'active');
      if (firstActive) setSelectedSourceIds([firstActive.id]);
    }
  }, [dataSources.data]);

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

  const handleSubmit = async () => {
    if (!question.trim() || isSubmitting || activeSources.length === 0) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // If user selected none, use all active sources (or first active)
      const targetSourceIds =
        selectedSourceIds.length > 0 ? selectedSourceIds : activeSources.map((s) => s.id);
      preferences.set('lastAskDataSourceIds', targetSourceIds);

      const conversation = await api.createConversation({
        data_source_ids: targetSourceIds,
        model_profile_id: selectedProfileId || null,
        title: deriveConversationTitle(question),
      });

      const state: PendingConversationState = {
        pendingQuestion: question,
        modelProfileId: selectedProfileId || null,
      };

      navigate(`/conversations/${conversation.id}`, { state });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to start conversation.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="chat-workspace">
      <div className="chat-main-scroll">
        <div className="chat-landing">
          <div className="chat-landing-badge">
            <Sparkles size={12} />
            <span>DB Assistant</span>
          </div>

          <h1>Ask your data anything</h1>
          <p>
            Natural language queries translated to verified read-only SQL with interactive tables and charts.
          </p>

          {/* Active Data Sources Bar */}
          {activeSources.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              <span className="text-xs text-[#625C64] font-medium flex items-center gap-1">
                <Database size={12} />
                <span>Connected:</span>
              </span>
              {activeSources.map((src) => (
                <span
                  key={src.id}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#FFFDFC] border border-[#DAD5CD] rounded text-xs text-[#252127]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#32745A]" />
                  <strong className="font-medium">{src.name}</strong>
                  <span className="text-[10px] text-[#625C64] uppercase">{src.display_type}</span>
                </span>
              ))}
            </div>
          ) : (
            <div className="p-4 mb-6 bg-[#F8EDCF] border border-[#DAD5CD] rounded text-xs text-[#8C5A00]">
              No active data sources found. Connect or activate a data source to begin.
            </div>
          )}

          {/* Analytical Prompt Suggestions Grid */}
          <div className="chat-suggestions-grid">
            {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
              <div
                key={title}
                className="chat-suggestion-card group"
                onClick={() => {
                  setQuestion(prompt);
                }}
              >
                <div className="flex items-center justify-between">
                  <strong>
                    <Icon size={14} className="text-[#4B123F]" />
                    <span>{title}</span>
                  </strong>
                  <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 text-[#4B123F] transition-opacity" />
                </div>
                <span>{prompt}</span>
              </div>
            ))}
          </div>

          {submitError && (
            <div className="p-3 mb-4 bg-[#F7E7E5] border border-[#DAD5CD] rounded text-xs text-[#A84545]" role="alert">
              {submitError}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom ChatGPT Composer Deck */}
      <ChatComposer
        question={question}
        onQuestionChange={setQuestion}
        onSubmit={handleSubmit}
        dataSources={activeSources}
        selectedDataSourceIds={selectedSourceIds}
        onDataSourceIdsChange={setSelectedSourceIds}
        profiles={enabledProfiles}
        selectedProfileId={selectedProfileId}
        onProfileIdChange={setSelectedProfileId}
        isSubmitting={isSubmitting}
        disabled={activeSources.length === 0}
      />
    </div>
  );
}

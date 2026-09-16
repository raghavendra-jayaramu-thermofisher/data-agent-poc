import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { Database, LockKeyhole, Trash2 } from 'lucide-react';
import { queryKeys } from '../../api/queryKeys';
import { PageError, PageLoading, PageState } from '../../components/PageState';
import { listDataSources } from '../../data-sources/api/data-source-api';
import { listProfiles } from '../../models/api/models-api';
import { useJobManager } from '../../jobs/JobManagerProvider';
import { isActiveJobStatus, isTerminalJobStatus } from '../../jobs/types';
import { useOrganization } from '../../organizations/OrganizationProvider';
import type { ConversationMessage as Message } from '../api/conversation-api';
import * as api from '../api/conversation-api';
import { AnalysisFailure } from '../components/AnalysisFailure';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { ConversationMessage } from '../components/ConversationMessage';
import { ChatComposer } from '../components/ChatComposer';
import { useConversation, useConversationMessages, useDeleteConversation } from '../hooks/useConversations';

type PendingConversationState = { pendingQuestion?: string; modelProfileId?: string | null } | null;

function errorMessage(error: unknown) {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'Unable to submit the question.';
}

export function ConversationPage() {
  const { conversationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  const conversation = useConversation(conversationId);
  const messages = useConversationMessages(conversationId);
  const deleteConversationMutation = useDeleteConversation();
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

  const jobManager = useJobManager();
  const pendingStarted = useRef(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [initialSubmitError, setInitialSubmitError] = useState<string | null>(null);

  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const conversationJobs = useMemo(
    () =>
      jobManager.jobs
        .filter((entry) => entry.job.conversation_id === conversationId)
        .sort((a, b) => Date.parse(a.job.created_at) - Date.parse(b.job.created_at)),
    [conversationId, jobManager.jobs]
  );

  const activeRunningJob = conversationJobs.find((entry) => isActiveJobStatus(entry.job.status));

  const appendOptimisticMessage = useCallback(
    (accepted: api.MessageAccepted, content: string) => {
      if (!conversationId) return;
      queryClient.setQueryData<Message[]>(
        queryKeys.conversations.messages(orgId, conversationId),
        (current = []) => {
          if (current.some((message) => message.id === accepted.message_id)) return current;
          return [
            ...current,
            {
              id: accepted.message_id,
              conversation_id: conversationId,
              role: 'user',
              content,
              job_id: accepted.job_id,
              metadata: {},
              created_at: new Date().toISOString(),
            },
          ];
        }
      );
    },
    [conversationId, orgId, queryClient]
  );

  const submit = useCallback(
    async (content: string, modelProfileId?: string | null) => {
      if (!conversationId) throw new Error('Conversation ID is missing.');
      setIsSubmitting(true);
      try {
        const accepted = await api.submitMessage(conversationId, {
          content,
          model_profile_id: modelProfileId ?? null,
        });
        appendOptimisticMessage(accepted, content);
        await jobManager.registerJob(accepted.job_id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list(orgId) });
        setFollowUpQuestion('');
      } finally {
        setIsSubmitting(false);
      }
    },
    [appendOptimisticMessage, conversationId, jobManager, orgId, queryClient]
  );

  useEffect(() => {
    const state = location.state as PendingConversationState;
    if (!conversationId || !state?.pendingQuestion || pendingStarted.current) return;
    pendingStarted.current = true;
    const content = state.pendingQuestion;
    const modelProfileId = state.modelProfileId ?? null;
    navigate(location.pathname, { replace: true, state: null });
    void submit(content, modelProfileId).catch((error) =>
      setInitialSubmitError(errorMessage(error))
    );
  }, [conversationId, location.pathname, location.state, navigate, submit]);

  // Auto-scroll when new messages or active job arrives
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data?.length, activeRunningJob?.job.id]);

  if (!conversationId) {
    return <PageError title="Conversation not found" message="The conversation identifier is missing." />;
  }
  if (conversation.isLoading || messages.isLoading) {
    return <PageLoading label="Loading conversation…" />;
  }
  if (conversation.isError) {
    return (
      <PageError
        title="Conversation unavailable"
        message="It may not exist in this workspace, or you may no longer have access."
        retry={() => void conversation.refetch()}
      />
    );
  }
  if (messages.isError) {
    return (
      <PageError
        title="Unable to load messages"
        message="The durable conversation exists, but its messages could not be loaded."
        retry={() => void messages.refetch()}
      />
    );
  }

  const sourceMap = new Map((dataSources.data ?? []).map((source) => [source.id, source]));
  const scopedSources = (conversation.data?.data_source_ids ?? [])
    .map((id) => sourceMap.get(id))
    .filter(Boolean);

  const durableMessages = messages.data ?? [];
  const assistantJobIds = new Set(
    durableMessages.filter((message) => message.role === 'assistant' && message.job_id).map((message) => message.job_id)
  );
  const jobsById = new Map(conversationJobs.map((entry) => [entry.job.id, entry]));
  const insertedJobs = new Set<string>();

  const messageTimeline = durableMessages.flatMap((message) => {
    const items = [
      <ConversationMessage
        key={message.id}
        message={message}
        onFollowUp={(q) => void submit(q, selectedProfileId)}
      />,
    ];
    if (message.role !== 'user' || !message.job_id || assistantJobIds.has(message.job_id)) return items;
    const entry = jobsById.get(message.job_id);
    if (!entry) return items;
    insertedJobs.add(entry.job.id);
    if (isActiveJobStatus(entry.job.status)) {
      items.push(
        <AnalysisProgress
          key={`progress-${entry.job.id}`}
          managedJob={entry}
          onCancel={() => void jobManager.cancel(entry.job.id)}
        />
      );
    } else if (isTerminalJobStatus(entry.job.status) && entry.job.status !== 'succeeded') {
      items.push(<AnalysisFailure key={`failure-${entry.job.id}`} job={entry.job} />);
    }
    return items;
  });

  const unmatchedJobs = conversationJobs.filter(
    (entry) => !insertedJobs.has(entry.job.id) && !assistantJobIds.has(entry.job.id)
  );

  return (
    <div className="chat-workspace">
      {/* Sticky Compact Conversation Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 px-6 py-2.5 bg-[#F6F4EF]/95 backdrop-blur-sm border-b border-[#DAD5CD]">
        <div className="min-w-0 flex items-center gap-2.5 flex-1">
          <h1 className="text-sm font-semibold text-[#252127] truncate shrink-0 max-w-[320px] md:max-w-[460px]">
            {conversation.data?.title?.trim() || 'Analysis'}
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#625C64] min-w-0">
            <span className="text-[#DAD5CD]">•</span>
            <span className="flex items-center gap-1 text-[11px] text-[#625C64] shrink-0">
              <Database size={11} />
              <span>
                {conversation.data?.data_source_ids?.length ?? 0} source
                {conversation.data?.data_source_ids?.length === 1 ? '' : 's'}:
              </span>
            </span>
            {scopedSources.map((source) =>
              source ? (
                <span
                  key={source.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#F0EEE9] border border-[#DAD5CD] rounded text-[11px] text-[#252127] truncate max-w-[180px]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#32745A] shrink-0" />
                  <span className="truncate">{source.name}</span>
                </span>
              ) : null
            )}
            <span
              className="inline-flex items-center gap-1 text-[11px] text-[#8B848C] shrink-0"
              title="Data source selection is fixed for this conversation"
            >
              <LockKeyhole size={10} />
            </span>
          </div>
        </div>

        <div className="flex items-center flex-shrink-0">
          <button
            type="button"
            className="conversation-header-icon conversation-header-icon--danger"
            aria-label="Delete analysis"
            title="Delete analysis"
            onClick={() => {
              if (conversationId && window.confirm('Are you sure you want to delete this analysis?')) {
                deleteConversationMutation.mutate(conversationId, {
                  onSuccess: () => {
                    navigate('/ask', { replace: true });
                  },
                });
              }
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <div className="chat-main-scroll !pt-5">

        {initialSubmitError && (
          <div className="p-3 mb-4 bg-[#F7E7E5] border border-[#DAD5CD] rounded text-xs text-[#A84545]" role="alert">
            <strong>Question was not submitted</strong>
            <p>{initialSubmitError}</p>
          </div>
        )}

        {/* Message Stream */}
        <div className="chat-message-stream" aria-label="Conversation messages">
          {durableMessages.length ? (
            messageTimeline
          ) : (
            <PageState title="No messages yet" description="Submit a question to begin this analysis." />
          )}

          {unmatchedJobs
            .filter((entry) => isActiveJobStatus(entry.job.status))
            .map((entry) => (
              <AnalysisProgress
                key={`orphan-progress-${entry.job.id}`}
                managedJob={entry}
                onCancel={() => void jobManager.cancel(entry.job.id)}
              />
            ))}

          {unmatchedJobs
            .filter((entry) => isTerminalJobStatus(entry.job.status) && entry.job.status !== 'succeeded')
            .slice(-2)
            .map((entry) => (
              <AnalysisFailure key={`orphan-failure-${entry.job.id}`} job={entry.job} />
            ))}

          <div ref={scrollAnchorRef} />
        </div>
      </div>

      {/* Fixed Bottom ChatGPT Follow-up Composer Deck */}
      <ChatComposer
        question={followUpQuestion}
        onQuestionChange={setFollowUpQuestion}
        onSubmit={() => void submit(followUpQuestion, selectedProfileId)}
        dataSources={(dataSources.data ?? []).filter((s) => s.status === 'active')}
        selectedDataSourceIds={conversation.data?.data_source_ids ?? []}
        onDataSourceIdsChange={() => {}}
        profiles={(profiles.data ?? []).filter((p) => p.enabled)}
        selectedProfileId={selectedProfileId}
        onProfileIdChange={setSelectedProfileId}
        isSubmitting={isSubmitting || Boolean(activeRunningJob)}
        placeholder="Ask a follow-up about this analysis…"
        inputLabel="Ask a follow-up"
        dataSourceSelection="hidden"
      />
    </div>
  );
}

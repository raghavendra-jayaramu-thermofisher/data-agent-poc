import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/conversation-api';
import type { SourceTableScope } from '../components/table-scope';

export type ConversationPages = InfiniteData<api.ConversationPage, unknown>;
export type MessagePages = InfiniteData<api.MessagePage, unknown>;

export function useConversationList(search = '') {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const query = useInfiniteQuery({
    queryKey: queryKeys.conversations.list(orgId, search),
    queryFn: ({ pageParam, signal }) => api.listConversations(search, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    enabled: Boolean(orgId),
    // Keep showing the previous matches while a new search loads.
    placeholderData: keepPreviousData,
  });
  return { ...query, conversations: query.data?.pages.flatMap((page) => page.items) ?? [] };
}

export function useConversation(conversationId: string | undefined) {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  return useQuery({
    queryKey: queryKeys.conversations.detail(orgId, conversationId ?? ''),
    queryFn: () => api.getConversation(conversationId!),
    enabled: Boolean(orgId && conversationId),
  });
}

/** Pages run newest to oldest; `messages` is the loaded tail of the conversation in order. */
export function useConversationMessages(conversationId: string | undefined) {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  const query = useInfiniteQuery({
    queryKey: queryKeys.conversations.messages(orgId, conversationId ?? ''),
    queryFn: ({ pageParam, signal }) => api.listMessages(conversationId!, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    enabled: Boolean(orgId && conversationId),
  });
  return { ...query, messages: loadedMessages(query.data) };
}

export function loadedMessages(data: MessagePages | undefined): api.ConversationMessage[] {
  return data?.pages.toReversed().flatMap((page) => page.items) ?? [];
}

/** Adds a message to the newest loaded page unless it is already present. */
export function appendMessage(
  client: QueryClient,
  orgId: string | null,
  message: api.ConversationMessage,
) {
  client.setQueryData<MessagePages>(
    queryKeys.conversations.messages(orgId, message.conversation_id),
    (current) => {
      if (loadedMessages(current).some((item) => item.id === message.id)) return current;
      const [newest, ...older] = current?.pages ?? [];
      if (!current || !newest)
        return {
          pages: [{ items: [message], next_cursor: null, has_more: false }],
          pageParams: [null],
        };
      return { ...current, pages: [{ ...newest, items: [...newest.items, message] }, ...older] };
    },
  );
}

export function useRenameConversation() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.renameConversation(id, title),
    onSuccess: (updated) => {
      queryClient.setQueryData<api.Conversation>(
        queryKeys.conversations.detail(orgId, updated.id),
        (current) => current ? { ...current, ...updated } : undefined,
      );
      queryClient.setQueriesData<ConversationPages>(
        { queryKey: queryKeys.conversations.lists(orgId) },
        (current) => current && {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => item.id === updated.id ? updated : item),
          })),
        },
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists(orgId) });
    },
  });
}

export function useUpdateTableScope() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  return useMutation({
    mutationFn: ({ id, tableScope }: { id: string; tableScope: SourceTableScope[] }) =>
      api.updateTableScope(id, tableScope),
    onSuccess: (updated) => {
      queryClient.setQueryData<api.Conversation>(
        queryKeys.conversations.detail(orgId, updated.id),
        (current) => current ? { ...current, ...updated } : undefined,
      );
    },
  });
}

export function useDeleteAllConversations() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  return useMutation({
    mutationFn: () => api.deleteAllConversations(),
    onSuccess: () => {
      queryClient.setQueriesData<ConversationPages>(
        { queryKey: queryKeys.conversations.lists(orgId) },
        (current) => current && {
          pages: [{ items: [], next_cursor: null, has_more: false }],
          pageParams: [null],
        },
      );
      queryClient.removeQueries({
        queryKey: queryKeys.conversations.all(orgId),
        predicate: (query) => query.queryKey[2] !== 'list',
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists(orgId) });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  return useMutation({
    mutationFn: (conversationId: string) => api.deleteConversation(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.lists(orgId) });
      queryClient.removeQueries({ queryKey: queryKeys.conversations.detail(orgId, conversationId) });
      queryClient.removeQueries({ queryKey: queryKeys.conversations.messages(orgId, conversationId) });
    },
  });
}

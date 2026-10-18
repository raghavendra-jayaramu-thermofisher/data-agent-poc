import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { useOrganization } from '../../organizations/OrganizationProvider';
import * as api from '../api/conversation-api';

export function useConversationList() {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  return useQuery({
    queryKey: queryKeys.conversations.list(orgId),
    queryFn: api.listConversations,
    enabled: Boolean(orgId),
  });
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

export function useConversationMessages(conversationId: string | undefined) {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;
  return useQuery({
    queryKey: queryKeys.conversations.messages(orgId, conversationId ?? ''),
    queryFn: () => api.listMessages(conversationId!),
    enabled: Boolean(orgId && conversationId),
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id ?? null;

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.renameConversation(id, title),
    onSuccess: (updated) => {
      queryClient.setQueryData<api.ConversationDetail>(
        queryKeys.conversations.detail(orgId, updated.id),
        (current) => current ? { ...current, ...updated } : undefined,
      );
      queryClient.setQueryData<api.Conversation[]>(
        queryKeys.conversations.list(orgId),
        (current) => current?.map((item) => item.id === updated.id ? updated : item),
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list(orgId) });
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
      queryClient.setQueryData(queryKeys.conversations.list(orgId), []);
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list(orgId) });
      queryClient.removeQueries({ queryKey: ['conversations', orgId] });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.list(orgId) });
      queryClient.removeQueries({ queryKey: queryKeys.conversations.detail(orgId, conversationId) });
      queryClient.removeQueries({ queryKey: queryKeys.conversations.messages(orgId, conversationId) });
    },
  });
}

import { useQuery } from '@tanstack/react-query';
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

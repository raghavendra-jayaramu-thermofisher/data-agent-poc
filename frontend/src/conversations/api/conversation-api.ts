import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';

type S = components['schemas'];
export type Conversation = S['ConversationResponse'];
export type ConversationDetail = S['ConversationDetailResponse'];
export type ConversationMessage = S['app__conversations__schemas__MessageResponse'];
export type ConversationCreate = S['ConversationCreate'];
export type MessageCreate = S['MessageCreate'];
export type MessageAccepted = S['MessageAcceptedResponse'];

export function listConversations(): Promise<Conversation[]> {
  return withAuthRefresh(() => apiClient.GET('/api/v1/conversations'));
}

export function createConversation(body: ConversationCreate): Promise<Conversation> {
  return withAuthRefresh(() => apiClient.POST('/api/v1/conversations', { body }));
}

export function getConversation(id: string, messageLimit = 200): Promise<ConversationDetail> {
  return withAuthRefresh(() => apiClient.GET('/api/v1/conversations/{conversation_id}', {
    params: { path: { conversation_id: id }, query: { message_limit: messageLimit } },
  }));
}

export function renameConversation(id: string, title: string): Promise<Conversation> {
  return withAuthRefresh(() => apiClient.PATCH('/api/v1/conversations/{conversation_id}', {
    params: { path: { conversation_id: id } },
    body: { title },
  }));
}

export function listMessages(id: string, limit = 200): Promise<ConversationMessage[]> {
  return withAuthRefresh(() => apiClient.GET('/api/v1/conversations/{conversation_id}/messages', {
    params: { path: { conversation_id: id }, query: { limit } },
  }));
}

export function submitMessage(id: string, body: MessageCreate): Promise<MessageAccepted> {
  return withAuthRefresh(() => apiClient.POST('/api/v1/conversations/{conversation_id}/messages', {
    params: { path: { conversation_id: id } },
    body,
  }));
}

export async function deleteConversation(id: string): Promise<void> {
  await withAuthRefresh(() => apiClient.DELETE('/api/v1/conversations/{conversation_id}', {
    params: { path: { conversation_id: id } },
  }));
}

export async function deleteAllConversations(): Promise<void> {
  try {
    await withAuthRefresh(() => apiClient.DELETE('/api/v1/conversations' as any));
  } catch {
    const list = await listConversations();
    await Promise.all(list.map((c) => deleteConversation(c.id)));
  }
}

export function saveVerification(message: ConversationMessage, body: S['MessageVerificationUpdate']): Promise<ConversationMessage> {
  return withAuthRefresh(() => apiClient.PATCH('/api/v1/conversations/{conversation_id}/messages/{message_id}/verification', {
    params: { path: { conversation_id: message.conversation_id, message_id: message.id } }, body,
  }));
}

import { apiClient, withAuthRefresh } from '../../api/client';

export type AgentInstruction = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  command: string | null;
  prompt_template: string | null;
  content: string;
  is_default: boolean;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type InstructionCreate = {
  name: string;
  description?: string | null;
  command?: string | null;
  prompt_template?: string | null;
  content: string;
  is_default?: boolean;
  enabled?: boolean;
};

export type InstructionUpdate = {
  name?: string;
  description?: string | null;
  command?: string | null;
  prompt_template?: string | null;
  content?: string;
  is_default?: boolean;
  enabled?: boolean;
};

export async function listInstructions(): Promise<AgentInstruction[]> {
  return withAuthRefresh(() => (apiClient as any).GET('/api/v1/instructions'));
}

export async function getInstruction(id: string): Promise<AgentInstruction> {
  return withAuthRefresh(() => (apiClient as any).GET(`/api/v1/instructions/${id}`));
}

export async function createInstruction(body: InstructionCreate): Promise<AgentInstruction> {
  return withAuthRefresh(() => (apiClient as any).POST('/api/v1/instructions', { body }));
}

export async function updateInstruction(id: string, body: InstructionUpdate): Promise<AgentInstruction> {
  return withAuthRefresh(() => (apiClient as any).PATCH(`/api/v1/instructions/${id}`, { body }));
}

export async function deleteInstruction(id: string): Promise<void> {
  return withAuthRefresh(() => (apiClient as any).DELETE(`/api/v1/instructions/${id}`)) as Promise<void>;
}

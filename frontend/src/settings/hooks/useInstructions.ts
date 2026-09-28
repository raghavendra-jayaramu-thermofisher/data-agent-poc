import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../api/queryKeys';
import { useOrganization } from '../../organizations/OrganizationProvider';
import {
  createInstruction,
  deleteInstruction,
  listInstructions,
  updateInstruction,
  type InstructionCreate,
  type InstructionUpdate,
} from '../api/instructions-api';

export function useInstructions() {
  const { activeOrganization } = useOrganization();
  return useQuery({
    queryKey: queryKeys.instructions.list(activeOrganization?.id ?? null),
    queryFn: listInstructions,
    enabled: Boolean(activeOrganization),
  });
}

export function useCreateInstruction() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  return useMutation({
    mutationFn: (body: InstructionCreate) => createInstruction(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.instructions.list(activeOrganization?.id ?? null),
      });
    },
  });
}

export function useUpdateInstruction() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: InstructionUpdate }) =>
      updateInstruction(id, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.instructions.list(activeOrganization?.id ?? null),
      });
    },
  });
}

export function useDeleteInstruction() {
  const queryClient = useQueryClient();
  const { activeOrganization } = useOrganization();
  return useMutation({
    mutationFn: (id: string) => deleteInstruction(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.instructions.list(activeOrganization?.id ?? null),
      });
    },
  });
}

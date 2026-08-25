import { z } from 'zod';

const question = z.string().trim().min(1, 'Enter a question.').max(50000, 'Question is too long.');

export const newConversationSchema = z.object({
  question,
  dataSourceIds: z.array(z.string().uuid()).min(1, 'Select at least one data source.').max(10, 'Select no more than 10 data sources.'),
  modelProfileId: z.string().uuid().nullable().optional(),
});

export const messageSchema = z.object({ question });

export type NewConversationFormValues = z.infer<typeof newConversationSchema>;
export type MessageFormValues = z.infer<typeof messageSchema>;

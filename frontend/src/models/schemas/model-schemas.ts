import { z } from 'zod';

export const modelConnectionSchema = z.object({
  name: z.string().trim().min(1).max(180),
  baseUrl: z.string().trim().url('Enter a valid HTTP(S) URL').max(2048),
  apiKey: z.string().max(4096).optional(),
}).superRefine((value, context) => {
  try {
    const url = new URL(value.baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      context.addIssue({
        code: 'custom',
        path: ['baseUrl'],
        message: 'Use an absolute HTTP(S) URL without credentials, query, or fragment.',
      });
    }
  } catch {
    // The URL validator above reports the user-facing parse error.
  }
});

export type ModelConnectionValues = z.infer<typeof modelConnectionSchema>;

export const modelProfileSchema = z.object({
  connectionId: z.string().min(1, 'Choose a connection'),
  displayName: z.string().trim().min(1).max(180),
  modelName: z.string().trim().min(1).max(255),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(1_000_000).optional(),
});

export type ModelProfileValues = z.infer<typeof modelProfileSchema>;

export function parseOptionalNumberInput(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  return Number(value);
}

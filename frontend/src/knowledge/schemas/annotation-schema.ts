import { z } from 'zod';
export const annotationSchema = z
  .object({
    scopeType: z.enum(['datasource', 'table', 'column', 'metric']),
    scopeKey: z.string().trim().max(600).optional(),
    content: z.string().trim().min(1, 'Enter instructions before saving.').max(20000),
  })
  .superRefine((value, ctx) => {
    if (value.scopeType !== 'datasource' && !value.scopeKey)
      ctx.addIssue({
        code: 'custom',
        path: ['scopeKey'],
        message: `Enter the ${value.scopeType} name.`,
      });
  });
export type AnnotationValues = z.infer<typeof annotationSchema>;

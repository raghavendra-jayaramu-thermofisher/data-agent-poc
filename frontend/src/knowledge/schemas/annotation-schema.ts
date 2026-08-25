import { z } from 'zod';
export const annotationSchema = z.object({ scopeType: z.enum(['datasource', 'table', 'column', 'metric']), scopeKey: z.string().trim().max(600).optional(), content: z.string().trim().min(1, 'Definition is required').max(20000) }).superRefine((value, ctx) => { if (value.scopeType !== 'datasource' && !value.scopeKey)
    ctx.addIssue({ code: 'custom', path: ['scopeKey'], message: 'Scope key is required for table, column, and metric knowledge.' }); });
export type AnnotationValues = z.infer<typeof annotationSchema>;

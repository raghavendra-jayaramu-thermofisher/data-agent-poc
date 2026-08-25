import { z } from 'zod';

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required.').max(160, 'Organization name must be 160 characters or fewer.'),
});

export type OrganizationSettingsValues = z.infer<typeof organizationSettingsSchema>;

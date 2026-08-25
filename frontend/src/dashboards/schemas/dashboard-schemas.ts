import { z } from 'zod';

export const dashboardFormSchema = z.object({
  title: z.string().trim().min(1, 'Dashboard title is required.').max(240),
  description: z.string().trim().max(4000).optional(),
});
export type DashboardFormValues = z.infer<typeof dashboardFormSchema>;

export const widgetTitleSchema = z.object({
  title: z.string().trim().min(1, 'Widget title is required.').max(240),
});

export const widgetTypes = ['metric', 'table', 'bar', 'line', 'area', 'pie'] as const;
export type WidgetType = typeof widgetTypes[number];

export type SaveWidgetValues = {
  dashboardId: string;
  widgetType: WidgetType;
  title: string;
  metricField: string;
  xField: string;
  valueField: string;
  categoryField: string;
};

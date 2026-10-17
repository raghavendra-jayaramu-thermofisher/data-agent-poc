import { z } from 'zod';

export const dashboardFormSchema = z.object({
  title: z.string().trim().min(1, 'Dashboard title is required.').max(240),
  description: z.string().trim().max(4000).optional(),
});
export type DashboardFormValues = z.infer<typeof dashboardFormSchema>;

export const widgetTitleSchema = z.object({
  title: z.string().trim().min(1, 'Widget title is required.').max(240),
});

export const widgetTypes = [
  'metric',
  'table',
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'combo',
] as const;
export type WidgetType = (typeof widgetTypes)[number];

export type SaveWidgetValues = {
  dashboardId: string;
  widgetType: WidgetType;
  title: string;
  metricField: string;
  xField: string;
  valueField: string;
  categoryField: string;
  orientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
  yLabel?: string;
  secondaryYLabel?: string;
  series?: Array<{
    field: string;
    label?: string;
    unit?: string;
    type?: 'bar' | 'line';
    axis?: 'primary' | 'secondary';
  }>;
};

export type WidgetMappingValues = Pick<
  SaveWidgetValues,
  | 'metricField'
  | 'xField'
  | 'valueField'
  | 'categoryField'
  | 'orientation'
  | 'stacked'
  | 'series'
  | 'yLabel'
  | 'secondaryYLabel'
>;

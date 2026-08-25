import { apiClient, withAuthRefresh } from '../../api/client';
import type { components } from '../../api/generated/schema';

type Schemas = components['schemas'];
export type Dashboard = Schemas['DashboardResponse'];
export type DashboardDetail = Schemas['DashboardDetailResponse'];
export type DashboardCreate = Schemas['DashboardCreate'];
export type DashboardUpdate = Schemas['DashboardUpdate'];
export type DashboardWidget = Schemas['DashboardWidgetResponse'];
export type DashboardWidgetCreate = Schemas['DashboardWidgetCreate'];
export type DashboardWidgetUpdate = Schemas['DashboardWidgetUpdate'];
export type DashboardRefreshResponse = Schemas['DashboardRefreshResponse'];

export function listDashboards(): Promise<Dashboard[]> {
  return withAuthRefresh(() => apiClient.GET('/api/v1/dashboards'));
}

export function createDashboard(body: DashboardCreate): Promise<Dashboard> {
  return withAuthRefresh(() => apiClient.POST('/api/v1/dashboards', { body }));
}

export function getDashboard(dashboardId: string): Promise<DashboardDetail> {
  return withAuthRefresh(() => apiClient.GET('/api/v1/dashboards/{dashboard_id}', {
    params: { path: { dashboard_id: dashboardId } },
  }));
}

export function updateDashboard(dashboardId: string, body: DashboardUpdate): Promise<Dashboard> {
  return withAuthRefresh(() => apiClient.PATCH('/api/v1/dashboards/{dashboard_id}', {
    params: { path: { dashboard_id: dashboardId } }, body,
  }));
}

export function deleteDashboard(dashboardId: string): Promise<void> {
  return withAuthRefresh(() => apiClient.DELETE('/api/v1/dashboards/{dashboard_id}', {
    params: { path: { dashboard_id: dashboardId } },
  }));
}

export function addWidget(dashboardId: string, body: DashboardWidgetCreate): Promise<DashboardWidget> {
  return withAuthRefresh(() => apiClient.POST('/api/v1/dashboards/{dashboard_id}/widgets', {
    params: { path: { dashboard_id: dashboardId } }, body,
  }));
}

export function updateWidget(widgetId: string, body: DashboardWidgetUpdate): Promise<DashboardWidget> {
  return withAuthRefresh(() => apiClient.PATCH('/api/v1/dashboards/widgets/{widget_id}', {
    params: { path: { widget_id: widgetId } }, body,
  }));
}

export function deleteWidget(widgetId: string): Promise<void> {
  return withAuthRefresh(() => apiClient.DELETE('/api/v1/dashboards/widgets/{widget_id}', {
    params: { path: { widget_id: widgetId } },
  }));
}

export function refreshWidget(widgetId: string): Promise<DashboardRefreshResponse> {
  return withAuthRefresh(() => apiClient.POST('/api/v1/dashboards/widgets/{widget_id}/refresh', {
    params: { path: { widget_id: widgetId } },
  }));
}

export function refreshDashboard(dashboardId: string): Promise<DashboardRefreshResponse> {
  return withAuthRefresh(() => apiClient.POST('/api/v1/dashboards/{dashboard_id}/refresh', {
    params: { path: { dashboard_id: dashboardId } },
  }));
}

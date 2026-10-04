import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'data_agent_sidebar_display';

export const ALL_SIDEBAR_TABS = [
  { key: '/ask', label: 'Ask', fixed: true },
  { key: '/dashboards', label: 'Dashboards', fixed: false },
  { key: '/data-sources', label: 'Data Sources', fixed: false },
  { key: '/knowledge', label: 'Knowledge', fixed: false },
  { key: '/skills', label: 'Skills', fixed: false },
  { key: '/models', label: 'Models', fixed: false },
  { key: '/jobs', label: 'Jobs', fixed: false },
  { key: '/settings', label: 'Settings', fixed: false },
] as const;

export type SidebarTabKey = (typeof ALL_SIDEBAR_TABS)[number]['key'];

export type TabVisibilityMap = Record<SidebarTabKey, boolean>;

const DEFAULT_VISIBILITY: TabVisibilityMap = {
  '/ask': true,
  '/dashboards': true,
  '/data-sources': true,
  '/knowledge': true,
  '/skills': true,
  '/models': true,
  '/jobs': true,
  '/settings': true,
};

function getStoredVisibility(): TabVisibilityMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VISIBILITY;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        ...DEFAULT_VISIBILITY,
        ...(parsed as Partial<TabVisibilityMap>),
        '/ask': true, // Always enforce true
      };
    }
  } catch {
    // Ignore JSON errors and fallback
  }
  return DEFAULT_VISIBILITY;
}

export function useSidebarDisplay() {
  const [visibility, setVisibility] = useState<TabVisibilityMap>(getStoredVisibility);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
    } catch {
      // Ignore storage write errors
    }
  }, [visibility]);

  const isTabVisible = useCallback(
    (key: string): boolean => {
      if (key === '/ask') return true;
      return visibility[key as SidebarTabKey] ?? true;
    },
    [visibility]
  );

  const toggleTab = useCallback((key: SidebarTabKey) => {
    if (key === '/ask') return;
    setVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const resetDefaults = useCallback(() => {
    setVisibility(DEFAULT_VISIBILITY);
  }, []);

  return {
    visibility,
    isTabVisible,
    toggleTab,
    resetDefaults,
  };
}

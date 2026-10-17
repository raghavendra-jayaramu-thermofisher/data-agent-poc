import type { components } from '../api/generated/schema';

const KEY = 'db-assistant.preferences.v1';
export type Preferences = {
  sidebarCollapsed?: boolean;
  navigationCollapsed?: boolean;
  lastOrganizationId?: string;
  lastPath?: string;
  lastAskDataSourceIds?: string[];
  askDataSourceIdsByScope?: Record<string, string[]>;
  askTableScopesByScope?: Record<string, components['schemas']['SourceTableScope'][]>;
  lastSelectedModelProfileId?: string | null;
};
function readAll(): Preferences {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Preferences;
  } catch {
    return {};
  }
}
function writeAll(value: Preferences) {
  localStorage.setItem(KEY, JSON.stringify(value));
}
export const preferences = {
  get<K extends keyof Preferences>(key: K): Preferences[K] {
    return readAll()[key];
  },
  set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const next = readAll();
    if (value === undefined) delete next[key];
    else next[key] = value;
    writeAll(next);
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};

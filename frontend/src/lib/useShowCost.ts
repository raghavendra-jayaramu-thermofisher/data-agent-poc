import { useSyncExternalStore } from 'react';
import { preferences } from './preferences';

const listeners = new Set<() => void>();

function readShowCost(): boolean {
  try {
    return preferences.get('showCost') ?? true;
  } catch {
    return true;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/** Whether analysis cost is shown. Cost is shown unless the user hid it in Display settings. */
export function useShowCost(): boolean {
  return useSyncExternalStore(subscribe, readShowCost, () => true);
}

export function setShowCost(value: boolean) {
  try {
    // Store only the non-default choice so a reset leaves no stale value behind.
    preferences.set('showCost', value ? undefined : false);
  } catch {
    // Ignore storage write errors
  }
  listeners.forEach((listener) => listener());
}

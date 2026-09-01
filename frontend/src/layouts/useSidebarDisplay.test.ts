import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSidebarDisplay } from './useSidebarDisplay';

describe('useSidebarDisplay', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to all tabs visible', () => {
    const { result } = renderHook(() => useSidebarDisplay());
    expect(result.current.isTabVisible('/ask')).toBe(true);
    expect(result.current.isTabVisible('/dashboards')).toBe(true);
    expect(result.current.isTabVisible('/data-sources')).toBe(true);
    expect(result.current.isTabVisible('/knowledge')).toBe(true);
    expect(result.current.isTabVisible('/models')).toBe(true);
    expect(result.current.isTabVisible('/jobs')).toBe(true);
    expect(result.current.isTabVisible('/settings')).toBe(true);
  });

  it('toggles tab visibility and persists in localStorage', () => {
    const { result } = renderHook(() => useSidebarDisplay());

    act(() => {
      result.current.toggleTab('/jobs');
    });

    expect(result.current.isTabVisible('/jobs')).toBe(false);

    // Verify localStorage has the new state
    const stored = JSON.parse(localStorage.getItem('data_agent_sidebar_display') || '{}');
    expect(stored['/jobs']).toBe(false);
  });

  it('never allows toggling off /ask', () => {
    const { result } = renderHook(() => useSidebarDisplay());

    act(() => {
      result.current.toggleTab('/ask');
    });

    expect(result.current.isTabVisible('/ask')).toBe(true);
  });

  it('resets tabs to defaults', () => {
    const { result } = renderHook(() => useSidebarDisplay());

    act(() => {
      result.current.toggleTab('/dashboards');
      result.current.toggleTab('/models');
    });

    expect(result.current.isTabVisible('/dashboards')).toBe(false);
    expect(result.current.isTabVisible('/models')).toBe(false);

    act(() => {
      result.current.resetDefaults();
    });

    expect(result.current.isTabVisible('/dashboards')).toBe(true);
    expect(result.current.isTabVisible('/models')).toBe(true);
  });
});

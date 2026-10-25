import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { preferences } from './preferences';
import { setShowCost, useShowCost } from './useShowCost';

describe('useShowCost', () => {
  it('shows cost by default', () => {
    const { result } = renderHook(() => useShowCost());
    expect(result.current).toBe(true);
  });

  it('updates every reader and remembers the choice', () => {
    const first = renderHook(() => useShowCost());
    const second = renderHook(() => useShowCost());

    act(() => setShowCost(false));
    expect(first.result.current).toBe(false);
    expect(second.result.current).toBe(false);
    expect(preferences.get('showCost')).toBe(false);

    act(() => setShowCost(true));
    expect(first.result.current).toBe(true);
    expect(preferences.get('showCost')).toBeUndefined();
  });
});

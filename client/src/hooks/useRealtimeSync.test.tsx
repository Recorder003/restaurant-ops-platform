import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRealtimeSync } from './useRealtimeSync';
import type { RealtimeEvent } from '../api';
import { createStaffUser } from '../test/factories';

const realtime = vi.hoisted(() => ({
  callback: null as ((event: RealtimeEvent) => void) | null,
  unsubscribe: vi.fn(),
  subscribeToRealtimeEvents: vi.fn((callback: (event: RealtimeEvent) => void) => {
    realtime.callback = callback;
    return realtime.unsubscribe;
  })
}));

vi.mock('../api', () => ({
  subscribeToRealtimeEvents: realtime.subscribeToRealtimeEvents
}));

const user = createStaffUser();

describe('useRealtimeSync', () => {
  it('ignores connection events and refreshes for data changes', () => {
    const onDataChanged = vi.fn();
    renderHook(() => useRealtimeSync(user, onDataChanged));

    act(() => {
      realtime.callback?.({ type: 'order_changed', action: 'connected', createdAt: '2026-01-01' });
      realtime.callback?.({ type: 'order_changed', action: 'updated', createdAt: '2026-01-01' });
    });

    expect(onDataChanged).toHaveBeenCalledOnce();
  });

  it('does not subscribe without an authenticated user', () => {
    realtime.subscribeToRealtimeEvents.mockClear();
    renderHook(() => useRealtimeSync(null, vi.fn()));

    expect(realtime.subscribeToRealtimeEvents).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRefreshScheduler } from './useRefreshScheduler';

describe('useRefreshScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('coalesces repeated order refresh requests into one callback', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useRefreshScheduler({ onRefresh, orderListDelayMs: 3000 }));

    act(() => {
      result.current.scheduleOrderListRefresh();
      result.current.scheduleOrderListRefresh();
      result.current.scheduleOrderListRefresh();
      vi.advanceTimersByTime(2999);
    });
    expect(onRefresh).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('keeps realtime and delayed order refresh channels independent', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => useRefreshScheduler({
      onRefresh,
      realtimeDelayMs: 500,
      orderListDelayMs: 3000
    }));

    act(() => {
      result.current.scheduleRealtimeDataRefresh();
      result.current.scheduleOrderListRefresh();
      vi.advanceTimersByTime(500);
    });
    expect(onRefresh).toHaveBeenCalledOnce();

    act(() => vi.advanceTimersByTime(2500));
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('uses the latest refresh callback without rescheduling the timer', () => {
    const firstRefresh = vi.fn();
    const nextRefresh = vi.fn();
    const { result, rerender } = renderHook(
      ({ onRefresh }) => useRefreshScheduler({ onRefresh, realtimeDelayMs: 500 }),
      { initialProps: { onRefresh: firstRefresh } }
    );

    act(() => result.current.scheduleRealtimeDataRefresh());
    rerender({ onRefresh: nextRefresh });
    act(() => vi.advanceTimersByTime(500));

    expect(firstRefresh).not.toHaveBeenCalled();
    expect(nextRefresh).toHaveBeenCalledOnce();
  });

  it('cancels scheduled callbacks explicitly and during unmount', () => {
    const onRefresh = vi.fn();
    const { result, unmount } = renderHook(() => useRefreshScheduler({
      onRefresh,
      realtimeDelayMs: 500,
      orderListDelayMs: 3000
    }));

    act(() => {
      result.current.scheduleRealtimeDataRefresh();
      result.current.scheduleOrderListRefresh();
      result.current.clearScheduledRefreshes();
      vi.runAllTimers();
    });
    expect(onRefresh).not.toHaveBeenCalled();

    act(() => {
      result.current.scheduleRealtimeDataRefresh();
      result.current.scheduleOrderListRefresh();
    });
    unmount();
    act(() => vi.runAllTimers());
    expect(onRefresh).not.toHaveBeenCalled();
  });
});

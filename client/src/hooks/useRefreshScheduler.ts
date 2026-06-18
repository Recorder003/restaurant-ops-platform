import { useEffect, useRef } from 'react';

type RefreshSchedulerInput = {
  onRefresh: () => void;
  orderListDelayMs?: number;
  realtimeDelayMs?: number;
};

export function useRefreshScheduler({
  onRefresh,
  orderListDelayMs = 3000,
  realtimeDelayMs = 500
}: RefreshSchedulerInput) {
  const refreshCallbackRef = useRef(onRefresh);
  const orderListTimeoutRef = useRef<number | null>(null);
  const realtimeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    refreshCallbackRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    return () => {
      if (orderListTimeoutRef.current !== null) {
        window.clearTimeout(orderListTimeoutRef.current);
      }

      if (realtimeTimeoutRef.current !== null) {
        window.clearTimeout(realtimeTimeoutRef.current);
      }
    };
  }, []);

  function scheduleOrderListRefresh() {
    if (orderListTimeoutRef.current !== null) {
      return;
    }

    orderListTimeoutRef.current = window.setTimeout(() => {
      orderListTimeoutRef.current = null;
      refreshCallbackRef.current();
    }, orderListDelayMs);
  }

  function scheduleRealtimeDataRefresh() {
    if (realtimeTimeoutRef.current !== null) {
      return;
    }

    realtimeTimeoutRef.current = window.setTimeout(() => {
      realtimeTimeoutRef.current = null;
      refreshCallbackRef.current();
    }, realtimeDelayMs);
  }

  function clearScheduledRefreshes() {
    if (orderListTimeoutRef.current !== null) {
      window.clearTimeout(orderListTimeoutRef.current);
      orderListTimeoutRef.current = null;
    }

    if (realtimeTimeoutRef.current !== null) {
      window.clearTimeout(realtimeTimeoutRef.current);
      realtimeTimeoutRef.current = null;
    }
  }

  return {
    scheduleOrderListRefresh,
    scheduleRealtimeDataRefresh,
    clearScheduledRefreshes
  };
}

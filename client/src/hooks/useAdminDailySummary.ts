import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminDailySummary } from '../api';
import type { AdminDailySummary } from '../types';

export function useAdminDailySummary(refreshKey = 0) {
  const [dailySummary, setDailySummary] = useState<AdminDailySummary | null>(null);
  const [isLoadingDailySummary, setIsLoadingDailySummary] = useState(false);
  const [dailySummaryError, setDailySummaryError] = useState<string | null>(null);
  const [isDailySummaryStale, setIsDailySummaryStale] = useState(false);
  const generatedRefreshKeyRef = useRef<number | null>(null);

  const loadDailySummary = useCallback(async () => {
    const generatedRefreshKey = refreshKey;
    setIsLoadingDailySummary(true);
    setDailySummaryError(null);

    try {
      setDailySummary(await fetchAdminDailySummary());
      generatedRefreshKeyRef.current = generatedRefreshKey;
      setIsDailySummaryStale(false);
    } catch (error) {
      setDailySummaryError(error instanceof Error ? error.message : 'Unable to generate daily summary');
    } finally {
      setIsLoadingDailySummary(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    if (dailySummary && generatedRefreshKeyRef.current !== refreshKey) {
      setIsDailySummaryStale(true);
    }
  }, [dailySummary, refreshKey]);

  return {
    dailySummary,
    dailySummaryError,
    isDailySummaryStale,
    isLoadingDailySummary,
    loadDailySummary
  };
}

import { useCallback, useState } from 'react';
import { fetchAdminDailySummary } from '../api';
import type { AdminDailySummary } from '../types';

export function useAdminDailySummary() {
  const [dailySummary, setDailySummary] = useState<AdminDailySummary | null>(null);
  const [isLoadingDailySummary, setIsLoadingDailySummary] = useState(false);
  const [dailySummaryError, setDailySummaryError] = useState<string | null>(null);

  const loadDailySummary = useCallback(async () => {
    setIsLoadingDailySummary(true);
    setDailySummaryError(null);

    try {
      setDailySummary(await fetchAdminDailySummary());
    } catch (error) {
      setDailySummaryError(error instanceof Error ? error.message : 'Unable to generate daily summary');
    } finally {
      setIsLoadingDailySummary(false);
    }
  }, []);

  return {
    dailySummary,
    dailySummaryError,
    isLoadingDailySummary,
    loadDailySummary
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminManagerDashboard } from '../api';
import type { AdminManagerDashboard } from '../types';

export function useAdminManagerDashboard(refreshKey = 0) {
  const [managerDashboard, setManagerDashboard] = useState<AdminManagerDashboard | null>(null);
  const [managerDashboardError, setManagerDashboardError] = useState<string | null>(null);
  const [isLoadingManagerDashboard, setIsLoadingManagerDashboard] = useState(false);
  const [lastDashboardRefreshAt, setLastDashboardRefreshAt] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const loadManagerDashboard = useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setIsLoadingManagerDashboard(true);
    setManagerDashboardError(null);

    try {
      const nextDashboard = await fetchAdminManagerDashboard();

      if (latestRequestRef.current === requestId) {
        setManagerDashboard(nextDashboard);
        setLastDashboardRefreshAt(new Date().toISOString());
      }
    } catch (error) {
      if (latestRequestRef.current === requestId) {
        setManagerDashboardError(error instanceof Error ? error.message : 'Failed to load manager dashboard');
      }
    } finally {
      if (latestRequestRef.current === requestId) {
        setIsLoadingManagerDashboard(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadManagerDashboard();
  }, [loadManagerDashboard, refreshKey]);

  return {
    managerDashboard,
    managerDashboardError,
    isLoadingManagerDashboard,
    isRefreshingManagerDashboard: isLoadingManagerDashboard && managerDashboard !== null,
    lastDashboardRefreshAt,
    loadManagerDashboard
  };
}

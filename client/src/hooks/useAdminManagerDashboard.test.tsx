import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAdminManagerDashboard } from '../api';
import { useAdminManagerDashboard } from './useAdminManagerDashboard';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');

  return {
    ...actual,
    fetchAdminManagerDashboard: vi.fn()
  };
});

const dashboard = {
  generatedAt: '2026-07-19T16:30:00.000Z',
  metrics: {
    orderCount: 2,
    activeOrderCount: 1,
    cancelledCount: 0,
    paidOrderCount: 1,
    unpaidOrderCount: 1,
    paidRevenueCents: 2400,
    averagePaidOrderCents: 2400,
    dineInCount: 1,
    toGoCount: 1,
    phoneOrderCount: 0,
    activeOver20MinCount: 0
  },
  topItems: [],
  statusCounts: [],
  kitchenQueue: []
};

describe('useAdminManagerDashboard', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminManagerDashboard).mockReset();
    vi.mocked(fetchAdminManagerDashboard).mockResolvedValue(dashboard);
  });

  it('loads dashboard metrics on mount and when refresh key changes', async () => {
    const { result, rerender } = renderHook(
      ({ refreshKey }) => useAdminManagerDashboard(refreshKey),
      { initialProps: { refreshKey: 0 } }
    );

    await waitFor(() => expect(result.current.managerDashboard).toEqual(dashboard));
    expect(result.current.lastDashboardRefreshAt).toEqual(expect.any(String));
    expect(fetchAdminManagerDashboard).toHaveBeenCalledTimes(1);

    rerender({ refreshKey: 1 });

    await waitFor(() => expect(fetchAdminManagerDashboard).toHaveBeenCalledTimes(2));
  });
});

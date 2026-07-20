import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAdminDailySummary } from '../api';
import { useAdminDailySummary } from './useAdminDailySummary';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');

  return {
    ...actual,
    fetchAdminDailySummary: vi.fn()
  };
});

const dailySummary = {
  generatedAt: '2026-07-19T16:30:00.000Z',
  source: 'ai' as const,
  summary: 'Today looks steady.',
  highlights: [],
  recommendations: [],
  metrics: {
    orderCount: 1,
    activeOrderCount: 0,
    cancelledCount: 0,
    paidOrderCount: 1,
    unpaidOrderCount: 0,
    paidRevenueCents: 2400,
    averagePaidOrderCents: 2400,
    dineInCount: 1,
    toGoCount: 0,
    phoneOrderCount: 0,
    activeOver20MinCount: 0
  },
  topItems: [],
  statusCounts: [],
  kitchenQueue: []
};

describe('useAdminDailySummary', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminDailySummary).mockReset();
    vi.mocked(fetchAdminDailySummary).mockResolvedValue(dailySummary);
  });

  it('marks generated summaries stale when the data refresh key changes', async () => {
    const { result, rerender } = renderHook(
      ({ refreshKey }) => useAdminDailySummary(refreshKey),
      { initialProps: { refreshKey: 0 } }
    );

    await act(async () => {
      await result.current.loadDailySummary();
    });

    expect(result.current.isDailySummaryStale).toBe(false);

    rerender({ refreshKey: 1 });

    await waitFor(() => expect(result.current.isDailySummaryStale).toBe(true));
  });
});

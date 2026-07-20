import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminManagerDashboardPanel } from './AdminManagerDashboardPanel';
import type { AdminManagerDashboard } from '../types';

describe('AdminManagerDashboardPanel', () => {
  it('shows an empty state and refreshes metrics without generating AI text', async () => {
    const onRefresh = vi.fn();
    const user = userEvent.setup();

    render(<AdminManagerDashboardPanel dashboard={null} error={null} isLoading={false} onRefresh={onRefresh} />);

    expect(screen.getByText(/without using AI credits/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Refresh Metrics' }));

    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('renders source metrics, queue counts, and top items', () => {
    render(
      <AdminManagerDashboardPanel
        dashboard={dashboard}
        error={null}
        isLoading={false}
        lastRefreshAt="2026-07-19T16:31:00.000Z"
        onRefresh={() => {}}
      />
    );

    expect(screen.getByRole('heading', { name: 'Manager Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Auto refresh on live changes')).toBeInTheDocument();
    expect(screen.getByText(/UI refreshed/)).toBeInTheDocument();
    expect(screen.getByText('$182.50')).toBeInTheDocument();
    expect(screen.getByText('Order Status')).toBeInTheDocument();
    expect(screen.getByText('Kitchen Queue')).toBeInTheDocument();
    expect(screen.getByText('Signature Beef Noodles x 6')).toBeInTheDocument();
    expect(screen.getAllByText('preparing')).toHaveLength(2);
  });

  it('shows a lightweight updating state while keeping the last dashboard visible', () => {
    render(<AdminManagerDashboardPanel dashboard={dashboard} error={null} isLoading isRefreshing onRefresh={() => {}} />);

    expect(screen.getByText('Updating metrics...')).toBeInTheDocument();
    expect(screen.getByText('$182.50')).toBeInTheDocument();
  });
});

const dashboard: AdminManagerDashboard = {
  generatedAt: '2026-07-19T16:30:00.000Z',
  metrics: {
    orderCount: 14,
    activeOrderCount: 5,
    cancelledCount: 1,
    paidOrderCount: 9,
    unpaidOrderCount: 2,
    paidRevenueCents: 18250,
    averagePaidOrderCents: 2028,
    dineInCount: 8,
    toGoCount: 6,
    phoneOrderCount: 3,
    activeOver20MinCount: 1
  },
  topItems: [
    {
      name: 'Signature Beef Noodles',
      quantity: 6,
      revenueCents: 8280
    }
  ],
  statusCounts: [
    { status: 'preparing', count: 3 },
    { status: 'served', count: 9 }
  ],
  kitchenQueue: [
    { status: 'preparing', count: 4 },
    { status: 'ready', count: 2 }
  ]
};

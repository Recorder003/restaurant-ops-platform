import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminDailySummaryPanel } from './AdminDailySummaryPanel';
import type { AdminDailySummary } from '../types';

describe('AdminDailySummaryPanel', () => {
  it('shows the empty state and calls onGenerate', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();

    render(<AdminDailySummaryPanel dailySummary={null} error={null} isLoading={false} onGenerate={onGenerate} />);

    expect(screen.getByText(/Generate a daily summary/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Generate Summary' }));

    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it('renders generated summary details', () => {
    render(<AdminDailySummaryPanel dailySummary={dailySummary} error={null} isLoading={false} onGenerate={() => {}} />);

    expect(screen.getByText('AI generated')).toBeInTheDocument();
    expect(screen.getByText('Today looks steady.')).toBeInTheDocument();
    expect(screen.getByText('12 orders were created today.')).toBeInTheDocument();
    expect(screen.getByText('Check 2 unpaid orders.')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByText(/Signature Beef Noodles x 3/)).toBeInTheDocument();
  });
});

const dailySummary: AdminDailySummary = {
  generatedAt: '2026-07-08T16:30:00.000Z',
  source: 'ai',
  summary: 'Today looks steady.',
  highlights: ['12 orders were created today.'],
  recommendations: ['Check 2 unpaid orders.'],
  metrics: {
    orderCount: 12,
    activeOrderCount: 4,
    cancelledCount: 1,
    paidOrderCount: 8,
    unpaidOrderCount: 2,
    paidRevenueCents: 12000,
    averagePaidOrderCents: 1500,
    dineInCount: 7,
    toGoCount: 5,
    phoneOrderCount: 2,
    activeOver20MinCount: 1
  },
  topItems: [
    {
      name: 'Signature Beef Noodles',
      quantity: 3,
      revenueCents: 4140
    }
  ],
  statusCounts: [{ status: 'pending', count: 2 }],
  kitchenQueue: [{ status: 'preparing', count: 2 }]
};

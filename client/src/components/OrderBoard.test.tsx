import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrderBoard, type OrderFilterState } from './OrderBoard';
import { createOrder, createOrderItem } from '../test/factories';
import type { UserRole } from '../types';

const item = createOrderItem({ menuItemName: 'Noodles', status: 'pending' });
const order = createOrder({ status: 'pending', items: [item] });

const defaultFilters: OrderFilterState = {
  status: 'active',
  activeOnly: true,
  tableNumber: '',
  serverName: '',
  fromDate: '',
  toDate: '',
  page: 1,
  limit: 8
};

describe('OrderBoard', () => {
  it('keeps staff filters focused on active orders and table search', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const onFilterSubmit = vi.fn((event) => event.preventDefault());
    const onFilterReset = vi.fn();

    renderOrderBoard({
      role: 'staff',
      orders: [order],
      filteredOrders: [order],
      onFiltersChange,
      onFilterSubmit,
      onFilterReset
    });

    expect(screen.getByRole('heading', { name: 'Order Board' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Active Orders' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Server')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.getByText('Today Orders')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Table'), 'T2');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(onFiltersChange).toHaveBeenCalled();
    expect(onFilterSubmit).toHaveBeenCalled();
    expect(onFilterReset).toHaveBeenCalled();
  });

  it('shows chef kitchen statuses without served or cancelled filter options', () => {
    renderOrderBoard({ role: 'chef', filters: { ...defaultFilters, status: 'all' } });

    expect(screen.getByRole('heading', { name: 'Kitchen Board' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'All Statuses' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Pending' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Preparing' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ready' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Served' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Cancelled' })).not.toBeInTheDocument();
  });

  it('renders metrics, empty states, loading state, and pagination controls', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const paidOrder = { ...order, id: 'order-paid', status: 'served' as const, paymentStatus: 'paid' as const, paymentTotalCents: 1500 };
    const { rerender } = renderOrderBoard({
      orders: [order, paidOrder],
      filteredOrders: [],
      pagination: { page: 1, limit: 8, total: 0, totalPages: 0 },
      onPageChange
    });

    expect(screen.getByText('Shown Orders')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
    expect(screen.getByText('Page 0 of 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();

    rerender(createOrderBoard({
      filteredOrders: [order],
      pagination: { page: 2, limit: 8, total: 17, totalPages: 3 },
      onPageChange
    }));

    await user.click(screen.getByRole('button', { name: 'Previous' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Table T1 / 2 guests')).toBeInTheDocument();
    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);

    rerender(createOrderBoard({ isLoading: true }));

    expect(screen.getByText('Loading orders...')).toBeInTheDocument();
  });
});

type OrderBoardOverrides = Partial<Parameters<typeof OrderBoard>[0]>;

function renderOrderBoard(overrides: OrderBoardOverrides = {}) {
  return render(createOrderBoard(overrides));
}

function createOrderBoard(overrides: OrderBoardOverrides = {}) {
  const role: UserRole = overrides.role ?? 'admin';
  const filters = overrides.filters ?? { ...defaultFilters, status: role === 'staff' ? 'active' : 'all' };

  return (
    <OrderBoard
      role={role}
      orders={[order]}
      filteredOrders={[order]}
      filters={filters}
      pagination={{ page: 1, limit: 8, total: 1, totalPages: 1 }}
      isLoading={false}
      processingOrderActionId={null}
      processingItemActionId={null}
      formatMoney={(cents) => `$${(cents / 100).toFixed(2)}`}
      formatOrderItemName={(orderItem) => orderItem.menuItemName}
      getOrderTitle={(value) => `Table ${value.tableNumber} / ${value.partySize} guests`}
      onFiltersChange={() => {}}
      onFilterSubmit={(event) => event.preventDefault()}
      onFilterReset={() => {}}
      onPageChange={() => {}}
      onReceipt={() => {}}
      onHistory={() => {}}
      onEdit={() => {}}
      onOrderStatusChange={() => {}}
      onItemStatusChange={() => {}}
      onCheckout={() => {}}
      {...overrides}
    />
  );
}

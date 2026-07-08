import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrderBoard } from './useOrderBoard';
import { createAdminUser, createChefUser, createOrder, createOrderItem, createStaffUser } from '../test/factories';
import type { User } from '../types';

const api = vi.hoisted(() => ({
  fetchOrders: vi.fn(),
  updateOrderStatus: vi.fn(),
  updateOrderItemStatus: vi.fn()
}));

vi.mock('../api', () => api);

const staffUser = createStaffUser();
const chefUser = createChefUser();
const adminUser = createAdminUser();
const orderItem = createOrderItem({ menuItemName: 'Noodles', status: 'pending' });
const order = createOrder({ status: 'pending', items: [orderItem] });

describe('useOrderBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns role-correct filters for the first request after login', () => {
    const { result } = renderOrderBoardHook(chefUser);

    let nextFilters;
    act(() => {
      nextFilters = result.current.prepareFiltersForRole(chefUser);
    });

    expect(nextFilters).toMatchObject({ status: 'all', page: 1, limit: 8 });
    expect(result.current.filters.status).toBe('all');
  });

  it('limits admin order pages to four orders', () => {
    const { result } = renderOrderBoardHook(adminUser);

    expect(result.current.filters).toMatchObject({ status: 'all', page: 1, limit: 4 });
    expect(result.current.pagination).toMatchObject({ page: 1, limit: 4 });
  });

  it('loads only the order list when filters change', async () => {
    api.fetchOrders.mockResolvedValue({
      orders: [order],
      pagination: { page: 1, limit: 8, total: 1, totalPages: 1 }
    });
    const { result } = renderOrderBoardHook(staffUser);

    await act(async () => {
      await result.current.reloadOrders();
    });

    expect(api.fetchOrders).toHaveBeenCalledWith({
      page: 1,
      limit: 8,
      activeOnly: true,
      serverName: 'Kent'
    });
    expect(result.current.orders).toEqual([order]);
    expect(result.current.pagination.total).toBe(1);
  });

  it('replaces an updated order without moving its position', async () => {
    const secondOrder = { ...order, id: 'order-2', tableNumber: 'T2' };
    const updatedOrder = { ...order, status: 'preparing' as const };
    api.updateOrderStatus.mockResolvedValue(updatedOrder);
    const { result } = renderOrderBoardHook(chefUser);

    act(() => {
      result.current.applyOrderList({
        orders: [order, secondOrder],
        pagination: { page: 1, limit: 8, total: 2, totalPages: 1 }
      });
    });

    await act(async () => {
      await result.current.handleStatusChange(order, 'preparing');
    });

    await waitFor(() => expect(result.current.processingOrderActionId).toBeNull());
    expect(result.current.orders.map((candidate) => candidate.id)).toEqual(['order-1', 'order-2']);
    expect(result.current.orders[0].status).toBe('preparing');
  });

  it('confirms before cancelling and leaves the order untouched when declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderOrderBoardHook(staffUser);

    act(() => result.current.applyOrderList({
      orders: [order],
      pagination: { page: 1, limit: 8, total: 1, totalPages: 1 }
    }));

    await act(async () => {
      await result.current.handleStatusChange(order, 'cancelled');
    });

    expect(confirm).toHaveBeenCalledWith('Cancel Table T1 / 2 guests? This action cannot be undone.');
    expect(api.updateOrderStatus).not.toHaveBeenCalled();
    expect(result.current.orders).toEqual([order]);

    confirm.mockRestore();
  });

  it('removes orders that no longer match the current status filter', async () => {
    const readyOrder = { ...order, status: 'ready' as const };
    api.updateOrderStatus.mockResolvedValue(readyOrder);
    const { result } = renderOrderBoardHook(adminUser);

    act(() => {
      result.current.applyOrderList({
        orders: [order],
        pagination: { page: 1, limit: 8, total: 1, totalPages: 1 }
      });
      result.current.setFilters((current) => ({ ...current, status: 'pending' }));
    });

    await act(async () => {
      await result.current.handleStatusChange(order, 'ready');
    });

    expect(result.current.orders).toEqual([]);
  });

  it('refreshes dine-in tables after an item update serves the order', async () => {
    const servedOrder = {
      ...order,
      status: 'served' as const,
      items: [{ ...orderItem, status: 'served' as const }]
    };
    api.updateOrderItemStatus.mockResolvedValue(servedOrder);
    const onDineInOrderFinished = vi.fn().mockResolvedValue(undefined);
    const { result } = renderOrderBoardHook(staffUser, { onDineInOrderFinished });

    act(() => result.current.applyOrderList({
      orders: [order],
      pagination: { page: 1, limit: 8, total: 1, totalPages: 1 }
    }));

    await act(async () => {
      await result.current.handleItemStatusChange(order, orderItem, 'served');
    });

    expect(api.updateOrderItemStatus).toHaveBeenCalledWith('order-1', 'item-1', 'served');
    expect(onDineInOrderFinished).toHaveBeenCalledOnce();
    expect(result.current.processingItemActionId).toBeNull();
    expect(result.current.orders[0].status).toBe('served');
  });

  it('reloads orders on filter submit, reset, and page changes', async () => {
    api.fetchOrders.mockResolvedValue({
      orders: [order],
      pagination: { page: 3, limit: 8, total: 20, totalPages: 3 }
    });
    const { result } = renderOrderBoardHook(adminUser);

    act(() => result.current.setFilters((current) => ({
      ...current,
      status: 'ready',
      tableNumber: 'T4',
      serverName: 'Kent',
      fromDate: '2026-01-01',
      toDate: '2026-01-02',
      page: 2
    })));

    await act(async () => {
      await result.current.handleFilterSubmit(formEvent());
    });
    await act(async () => {
      await result.current.handleFilterReset();
    });
    await act(async () => {
      await result.current.handlePageChange(3);
    });

    expect(api.fetchOrders).toHaveBeenNthCalledWith(1, {
      status: 'ready',
      tableNumber: 'T4',
      serverName: 'Kent',
      fromDate: '2026-01-01',
      toDate: '2026-01-02',
      page: 1,
      limit: 4
    });
    expect(api.fetchOrders).toHaveBeenNthCalledWith(2, { page: 1, limit: 4 });
    expect(api.fetchOrders).toHaveBeenNthCalledWith(3, { page: 3, limit: 4 });
  });

  it('surfaces load and status update failures', async () => {
    const onError = vi.fn();
    api.fetchOrders.mockRejectedValueOnce(new Error('Orders unavailable'));
    api.updateOrderStatus.mockRejectedValueOnce(new Error('Status unavailable'));
    const { result } = renderOrderBoardHook(staffUser, { onError });

    await act(async () => {
      await result.current.reloadOrders();
    });
    await act(async () => {
      await result.current.handleStatusChange(order, 'preparing');
    });

    expect(onError).toHaveBeenCalledWith('Orders unavailable');
    expect(onError).toHaveBeenCalledWith('Status unavailable');
    expect(result.current.isLoadingOrders).toBe(false);
    expect(result.current.processingOrderActionId).toBeNull();
  });

  it('clears orders and processing state', async () => {
    api.updateOrderStatus.mockResolvedValue({ ...order, status: 'preparing' as const });
    const { result } = renderOrderBoardHook(staffUser);

    act(() => result.current.applyOrderList({
      orders: [order],
      pagination: { page: 1, limit: 8, total: 1, totalPages: 1 }
    }));
    const updatePromise = act(async () => {
      await result.current.handleStatusChange(order, 'preparing');
    });
    act(() => result.current.clearOrders());
    await updatePromise;
    act(() => result.current.clearOrders());

    expect(result.current.orders).toEqual([]);
    expect(result.current.pagination.total).toBe(0);
    expect(result.current.processingOrderActionId).toBeNull();
  });
});

function renderOrderBoardHook(user: User, overrides: Partial<Parameters<typeof useOrderBoard>[0]> = {}) {
  return renderHook(() => useOrderBoard({
    user,
    onError: vi.fn(),
    onDineInOrderFinished: vi.fn().mockResolvedValue(undefined),
    onChefOrderReady: vi.fn(),
    ...overrides
  }));
}

function formEvent() {
  return { preventDefault: vi.fn() } as never;
}

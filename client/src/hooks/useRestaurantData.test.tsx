import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestaurantData } from './useRestaurantData';
import { createAdminUser, createChefUser, createMenuItem, createRestaurantTable, createStaffUser } from '../test/factories';
import type { Order, User } from '../types';

const api = vi.hoisted(() => ({
  fetchAdminMenuBundles: vi.fn(),
  fetchAdminMenuItems: vi.fn(),
  fetchMenuBundles: vi.fn(),
  fetchMenuItems: vi.fn(),
  fetchOrders: vi.fn(),
  fetchStaffUsers: vi.fn(),
  fetchTables: vi.fn()
}));

vi.mock('../api', () => api);

const adminUser = createAdminUser();

type OrderResult = {
  orders: Order[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const orderResult: OrderResult = {
  orders: [],
  pagination: { page: 1, limit: 8, total: 0, totalPages: 0 }
};

const menuItem = createMenuItem({ name: 'Noodles' });
const table = createRestaurantTable();

describe('useRestaurantData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchMenuItems.mockResolvedValue([menuItem]);
    api.fetchMenuBundles.mockResolvedValue([]);
    api.fetchOrders.mockResolvedValue(orderResult);
    api.fetchStaffUsers.mockResolvedValue([adminUser]);
    api.fetchAdminMenuItems.mockResolvedValue([]);
    api.fetchAdminMenuBundles.mockResolvedValue([]);
    api.fetchTables.mockResolvedValue([table]);
  });

  it('loads role-specific application data as one coordinated operation', async () => {
    const applyOrderList = vi.fn();
    const { result } = renderRestaurantDataHook(adminUser, applyOrderList);

    await act(async () => {
      await result.current.loadData();
    });

    expect(api.fetchStaffUsers).toHaveBeenCalledOnce();
    expect(api.fetchAdminMenuItems).toHaveBeenCalledOnce();
    expect(api.fetchAdminMenuBundles).toHaveBeenCalledOnce();
    expect(applyOrderList).toHaveBeenCalledWith(orderResult);
    expect(result.current.menuItems).toEqual([menuItem]);
    expect(result.current.restaurantTables).toEqual([table]);
    expect(result.current.staffUsers).toEqual([adminUser]);
    expect(result.current.isLoading).toBe(false);
  });

  it('does not request admin-only data for staff', async () => {
    const staffUser = createStaffUser();
    const { result } = renderRestaurantDataHook(staffUser, vi.fn());

    await act(async () => {
      await result.current.loadData();
    });

    expect(api.fetchStaffUsers).not.toHaveBeenCalled();
    expect(api.fetchAdminMenuItems).not.toHaveBeenCalled();
    expect(api.fetchAdminMenuBundles).not.toHaveBeenCalled();
  });

  it('loads chef admin menu data without staff or admin bundle data', async () => {
    const chefUser = createChefUser();
    const { result } = renderRestaurantDataHook(chefUser, vi.fn());

    await act(async () => {
      await result.current.loadData();
    });

    expect(api.fetchAdminMenuItems).toHaveBeenCalledOnce();
    expect(api.fetchStaffUsers).not.toHaveBeenCalled();
    expect(api.fetchAdminMenuBundles).not.toHaveBeenCalled();
  });

  it('can silently refresh data without toggling the global loading state', async () => {
    const { result } = renderRestaurantDataHook(adminUser, vi.fn());

    await act(async () => {
      await result.current.loadData(adminUser, undefined, { silent: true });
    });

    expect(result.current.isLoading).toBe(false);
    expect(api.fetchOrders).toHaveBeenCalledOnce();
  });

  it('skips table loading when there is no authenticated user', async () => {
    const applyOrderList = vi.fn();
    const { result } = renderRestaurantDataHook(null, applyOrderList);

    await act(async () => {
      await result.current.loadData();
    });

    expect(api.fetchTables).not.toHaveBeenCalled();
    expect(applyOrderList).toHaveBeenCalledWith(orderResult);
  });

  it('refreshes tables independently from the full data load', async () => {
    const updatedTable = { ...table, status: 'needs_cleaning' as const };
    api.fetchTables.mockResolvedValueOnce([updatedTable]);
    const { result } = renderRestaurantDataHook(adminUser, vi.fn());

    await act(async () => {
      await result.current.refreshTables();
    });

    expect(result.current.restaurantTables).toEqual([updatedTable]);
  });

  it('clears loaded restaurant data on sign out', async () => {
    const { result } = renderRestaurantDataHook(adminUser, vi.fn());

    await act(async () => {
      await result.current.loadData();
    });
    act(() => result.current.clearData());

    expect(result.current.menuItems).toEqual([]);
    expect(result.current.menuBundles).toEqual([]);
    expect(result.current.adminMenuItems).toEqual([]);
    expect(result.current.adminMenuBundles).toEqual([]);
    expect(result.current.restaurantTables).toEqual([]);
    expect(result.current.staffUsers).toEqual([]);
  });

  it('reports load failures and clears the loading state', async () => {
    const onError = vi.fn();
    api.fetchOrders.mockRejectedValueOnce(new Error('Data unavailable'));
    const { result } = renderRestaurantDataHook(adminUser, vi.fn(), onError);

    await act(async () => {
      await result.current.loadData();
    });

    expect(onError).toHaveBeenCalledWith('Data unavailable');
    expect(result.current.isLoading).toBe(false);
  });
});

function renderRestaurantDataHook(
  user: User | null,
  applyOrderList: (result: OrderResult) => void,
  onError = vi.fn()
) {
  return renderHook(() => useRestaurantData({
    user,
    orderFilters: {
      status: user?.role === 'staff' ? 'active' : 'all',
      tableNumber: '',
      serverName: '',
      fromDate: '',
      toDate: '',
      page: 1,
      limit: 8
    },
    applyOrderList,
    onError
  }));
}

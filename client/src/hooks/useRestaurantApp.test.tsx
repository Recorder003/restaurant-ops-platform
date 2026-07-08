import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestaurantApp } from './useRestaurantApp';
import { createStaffUser } from '../test/factories';

const staffUser = createStaffUser();
const nextFilters = { status: 'active', page: 1 };

const mocks = vi.hoisted(() => ({
  adminManagement: { useAdminManagement: vi.fn() },
  appError: { setError: vi.fn(), useAppError: vi.fn() },
  auth: { options: null as null | { onAuthenticated: (user: unknown) => Promise<void>; onReset: () => void }, useAuthSession: vi.fn() },
  checkout: { resetCheckoutState: vi.fn(), useCheckoutFlow: vi.fn() },
  documents: { resetDocuments: vi.fn(), useOrderDocuments: vi.fn() },
  orderBoard: {
    applyOrderList: vi.fn(),
    clearOrders: vi.fn(),
    filters: { status: 'active', page: 1 },
    prepareFiltersForRole: vi.fn(),
    updateOrderInList: vi.fn(),
    useOrderBoard: vi.fn()
  },
  orderDraft: {
    initializeForUser: vi.fn(),
    removeSelectedBundle: vi.fn(),
    removeSelectedItemVariants: vi.fn(),
    resetOrderDraft: vi.fn(),
    retainSelectedBundles: vi.fn(),
    useOrderDraft: vi.fn()
  },
  realtime: { useRealtimeSync: vi.fn() },
  refresh: {
    clearScheduledRefreshes: vi.fn(),
    options: null as null | { onRefresh: () => void },
    scheduleOrderListRefresh: vi.fn(),
    scheduleRealtimeDataRefresh: vi.fn(),
    useRefreshScheduler: vi.fn()
  },
  restaurantData: {
    clearData: vi.fn(),
    loadData: vi.fn(),
    refreshTables: vi.fn(),
    setAdminMenuBundles: vi.fn(),
    setAdminMenuItems: vi.fn(),
    setMenuBundles: vi.fn(),
    setMenuItems: vi.fn(),
    setRestaurantTables: vi.fn(),
    setStaffUsers: vi.fn(),
    useRestaurantData: vi.fn()
  }
}));

vi.mock('../context/AppErrorContext', () => ({
  useAppError: mocks.appError.useAppError
}));

vi.mock('./useAdminManagement', () => ({
  useAdminManagement: mocks.adminManagement.useAdminManagement
}));

vi.mock('./useAuthSession', () => ({
  useAuthSession: mocks.auth.useAuthSession
}));

vi.mock('./useCheckoutFlow', () => ({
  useCheckoutFlow: mocks.checkout.useCheckoutFlow
}));

vi.mock('./useOrderBoard', () => ({
  useOrderBoard: mocks.orderBoard.useOrderBoard
}));

vi.mock('./useOrderDocuments', () => ({
  useOrderDocuments: mocks.documents.useOrderDocuments
}));

vi.mock('./useOrderDraft', () => ({
  useOrderDraft: mocks.orderDraft.useOrderDraft
}));

vi.mock('./useRealtimeSync', () => ({
  useRealtimeSync: mocks.realtime.useRealtimeSync
}));

vi.mock('./useRefreshScheduler', () => ({
  useRefreshScheduler: mocks.refresh.useRefreshScheduler
}));

vi.mock('./useRestaurantData', () => ({
  useRestaurantData: mocks.restaurantData.useRestaurantData
}));

describe('useRestaurantApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.options = null;
    mocks.refresh.options = null;

    mocks.appError.useAppError.mockReturnValue({ error: null, setError: mocks.appError.setError });
    mocks.checkout.useCheckoutFlow.mockReturnValue({ resetCheckoutState: mocks.checkout.resetCheckoutState });
    mocks.auth.useAuthSession.mockImplementation((options) => {
      mocks.auth.options = options;
      return { user: staffUser, isSessionLoading: false };
    });
    mocks.orderBoard.prepareFiltersForRole.mockReturnValue(nextFilters);
    mocks.orderBoard.useOrderBoard.mockReturnValue({
      filters: mocks.orderBoard.filters,
      applyOrderList: mocks.orderBoard.applyOrderList,
      clearOrders: mocks.orderBoard.clearOrders,
      prepareFiltersForRole: mocks.orderBoard.prepareFiltersForRole,
      updateOrderInList: mocks.orderBoard.updateOrderInList
    });
    mocks.documents.useOrderDocuments.mockReturnValue({ resetDocuments: mocks.documents.resetDocuments });
    mocks.restaurantData.useRestaurantData.mockReturnValue({
      menuItems: [],
      menuBundles: [],
      adminMenuItems: [],
      adminMenuBundles: [],
      restaurantTables: [],
      staffUsers: [],
      isLoading: false,
      setMenuItems: mocks.restaurantData.setMenuItems,
      setMenuBundles: mocks.restaurantData.setMenuBundles,
      setAdminMenuItems: mocks.restaurantData.setAdminMenuItems,
      setAdminMenuBundles: mocks.restaurantData.setAdminMenuBundles,
      setRestaurantTables: mocks.restaurantData.setRestaurantTables,
      setStaffUsers: mocks.restaurantData.setStaffUsers,
      loadData: mocks.restaurantData.loadData,
      refreshTables: mocks.restaurantData.refreshTables,
      clearData: mocks.restaurantData.clearData
    });
    mocks.orderDraft.useOrderDraft.mockReturnValue({
      initializeForUser: mocks.orderDraft.initializeForUser,
      resetOrderDraft: mocks.orderDraft.resetOrderDraft,
      removeSelectedBundle: mocks.orderDraft.removeSelectedBundle,
      removeSelectedItemVariants: mocks.orderDraft.removeSelectedItemVariants,
      retainSelectedBundles: mocks.orderDraft.retainSelectedBundles
    });
    mocks.adminManagement.useAdminManagement.mockReturnValue({ handleSoldOutChange: vi.fn(), handleTableCleaned: vi.fn() });
    mocks.refresh.useRefreshScheduler.mockImplementation((options) => {
      mocks.refresh.options = options;
      return {
        scheduleOrderListRefresh: mocks.refresh.scheduleOrderListRefresh,
        scheduleRealtimeDataRefresh: mocks.refresh.scheduleRealtimeDataRefresh,
        clearScheduledRefreshes: mocks.refresh.clearScheduledRefreshes
      };
    });
  });

  it('loads role-specific data after authentication', async () => {
    renderHook(() => useRestaurantApp());

    await act(async () => {
      await mocks.auth.options?.onAuthenticated(staffUser);
    });

    expect(mocks.orderDraft.initializeForUser).toHaveBeenCalledWith(staffUser);
    expect(mocks.orderBoard.prepareFiltersForRole).toHaveBeenCalledWith(staffUser);
    expect(mocks.restaurantData.loadData).toHaveBeenCalledWith(staffUser, nextFilters);
  });

  it('clears composed application state when authentication resets', () => {
    renderHook(() => useRestaurantApp());

    act(() => {
      mocks.auth.options?.onReset();
    });

    expect(mocks.orderBoard.clearOrders).toHaveBeenCalledOnce();
    expect(mocks.restaurantData.clearData).toHaveBeenCalledOnce();
    expect(mocks.orderDraft.resetOrderDraft).toHaveBeenCalledOnce();
    expect(mocks.documents.resetDocuments).toHaveBeenCalledOnce();
    expect(mocks.checkout.resetCheckoutState).toHaveBeenCalledOnce();
    expect(mocks.refresh.clearScheduledRefreshes).toHaveBeenCalledOnce();
  });

  it('connects realtime updates to the silent refresh scheduler', () => {
    renderHook(() => useRestaurantApp());

    expect(mocks.realtime.useRealtimeSync).toHaveBeenCalledWith(staffUser, mocks.refresh.scheduleRealtimeDataRefresh);

    act(() => {
      mocks.refresh.options?.onRefresh();
    });

    expect(mocks.restaurantData.loadData).toHaveBeenCalledWith(staffUser, mocks.orderBoard.filters, { silent: true });
  });
});

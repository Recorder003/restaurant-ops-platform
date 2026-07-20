import {
  extraChairsAllowed,
  taxRate
} from '../config/appConfig';
import { useState } from 'react';
import { useAppError } from '../context/AppErrorContext';
import { useAdminManagement } from './useAdminManagement';
import { useAuthSession } from './useAuthSession';
import { useCheckoutFlow } from './useCheckoutFlow';
import { useOrderBoard } from './useOrderBoard';
import { useOrderDraft } from './useOrderDraft';
import { useOrderDocuments } from './useOrderDocuments';
import { useRealtimeSync } from './useRealtimeSync';
import { useRefreshScheduler } from './useRefreshScheduler';
import { useRestaurantData } from './useRestaurantData';
import type { User } from '../types';

export function useRestaurantApp() {
  const { error, setError } = useAppError();
  const [dataRefreshVersion, setDataRefreshVersion] = useState(0);
  const checkout = useCheckoutFlow({ taxRate, onError: setError, onOrderUpdated: (order) => updateOrderInList(order) });
  const { resetCheckoutState } = checkout;
  const authSession = useAuthSession({
    onAuthenticated: handleAuthenticatedUser,
    onReset: resetAuthenticatedData,
    onError: setError
  });
  const {
    user,
    isSessionLoading
  } = authSession;
  const orderBoard = useOrderBoard({
    user,
    onError: setError,
    onDineInOrderFinished: () => refreshTables(),
    onChefOrderReady: () => scheduleOrderListRefresh()
  });
  const {
    filters: orderFilters,
    applyOrderList,
    clearOrders,
    prepareFiltersForRole,
    updateOrderInList
  } = orderBoard;
  const documents = useOrderDocuments(setError);
  const {
    resetDocuments
  } = documents;
  const restaurantData = useRestaurantData({
    user,
    orderFilters,
    applyOrderList,
    onError: setError
  });
  const {
    menuItems,
    menuBundles,
    adminMenuItems,
    adminMenuBundles,
    restaurantTables,
    staffUsers,
    isLoading,
    setMenuItems,
    setMenuBundles,
    setAdminMenuItems,
    setAdminMenuBundles,
    setRestaurantTables,
    setStaffUsers,
    loadData,
    refreshTables,
    clearData
  } = restaurantData;
  const orderDraft = useOrderDraft({
    user,
    menuItems,
    menuBundles,
    restaurantTables,
    extraChairsAllowed,
    onSaved: () => loadData(),
    onError: setError
  });
  const {
    initializeForUser,
    resetOrderDraft,
    removeSelectedBundle,
    removeSelectedItemVariants,
    retainSelectedBundles
  } = orderDraft;
  const adminManagement = useAdminManagement({
    user,
    staffUsers,
    setStaffUsers,
    tables: restaurantTables,
    setTables: setRestaurantTables,
    setMenuItems,
    setMenuBundles,
    setAdminMenuItems,
    setAdminMenuBundles,
    removeSelectedBundle,
    removeSelectedItemVariants,
    retainSelectedBundles,
    onError: setError
  });
  const {
    scheduleOrderListRefresh,
    scheduleRealtimeDataRefresh,
    clearScheduledRefreshes
  } = useRefreshScheduler({
    onRefresh: () => {
      void Promise.resolve(loadData(user, orderFilters, { silent: true })).finally(() => {
        setDataRefreshVersion((version) => version + 1);
      });
    }
  });

  useRealtimeSync(user, scheduleRealtimeDataRefresh);

  async function handleAuthenticatedUser(authenticatedUser: User) {
    initializeForUser(authenticatedUser);
    const nextFilters = prepareFiltersForRole(authenticatedUser);
    await loadData(authenticatedUser, nextFilters);
  }

  function resetAuthenticatedData() {
    clearOrders();
    clearData();
    resetOrderDraft();
    resetDocuments();
    resetCheckoutState();
    clearScheduledRefreshes();
  }

  return {
    error,
    authSession,
    user,
    isSessionLoading,
    isLoading,
    menuItems,
    menuBundles,
    adminMenuItems,
    adminMenuBundles,
    restaurantTables,
    staffUsers,
    orderBoard,
    orderDraft,
    documents,
    checkout,
    adminManagement,
    dataRefreshVersion,
    refreshData: async () => {
      await Promise.resolve(loadData());
      setDataRefreshVersion((version) => version + 1);
    }
  };
}

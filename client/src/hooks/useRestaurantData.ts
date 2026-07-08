import { useState } from 'react';
import {
  fetchAdminMenuBundles,
  fetchAdminMenuItems,
  fetchMenuBundles,
  fetchMenuItems,
  fetchOrders,
  fetchStaffUsers,
  fetchTables
} from '../api';
import type { OrderFilterState } from '../components/OrderBoard';
import type { MenuBundle, MenuItem, Order, RestaurantTable, User } from '../types';
import { toOrderApiFilters } from '../utils/orderFilterUtils';

type OrderListResult = {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type UseRestaurantDataOptions = {
  user: User | null;
  orderFilters: OrderFilterState;
  applyOrderList: (result: OrderListResult) => void;
  onError: (message: string | null) => void;
};

export function useRestaurantData({
  user,
  orderFilters,
  applyOrderList,
  onError
}: UseRestaurantDataOptions) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuBundles, setMenuBundles] = useState<MenuBundle[]>([]);
  const [adminMenuItems, setAdminMenuItems] = useState<MenuItem[]>([]);
  const [adminMenuBundles, setAdminMenuBundles] = useState<MenuBundle[]>([]);
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function loadData(
    currentUser = user,
    filters = orderFilters,
    options: { silent?: boolean } = {}
  ) {
    try {
      if (!options.silent) {
        setIsLoading(true);
      }

      const [menu, bundles, orderList, staffList, adminMenu, adminBundles, tables] = await Promise.all([
        fetchMenuItems(),
        fetchMenuBundles(),
        fetchOrders(toOrderApiFilters(filters, currentUser)),
        currentUser?.role === 'admin' ? fetchStaffUsers() : Promise.resolve([]),
        currentUser?.role === 'admin' || currentUser?.role === 'chef' ? fetchAdminMenuItems() : Promise.resolve([]),
        currentUser?.role === 'admin' ? fetchAdminMenuBundles() : Promise.resolve([]),
        currentUser ? fetchTables() : Promise.resolve([])
      ]);

      setMenuItems(menu);
      setMenuBundles(bundles);
      applyOrderList(orderList);
      setStaffUsers(staffList);
      setAdminMenuItems(adminMenu);
      setAdminMenuBundles(adminBundles);
      setRestaurantTables(tables);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }

  async function refreshTables() {
    setRestaurantTables(await fetchTables());
  }

  function clearData() {
    setMenuItems([]);
    setMenuBundles([]);
    setAdminMenuItems([]);
    setAdminMenuBundles([]);
    setRestaurantTables([]);
    setStaffUsers([]);
  }

  return {
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
  };
}


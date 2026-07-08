import { useState, type FormEvent } from 'react';
import {
  fetchOrders,
  updateOrderItemStatus,
  updateOrderStatus
} from '../api';
import type { OrderFilterState } from '../components/OrderBoard';
import type { Order, OrderItem, OrderItemStatus, OrderStatus, User } from '../types';
import { getOrderTitle } from '../utils/orderDraftUtils';
import {
  doesOrderMatchCurrentStatusFilter,
  getDefaultStatusFilter,
  toOrderApiFilters
} from '../utils/orderFilterUtils';

type OrderPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type OrderListResult = {
  orders: Order[];
  pagination: OrderPagination;
};

type UseOrderBoardOptions = {
  user: User | null;
  onError: (message: string | null) => void;
  onDineInOrderFinished: () => Promise<void>;
  onChefOrderReady: () => void;
};

const initialFilters: OrderFilterState = {
  status: 'active',
  tableNumber: '',
  serverName: '',
  fromDate: '',
  toDate: '',
  page: 1,
  limit: 8
};

const initialPagination: OrderPagination = {
  page: 1,
  limit: 8,
  total: 0,
  totalPages: 0
};

export function useOrderBoard({
  user,
  onError,
  onDineInOrderFinished,
  onChefOrderReady
}: UseOrderBoardOptions) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filters, setFilters] = useState<OrderFilterState>(initialFilters);
  const [pagination, setPagination] = useState<OrderPagination>(initialPagination);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [processingOrderActionId, setProcessingOrderActionId] = useState<string | null>(null);
  const [processingItemActionId, setProcessingItemActionId] = useState<string | null>(null);

  function applyOrderList(result: OrderListResult) {
    setOrders(result.orders);
    setPagination(result.pagination);
  }

  function clearOrders() {
    setOrders([]);
    setPagination(initialPagination);
    setProcessingOrderActionId(null);
    setProcessingItemActionId(null);
  }

  function prepareFiltersForRole(nextUser: User) {
    const nextFilters = {
      ...filters,
      status: getDefaultStatusFilter(nextUser.role, filters.status),
      page: 1
    };
    setFilters(nextFilters);
    return nextFilters;
  }

  function updateOrderInList(updated: Order) {
    setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
  }

  async function reloadOrders(nextFilters = filters) {
    try {
      setIsLoadingOrders(true);
      applyOrderList(await fetchOrders(toOrderApiFilters(nextFilters, user)));
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load orders');
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    if (status === 'cancelled' && !window.confirm(`Cancel ${getOrderTitle(order)}? This action cannot be undone.`)) {
      return;
    }

    const actionId = `${order.id}:${status}`;

    try {
      setProcessingOrderActionId(actionId);
      const updated = await updateOrderStatus(order.id, status);
      replaceMatchingOrder(updated);

      if (user?.role === 'chef' && updated.status === 'ready') {
        onChefOrderReady();
      }

      if (updated.fulfillmentType === 'dine_in' && (updated.status === 'served' || updated.status === 'cancelled')) {
        await onDineInOrderFinished();
      }

      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update order status');
    } finally {
      setProcessingOrderActionId(null);
    }
  }

  async function handleItemStatusChange(order: Order, item: OrderItem, status: OrderItemStatus) {
    const actionId = `${item.id}:${status}`;

    try {
      setProcessingItemActionId(actionId);
      const updated = await updateOrderItemStatus(order.id, item.id, status);
      replaceMatchingOrder(updated);

      if (updated.fulfillmentType === 'dine_in' && updated.status === 'served') {
        await onDineInOrderFinished();
      }

      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to update item status');
    } finally {
      setProcessingItemActionId(null);
    }
  }

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = {
      ...filters,
      status: getDefaultStatusFilter(user?.role, filters.status),
      page: 1
    };
    setFilters(nextFilters);
    await reloadOrders(nextFilters);
  }

  async function handleFilterReset() {
    const nextFilters: OrderFilterState = {
      status: getDefaultStatusFilter(user?.role),
      tableNumber: '',
      serverName: '',
      fromDate: '',
      toDate: '',
      page: 1,
      limit: filters.limit
    };
    setFilters(nextFilters);
    await reloadOrders(nextFilters);
  }

  async function handlePageChange(page: number) {
    const nextFilters = { ...filters, page };
    setFilters(nextFilters);
    await reloadOrders(nextFilters);
  }

  function replaceMatchingOrder(updated: Order) {
    setOrders((current) => {
      if (!doesOrderMatchCurrentStatusFilter(updated, filters.status)) {
        return current.filter((order) => order.id !== updated.id);
      }

      return current.map((order) => (order.id === updated.id ? updated : order));
    });
  }

  return {
    orders,
    filteredOrders: orders,
    filters,
    pagination,
    isLoadingOrders,
    processingOrderActionId,
    processingItemActionId,
    setFilters,
    applyOrderList,
    clearOrders,
    prepareFiltersForRole,
    updateOrderInList,
    reloadOrders,
    handleStatusChange,
    handleItemStatusChange,
    handleFilterSubmit,
    handleFilterReset,
    handlePageChange
  };
}

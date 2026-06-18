import type { OrderFilterState } from '../components/OrderBoard';
import type { Order, OrderEvent, OrderFilters, OrderStatus, User, UserRole } from '../types';
import { formatMoney } from './formatters';
import { statusLabels } from './orderRules';

export function formatOrderEvent(event: OrderEvent) {
  if (event.eventType === 'order_created') {
    return 'Order created';
  }

  if (event.eventType === 'order_updated') {
    return 'Order updated';
  }

  if (event.eventType === 'payment_recorded') {
    return `Payment recorded${event.paymentMethod ? ` / ${event.paymentMethod}` : ''}${event.paymentTotalCents ? ` / ${formatMoney(event.paymentTotalCents)}` : ''}`;
  }

  if (event.fromStatus && event.toStatus) {
    return `${statusLabels[event.fromStatus]} -> ${statusLabels[event.toStatus]}`;
  }

  return 'Status changed';
}

export function getDefaultStatusFilter(role?: UserRole, current?: OrderFilterState['status']): OrderFilterState['status'] {
  if (role === 'staff') {
    return current && current !== 'all' ? current : 'active';
  }

  if (role === 'chef') {
    return current && isKitchenStatus(current) ? current : 'all';
  }

  return current ?? 'all';
}

export function doesOrderMatchCurrentStatusFilter(order: Order, status: OrderFilterState['status']) {
  if (status === 'all') {
    return true;
  }

  if (status === 'active') {
    return order.status !== 'cancelled' && order.paymentStatus !== 'paid';
  }

  return order.status === status;
}

export function toOrderApiFilters(filters: OrderFilterState, user: User | null): OrderFilters {
  const isStaffView = user?.role === 'staff';
  const shouldLimitStaffToToday = isStaffView && filters.status !== 'active';
  const today = getTodayDateInputValue();

  return {
    page: filters.page,
    limit: filters.limit,
    ...(filters.status !== 'all' && filters.status !== 'active' ? { status: filters.status } : {}),
    ...(filters.status === 'active' ? { activeOnly: true } : {}),
    ...(filters.tableNumber ? { tableNumber: filters.tableNumber } : {}),
    ...(isStaffView && user ? { serverName: user.name } : filters.serverName ? { serverName: filters.serverName } : {}),
    ...(shouldLimitStaffToToday ? { fromDate: today } : !isStaffView && filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(shouldLimitStaffToToday ? { toDate: today } : !isStaffView && filters.toDate ? { toDate: filters.toDate } : {})
  };
}

function isKitchenStatus(status: OrderStatus | 'all' | 'active') {
  return status === 'all' || status === 'pending' || status === 'preparing';
}

function getTodayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

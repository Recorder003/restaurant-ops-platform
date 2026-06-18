import type { Order, OrderItem, OrderItemStatus, OrderStatus, UserRole } from '../types';

export const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled'
};

export const itemStatusLabels: Record<OrderItemStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served'
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served'
};

const itemNextStatus: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served'
};

export function getAllowedNextStatus(status: OrderStatus, role: UserRole) {
  if (role === 'admin') {
    return nextStatus[status];
  }

  if (role === 'chef') {
    if (status === 'pending') {
      return 'preparing';
    }

    if (status === 'preparing') {
      return 'ready';
    }
  }

  if (role === 'staff' && status === 'ready') {
    return 'served';
  }

  return undefined;
}

export function getVisibleOrderItems(order: Order, role: UserRole) {
  return role === 'chef' ? order.items.filter((item) => item.isKitchenItem) : order.items;
}

export function getAllowedNextItemStatus(item: OrderItem, role: UserRole) {
  const status = item.status;

  if (role === 'admin') {
    return itemNextStatus[status];
  }

  if (role === 'chef') {
    if (!item.isKitchenItem) {
      return undefined;
    }

    if (status === 'pending') {
      return 'preparing';
    }

    if (status === 'preparing') {
      return 'ready';
    }
  }

  if (role === 'staff' && !item.isKitchenItem && status === 'pending') {
    return 'served';
  }

  if (role === 'staff' && status === 'ready') {
    return 'served';
  }

  return undefined;
}

export function getItemActionLabel(item: OrderItem, role: UserRole) {
  const status = item.status;
  const next = getAllowedNextItemStatus(item, role);

  if (!next) {
    return '';
  }

  if (role === 'chef' && status === 'pending') {
    return 'Prepare';
  }

  if (role === 'chef' && status === 'preparing') {
    return 'Mark Ready';
  }

  if (role === 'staff' && status === 'ready') {
    return 'Served';
  }

  if (role === 'staff' && !item.isKitchenItem && status === 'pending') {
    return 'Served';
  }

  return itemStatusLabels[next];
}

export function canCancelOrder(status: OrderStatus, role: UserRole) {
  if (role === 'admin') {
    return status !== 'served' && status !== 'cancelled';
  }

  return role === 'staff' && status === 'pending';
}

export function canEditOrder(status: OrderStatus, role: UserRole) {
  return status === 'pending' && (role === 'staff' || role === 'admin');
}

export function canCheckoutOrder(order: Order, role: UserRole) {
  return (role === 'staff' || role === 'admin') && order.status === 'served' && order.paymentStatus !== 'paid';
}

import type { DraftItem, MenuItem, Order, OrderStatus } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export async function fetchMenuItems(): Promise<MenuItem[]> {
  return request('/menu-items');
}

export async function fetchOrders(): Promise<Order[]> {
  return request('/orders');
}

export async function createOrder(input: {
  tableNumber: string;
  serverName: string;
  notes?: string;
  items: DraftItem[];
}): Promise<Order> {
  return request('/orders', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return request(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? `Request failed with status ${response.status}`);
  }

  return response.json();
}

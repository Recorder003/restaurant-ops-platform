import type {
  DraftItem,
  FulfillmentType,
  MenuItem,
  Order,
  OrderEvent,
  OrderFilters,
  OrderListResponse,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  RestaurantTable,
  TableStatus,
  User
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';
const TOKEN_STORAGE_KEY = 'restaurant_ops_token';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function login(input: { email: string; password: string }): Promise<{ accessToken: string; user: User }> {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function fetchCurrentUser(): Promise<User> {
  return request('/auth/me', {
    token: getStoredToken()
  });
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  return request('/menu-items');
}

export async function fetchAdminMenuItems(): Promise<MenuItem[]> {
  return request('/menu-items/admin', {
    token: getStoredToken()
  });
}

export async function fetchOrders(filters: OrderFilters): Promise<OrderListResponse> {
  const params = new URLSearchParams();
  params.set('page', filters.page.toString());
  params.set('limit', filters.limit.toString());

  if (filters.status) {
    params.set('status', filters.status);
  }

  if (filters.tableNumber) {
    params.set('tableNumber', filters.tableNumber);
  }

  if (filters.serverName) {
    params.set('serverName', filters.serverName);
  }

  if (filters.fromDate) {
    params.set('fromDate', filters.fromDate);
  }

  if (filters.toDate) {
    params.set('toDate', filters.toDate);
  }

  return request(`/orders?${params.toString()}`, {
    token: getStoredToken()
  });
}

export async function fetchTables(): Promise<RestaurantTable[]> {
  return request('/tables', {
    token: getStoredToken()
  });
}

export async function updateTable(id: string, input: Partial<{
  name: string;
  capacity: number;
  status: TableStatus;
}>): Promise<RestaurantTable> {
  return request(`/tables/${id}`, {
    method: 'PATCH',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function createTable(input: { name: string; capacity: number }): Promise<RestaurantTable> {
  return request('/tables', {
    method: 'POST',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function deleteTable(id: string): Promise<void> {
  await request(`/tables/${id}`, {
    method: 'DELETE',
    token: getStoredToken()
  });
}

export async function fetchStaffUsers(): Promise<User[]> {
  return request('/admin/staff', {
    token: getStoredToken()
  });
}

export async function createStaffUser(input: {
  name: string;
  email: string;
  password: string;
  role: User['role'];
}): Promise<User> {
  return request('/admin/staff', {
    method: 'POST',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function updateStaffUser(id: string, input: {
  name?: string;
  role?: User['role'];
  isActive?: boolean;
}): Promise<User> {
  return request(`/admin/staff/${id}`, {
    method: 'PATCH',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function deleteStaffUser(id: string): Promise<void> {
  await request(`/admin/staff/${id}`, {
    method: 'DELETE',
    token: getStoredToken()
  });
}

export async function createMenuItem(input: {
  name: string;
  category: string;
  priceCents: number;
  isAvailable: boolean;
  isSoldOut: boolean;
}): Promise<MenuItem> {
  return request('/menu-items', {
    method: 'POST',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function updateMenuItem(id: string, input: Partial<{
  name: string;
  category: string;
  priceCents: number;
  isAvailable: boolean;
  isSoldOut: boolean;
}>): Promise<MenuItem> {
  return request(`/menu-items/${id}`, {
    method: 'PATCH',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function updateMenuItemSoldOut(id: string, isSoldOut: boolean): Promise<MenuItem> {
  return request(`/menu-items/${id}/sold-out`, {
    method: 'PATCH',
    token: getStoredToken(),
    body: JSON.stringify({ isSoldOut })
  });
}

export async function createOrder(input: {
  orderSource: OrderSource;
  fulfillmentType: FulfillmentType;
  tableNumber?: string;
  partySize?: number;
  phoneNumber?: string;
  serverName: string;
  notes?: string;
  items: DraftItem[];
}): Promise<Order> {
  return request('/orders', {
    method: 'POST',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function updateOrder(id: string, input: {
  orderSource: OrderSource;
  fulfillmentType: FulfillmentType;
  tableNumber?: string;
  partySize?: number;
  phoneNumber?: string;
  serverName: string;
  notes?: string;
  items: DraftItem[];
}): Promise<Order> {
  return request(`/orders/${id}`, {
    method: 'PATCH',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  return request(`/orders/${id}/status`, {
    method: 'PATCH',
    token: getStoredToken(),
    body: JSON.stringify({ status })
  });
}

export async function checkoutOrder(id: string, input: {
  paymentMethod: PaymentMethod;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
}): Promise<Order> {
  return request(`/orders/${id}/checkout`, {
    method: 'POST',
    token: getStoredToken(),
    body: JSON.stringify(input)
  });
}

export async function fetchOrderEvents(id: string): Promise<OrderEvent[]> {
  return request(`/orders/${id}/events`, {
    token: getStoredToken()
  });
}

type ApiRequestInit = RequestInit & {
  token?: string | null;
};

async function request<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

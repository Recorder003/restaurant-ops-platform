export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderEventType = 'order_created' | 'order_updated' | 'status_changed';
export type UserRole = 'staff' | 'admin' | 'chef';
export type OrderSource = 'in_person' | 'phone';
export type FulfillmentType = 'dine_in' | 'to_go' | 'pickup' | 'delivery';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  isAvailable: boolean;
  isSoldOut: boolean;
};

export type OrderItem = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  priceCents: number;
};

export type Order = {
  id: string;
  orderSource: OrderSource;
  fulfillmentType: FulfillmentType;
  tableNumber: string | null;
  partySize: number | null;
  phoneNumber: string | null;
  serverName: string;
  status: OrderStatus;
  notes: string | null;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type OrderEvent = {
  id: string;
  orderId: string;
  eventType: OrderEventType;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus | null;
  actorUserId: string | null;
  actorName: string;
  actorRole: UserRole;
  createdAt: string;
};

export type DraftItem = {
  menuItemId: string;
  quantity: number;
};

export type OrderFilters = {
  status?: OrderStatus;
  tableNumber?: string;
  serverName?: string;
  fromDate?: string;
  toDate?: string;
  page: number;
  limit: number;
};

export type OrderListResponse = {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

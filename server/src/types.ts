export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served';
export type OrderEventType = 'order_created' | 'order_updated' | 'status_changed' | 'payment_recorded';
export type OrderSource = 'in_person' | 'phone';
export type FulfillmentType = 'dine_in' | 'to_go' | 'pickup' | 'delivery';
export type UserRole = 'staff' | 'admin' | 'chef';
export type TableStatus = 'available' | 'occupied' | 'needs_cleaning';
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card';

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

export type RestaurantTable = {
  id: string;
  name: string;
  capacity: number;
  status: TableStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrderItem = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  priceCents: number;
  status: OrderItemStatus;
  preparedAt: string | null;
  servedAt: string | null;
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
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  paymentSubtotalCents: number | null;
  paymentTaxCents: number | null;
  paymentTipCents: number | null;
  paymentTotalCents: number | null;
  paidAt: string | null;
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
  paymentMethod: PaymentMethod | null;
  paymentTotalCents: number | null;
  actorUserId: string | null;
  actorName: string;
  actorRole: UserRole;
  createdAt: string;
};

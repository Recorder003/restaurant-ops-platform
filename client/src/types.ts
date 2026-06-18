export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'served';
export type OrderEventType = 'order_created' | 'order_updated' | 'status_changed' | 'payment_recorded';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card';
export type UserRole = 'staff' | 'admin' | 'chef';
export type OrderSource = 'in_person' | 'phone';
export type FulfillmentType = 'dine_in' | 'to_go' | 'pickup' | 'delivery';
export type TableStatus = 'available' | 'occupied' | 'needs_cleaning';

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
  variants: MenuItemVariant[];
};

export type MenuItemVariant = {
  id: string;
  menuItemId: string;
  name: string;
  priceCents: number;
  isDefault: boolean;
};

export type MenuBundle = {
  id: string;
  name: string;
  priceCents: number;
  isAvailable: boolean;
  isSoldOut: boolean;
  items: MenuBundleItem[];
};

export type MenuBundleItem = {
  menuItemId: string;
  menuItemVariantId: string;
  menuItemName: string;
  variantName: string;
  category: string;
  quantity: number;
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
  menuItemVariantId: string;
  menuItemName: string;
  menuItemCategory: string;
  variantName: string;
  bundleId: string | null;
  bundleName: string | null;
  quantity: number;
  priceCents: number;
  status: OrderItemStatus;
  preparedAt: string | null;
  servedAt: string | null;
  isKitchenItem: boolean;
  paymentId: string | null;
};

export type OrderPayment = {
  id: string;
  orderId: string;
  paymentMethod: PaymentMethod;
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  actorName: string;
  actorRole: UserRole;
  createdAt: string;
  itemIds: string[];
};

export type SplitBill = {
  id: string;
  label: string;
  itemIds: string[];
  amountCents?: number;
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
  payments: OrderPayment[];
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

export type DraftItem = {
  menuItemId?: string;
  menuItemVariantId?: string;
  bundleId?: string;
  quantity: number;
};

export type OrderFilters = {
  status?: OrderStatus;
  activeOnly?: boolean;
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

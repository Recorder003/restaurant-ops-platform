export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type OrderSource = 'in_person' | 'phone';
export type FulfillmentType = 'dine_in' | 'to_go' | 'pickup' | 'delivery';
export type UserRole = 'staff' | 'admin' | 'chef';

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

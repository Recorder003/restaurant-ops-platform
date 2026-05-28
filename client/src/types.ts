export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
export type UserRole = 'staff' | 'admin';

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
  tableNumber: string;
  serverName: string;
  status: OrderStatus;
  notes: string | null;
  totalCents: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
};

export type DraftItem = {
  menuItemId: string;
  quantity: number;
};

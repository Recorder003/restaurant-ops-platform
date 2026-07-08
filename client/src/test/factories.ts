import type { MenuBundle, MenuItem, Order, OrderItem, RestaurantTable, User } from '../types';

const timestamp = '2026-01-01T12:00:00.000Z';

export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'staff-1',
    name: 'Kent',
    email: 'staff@example.com',
    role: 'staff',
    isActive: true,
    ...overrides
  };
}

export function createAdminUser(overrides: Partial<User> = {}): User {
  return createUser({
    id: 'admin-1',
    name: 'Mitch',
    email: 'admin@example.com',
    role: 'admin',
    ...overrides
  });
}

export function createStaffUser(overrides: Partial<User> = {}): User {
  return createUser({
    id: 'staff-1',
    name: 'Kent',
    email: 'staff@example.com',
    role: 'staff',
    ...overrides
  });
}

export function createChefUser(overrides: Partial<User> = {}): User {
  return createUser({
    id: 'chef-1',
    name: 'Sparky',
    email: 'chef@example.com',
    role: 'chef',
    ...overrides
  });
}

export function createRestaurantTable(overrides: Partial<RestaurantTable> = {}): RestaurantTable {
  return {
    id: 'table-1',
    name: 'T1',
    capacity: 4,
    status: 'available',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

export function createMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  const id = overrides.id ?? 'menu-1';

  return {
    id,
    name: 'Fried Rice',
    category: 'Entrees',
    priceCents: 1200,
    isAvailable: true,
    isSoldOut: false,
    variants: [{
      id: 'variant-1',
      menuItemId: id,
      name: 'Regular',
      priceCents: 1200,
      isDefault: true
    }],
    ...overrides
  };
}

export function createOrderItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    menuItemId: 'menu-1',
    menuItemVariantId: 'variant-1',
    menuItemName: 'Fried Rice',
    menuItemCategory: 'Entrees',
    variantName: 'Regular',
    bundleId: null,
    bundleName: null,
    quantity: 1,
    priceCents: 1200,
    status: 'served',
    preparedAt: null,
    servedAt: null,
    isKitchenItem: true,
    paymentId: null,
    ...overrides
  };
}

export function createMenuBundle(overrides: Partial<MenuBundle> = {}): MenuBundle {
  return {
    id: 'bundle-1',
    name: 'Lunch Combo',
    priceCents: 2000,
    isAvailable: true,
    isSoldOut: false,
    items: [{
      menuItemId: 'menu-1',
      menuItemVariantId: 'variant-1',
      menuItemName: 'Fried Rice',
      variantName: 'Regular',
      category: 'Entrees',
      quantity: 1,
      priceCents: 1200,
      isAvailable: true,
      isSoldOut: false
    }],
    ...overrides
  };
}

export function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderSource: 'in_person',
    fulfillmentType: 'dine_in',
    tableNumber: 'T1',
    partySize: 2,
    phoneNumber: null,
    serverName: 'Kent',
    status: 'served',
    paymentStatus: 'unpaid',
    paymentMethod: null,
    paymentSubtotalCents: null,
    paymentTaxCents: null,
    paymentTipCents: null,
    paymentTotalCents: null,
    paidAt: null,
    notes: null,
    totalCents: 1200,
    createdAt: timestamp,
    updatedAt: timestamp,
    items: [createOrderItem()],
    payments: [],
    ...overrides
  };
}

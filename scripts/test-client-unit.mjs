import assert from 'node:assert/strict';
import test from 'node:test';
import { execSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = fileURLToPath(new URL('../', import.meta.url));
const outputDir = join(rootDir, '.tmp/client-unit');

await rm(outputDir, { recursive: true, force: true });
execSync('npm run build:unit --workspace client', {
  cwd: rootDir,
  stdio: 'inherit'
});
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'package.json'), JSON.stringify({ type: 'module' }));
await addJsExtensionsForNodeEsm(outputDir);

const {
  canCancelOrder,
  canCheckoutOrder,
  canEditOrder,
  getAllowedNextItemStatus,
  getAllowedNextStatus,
  getItemActionLabel,
  getVisibleOrderItems
} = await import(pathToFileURL(join(outputDir, 'utils/orderRules.js')).href);
const {
  centsToDollarsInput,
  dollarsToCents,
  formatMoney
} = await import(pathToFileURL(join(outputDir, 'utils/formatters.js')).href);
const {
  compareMenuItems,
  formatMenuBundleItemLabel,
  formatMenuVariantLabel,
  getBundleComponentQuantity,
  getBundleItemsInput,
  getBundleQuantityMap,
  getMenuItemByVariantId,
  getMenuItemVariantById,
  getMenuVariantOptions,
  isAlwaysAvailableMenuItem,
  setBundleItemQuantity
} = await import(pathToFileURL(join(outputDir, 'utils/menuUtils.js')).href);
const {
  formatOrderItemName,
  getOrderFlowLabel,
  getOrderTitle,
  getSelectedBundlesFromOrder,
  getSelectedItemsFromOrder
} = await import(pathToFileURL(join(outputDir, 'utils/orderDraftUtils.js')).href);
const {
  doesOrderMatchCurrentStatusFilter,
  formatOrderEvent,
  getDefaultStatusFilter,
  toOrderApiFilters
} = await import(pathToFileURL(join(outputDir, 'utils/orderFilterUtils.js')).href);
const {
  arraysHaveSameItems,
  createInitialSplitBills,
  getNextPayableSplitBill,
  getNextSplitBillNumber,
  getSplitBillSubtotal,
  isPayableSplitBill,
  normalizeSplitBillsForUnpaidItems
} = await import(pathToFileURL(join(outputDir, 'utils/splitBillUtils.js')).href);
const {
  compareTables,
  getNextTableName,
  isProtectedDefaultTable
} = await import(pathToFileURL(join(outputDir, 'utils/tableUtils.js')).href);
const { isProtectedDefaultUser } = await import(pathToFileURL(join(outputDir, 'utils/userUtils.js')).href);
const {
  validateMenuBundleInput,
  validateMenuItemInput,
  validateStaffInput,
  validateTableInput
} = await import(pathToFileURL(join(outputDir, 'utils/adminFormValidation.js')).href);
const { validateOrderDraftInput } = await import(pathToFileURL(join(outputDir, 'utils/orderFormValidation.js')).href);

const baseOrder = {
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
  totalCents: 1000,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  payments: [],
  items: []
};

const kitchenItem = {
  id: 'item-1',
  menuItemId: 'menu-1',
  menuItemVariantId: 'variant-1',
  menuItemName: 'Noodles',
  menuItemCategory: 'Entrees',
  variantName: 'Regular',
  bundleId: null,
  bundleName: null,
  quantity: 1,
  priceCents: 1000,
  status: 'pending',
  preparedAt: null,
  servedAt: null,
  isKitchenItem: true,
  paymentId: null
};

const drinkItem = {
  ...kitchenItem,
  id: 'item-2',
  menuItemName: 'Lemon Iced Tea',
  menuItemCategory: 'Drinks',
  isKitchenItem: false
};

const regularVariant = {
  id: 'variant-regular',
  menuItemId: 'menu-regular',
  name: 'Regular',
  priceCents: 1200,
  isDefault: true
};

const largeVariant = {
  id: 'variant-large',
  menuItemId: 'menu-regular',
  name: 'Large',
  priceCents: 1500,
  isDefault: false
};

const menuItem = {
  id: 'menu-regular',
  name: 'Signature Beef Noodles',
  category: 'Entrees',
  priceCents: 1200,
  isAvailable: true,
  isSoldOut: false,
  variants: [regularVariant, largeVariant]
};

const soldOutMenuItem = {
  ...menuItem,
  id: 'menu-sold-out',
  name: 'Garlic Broccoli',
  category: 'Vegetables',
  isSoldOut: true,
  variants: [{
    ...regularVariant,
    id: 'variant-sold-out',
    menuItemId: 'menu-sold-out',
    priceCents: 880
  }]
};

const unavailableMenuItem = {
  ...menuItem,
  id: 'menu-unavailable',
  name: 'Mango Pudding',
  category: 'Desserts',
  isAvailable: false,
  variants: [{
    ...regularVariant,
    id: 'variant-unavailable',
    menuItemId: 'menu-unavailable',
    priceCents: 580
  }]
};

const menuBundle = {
  id: 'bundle-1',
  name: 'Lunch Combo',
  priceCents: 2380,
  isAvailable: true,
  isSoldOut: false,
  items: [
    {
      menuItemId: menuItem.id,
      menuItemVariantId: regularVariant.id,
      menuItemName: menuItem.name,
      variantName: regularVariant.name,
      category: menuItem.category,
      quantity: 1,
      priceCents: regularVariant.priceCents,
      isAvailable: true,
      isSoldOut: false
    },
    {
      menuItemId: soldOutMenuItem.id,
      menuItemVariantId: 'variant-sold-out',
      menuItemName: soldOutMenuItem.name,
      variantName: 'Large',
      category: soldOutMenuItem.category,
      quantity: 2,
      priceCents: 880,
      isAvailable: true,
      isSoldOut: false
    }
  ]
};

test('order-level status transitions are role scoped', () => {
  assert.equal(getAllowedNextStatus('pending', 'chef'), 'preparing');
  assert.equal(getAllowedNextStatus('preparing', 'chef'), 'ready');
  assert.equal(getAllowedNextStatus('ready', 'chef'), undefined);
  assert.equal(getAllowedNextStatus('ready', 'staff'), 'served');
  assert.equal(getAllowedNextStatus('pending', 'staff'), undefined);
  assert.equal(getAllowedNextStatus('served', 'admin'), undefined);
});

test('item-level workflow separates kitchen and staff-handled items', () => {
  assert.equal(getAllowedNextItemStatus(kitchenItem, 'chef'), 'preparing');
  assert.equal(getItemActionLabel(kitchenItem, 'chef'), 'Prepare');
  assert.equal(getAllowedNextItemStatus(drinkItem, 'chef'), undefined);
  assert.equal(getAllowedNextItemStatus(drinkItem, 'staff'), 'served');
  assert.equal(getItemActionLabel(drinkItem, 'staff'), 'Served');
});

test('chef only sees kitchen items', () => {
  const order = { ...baseOrder, items: [kitchenItem, drinkItem] };

  assert.deepEqual(getVisibleOrderItems(order, 'chef'), [kitchenItem]);
  assert.deepEqual(getVisibleOrderItems(order, 'staff'), [kitchenItem, drinkItem]);
});

test('edit, cancel, and checkout permissions match workflow rules', () => {
  assert.equal(canEditOrder('pending', 'staff'), true);
  assert.equal(canEditOrder('preparing', 'staff'), false);
  assert.equal(canCancelOrder('pending', 'staff'), true);
  assert.equal(canCancelOrder('served', 'admin'), false);
  assert.equal(canCheckoutOrder({ ...baseOrder, status: 'served', paymentStatus: 'unpaid' }, 'staff'), true);
  assert.equal(canCheckoutOrder({ ...baseOrder, status: 'served', paymentStatus: 'paid' }, 'staff'), false);
  assert.equal(canCheckoutOrder({ ...baseOrder, status: 'served', paymentStatus: 'unpaid' }, 'chef'), false);
});

test('money formatters convert display and input values consistently', () => {
  assert.equal(formatMoney(1234), '$12.34');
  assert.equal(dollarsToCents('12.345'), 1235);
  assert.equal(dollarsToCents('not-a-number'), 0);
  assert.equal(centsToDollarsInput(987), '9.87');
});

test('menu utilities protect seed items and expose only orderable variants', () => {
  const options = getMenuVariantOptions([soldOutMenuItem, unavailableMenuItem, menuItem]);

  assert.equal(isAlwaysAvailableMenuItem(menuItem), true);
  assert.equal(isAlwaysAvailableMenuItem(soldOutMenuItem), false);
  assert.deepEqual(options.map((option) => option.menuItemVariantId), [regularVariant.id, largeVariant.id]);
  assert.equal(formatMenuVariantLabel(menuItem, regularVariant), 'Signature Beef Noodles');
  assert.equal(formatMenuVariantLabel(menuItem, largeVariant), 'Signature Beef Noodles / Large');
  assert.equal(getMenuItemByVariantId([menuItem], largeVariant.id)?.id, menuItem.id);
  assert.equal(getMenuItemVariantById([menuItem], largeVariant.id)?.priceCents, 1500);
});

test('menu bundle helpers normalize quantities and component labels', () => {
  const quantities = setBundleItemQuantity({}, regularVariant.id, 2.8);
  const cleared = setBundleItemQuantity(quantities, regularVariant.id, 0);

  assert.deepEqual(quantities, { [regularVariant.id]: 2 });
  assert.deepEqual(cleared, {});
  assert.deepEqual(getBundleItemsInput({ [regularVariant.id]: 2, unused: 0 }), [
    { menuItemVariantId: regularVariant.id, quantity: 2 }
  ]);
  assert.deepEqual(getBundleQuantityMap(menuBundle), {
    [regularVariant.id]: 1,
    'variant-sold-out': 2
  });
  assert.equal(getBundleComponentQuantity(menuBundle, 'variant-sold-out'), 2);
  assert.equal(formatMenuBundleItemLabel(menuBundle.items[0]), 'Signature Beef Noodles');
  assert.equal(formatMenuBundleItemLabel(menuBundle.items[1]), 'Garlic Broccoli / Large');
});

test('table utilities sort and protect default tables', () => {
  const tables = [
    { id: 'a', name: 'Patio', capacity: 4, status: 'available', createdAt: '', updatedAt: '' },
    { id: 'b', name: 'T10', capacity: 4, status: 'available', createdAt: '', updatedAt: '' },
    { id: 'c', name: 'T2', capacity: 4, status: 'available', createdAt: '', updatedAt: '' }
  ];

  assert.deepEqual([...tables].sort(compareTables).map((table) => table.name), ['T2', 'T10', 'Patio']);
  assert.equal(getNextTableName(tables), 'T11');
  assert.equal(isProtectedDefaultTable(tables[2]), true);
  assert.equal(isProtectedDefaultTable(tables[0]), false);
});

test('default user protection only applies to seed accounts', () => {
  assert.equal(isProtectedDefaultUser({ id: 'u1', name: 'Admin', email: 'admin@example.com', role: 'admin', isActive: true }), true);
  assert.equal(isProtectedDefaultUser({ id: 'u2', name: 'New', email: 'new@example.com', role: 'staff', isActive: true }), false);
});

test('order draft helpers preserve item and combo selections', () => {
  const comboItem = {
    ...kitchenItem,
    id: 'item-combo-1',
    bundleId: menuBundle.id,
    bundleName: menuBundle.name,
    menuItemVariantId: regularVariant.id,
    quantity: 1
  };
  const comboItemTwo = {
    ...comboItem,
    id: 'item-combo-2',
    menuItemVariantId: 'variant-sold-out',
    quantity: 2
  };
  const order = {
    ...baseOrder,
    tableNumber: 'T3',
    partySize: 4,
    items: [
      { ...kitchenItem, menuItemVariantId: regularVariant.id, quantity: 2 },
      comboItem,
      comboItemTwo
    ]
  };

  assert.equal(getOrderTitle(order), 'Table T3 / 4 guests');
  assert.equal(getOrderTitle({ ...order, orderSource: 'phone', phoneNumber: '5551234' }), 'Phone 5551234');
  assert.equal(formatOrderItemName({ ...kitchenItem, bundleName: 'Lunch Combo', variantName: 'Large', quantity: 2 }), 'Lunch Combo / Noodles / Large x 2');
  assert.deepEqual(getSelectedItemsFromOrder(order), { [regularVariant.id]: 2 });
  assert.deepEqual(getSelectedBundlesFromOrder(order, [menuBundle]), { [menuBundle.id]: 1 });
  assert.equal(getOrderFlowLabel('phone', 'delivery', '', '', '5551234'), 'Delivery / 5551234');
  assert.equal(getOrderFlowLabel('in_person', 'dine_in', 'T3', '4', ''), 'T3 / 4 guests');
});

test('order filters translate role-specific defaults into API parameters', () => {
  const staffUser = { id: 'u-staff', name: 'Kent', email: 'staff@example.com', role: 'staff', isActive: true };
  const baseFilters = {
    status: 'active',
    tableNumber: '',
    serverName: '',
    fromDate: '',
    toDate: '',
    page: 2,
    limit: 8
  };

  assert.equal(getDefaultStatusFilter('staff', 'all'), 'active');
  assert.equal(getDefaultStatusFilter('chef', 'ready'), 'all');
  assert.equal(getDefaultStatusFilter('admin', 'active'), 'all');
  assert.equal(doesOrderMatchCurrentStatusFilter({ ...baseOrder, status: 'served', paymentStatus: 'paid' }, 'active'), false);
  assert.equal(doesOrderMatchCurrentStatusFilter({ ...baseOrder, status: 'ready', paymentStatus: 'unpaid' }, 'active'), true);
  assert.deepEqual(toOrderApiFilters(baseFilters, staffUser), {
    page: 2,
    limit: 8,
    activeOnly: true,
    serverName: 'Kent'
  });
  assert.equal(toOrderApiFilters({ ...baseFilters, status: 'pending' }, staffUser).fromDate.length, 10);
});

test('order event formatting covers creation, payment, and status changes', () => {
  const baseEvent = {
    id: 'event-1',
    orderId: 'order-1',
    eventType: 'status_changed',
    fromStatus: 'pending',
    toStatus: 'preparing',
    paymentMethod: null,
    paymentTotalCents: null,
    actorUserId: 'u1',
    actorName: 'Kent',
    actorRole: 'staff',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  assert.equal(formatOrderEvent({ ...baseEvent, eventType: 'order_created', fromStatus: null, toStatus: null }), 'Order created');
  assert.equal(formatOrderEvent({ ...baseEvent, eventType: 'payment_recorded', paymentMethod: 'card', paymentTotalCents: 3511, fromStatus: null, toStatus: null }), 'Payment recorded / card / $35.11');
  assert.equal(formatOrderEvent(baseEvent), 'Pending -> Preparing');
});

test('split bill helpers normalize unpaid item plans and amount splits', () => {
  const splitItems = [
    { ...kitchenItem, id: 'item-a', priceCents: 1200 },
    { ...kitchenItem, id: 'item-b', priceCents: 800 },
    { ...kitchenItem, id: 'item-c', priceCents: 500 }
  ];
  const initial = createInitialSplitBills(splitItems.map((item) => item.id));
  const normalized = normalizeSplitBillsForUnpaidItems([
    { id: 'split-1', label: 'Split 1', itemIds: ['item-a', 'old-item'] }
  ], ['item-a', 'item-b']);
  const amountSplit = { id: 'split-amount', label: 'Split 2', itemIds: [], amountCents: 1250 };

  assert.deepEqual(initial, [{ id: 'split-1', label: 'Split 1', itemIds: ['item-a', 'item-b', 'item-c'] }]);
  assert.deepEqual(normalized, [
    { id: 'split-1', label: 'Split 1', itemIds: ['item-a'] },
    { id: 'split-2', label: 'Split 2', itemIds: ['item-b'] }
  ]);
  assert.equal(getNextSplitBillNumber(normalized), 3);
  assert.equal(isPayableSplitBill(amountSplit), true);
  assert.equal(getSplitBillSubtotal(amountSplit, splitItems), 1250);
  assert.equal(getSplitBillSubtotal(normalized[0], splitItems), 1200);
  assert.equal(getNextPayableSplitBill(normalized, ['item-a'])?.id, 'split-2');
  assert.equal(arraysHaveSameItems(['a', 'b'], ['b', 'a']), true);
  assert.equal(arraysHaveSameItems(['a'], ['a', 'b']), false);
});

test('admin form validation returns field-specific errors', () => {
  assert.deepEqual(validateStaffInput({ name: '', email: 'bad-email', password: 'short' }), {
    name: 'Enter the employee name.',
    email: 'Enter a valid email address.',
    password: 'Password must be at least 8 characters.'
  });
  assert.deepEqual(validateStaffInput({ name: 'Maya', email: 'maya@example.com', password: 'Password1!' }), {});

  assert.deepEqual(validateMenuItemInput({ name: '', price: '0' }), {
    name: 'Enter the menu item name.',
    price: 'Enter a price greater than $0.00.'
  });
  assert.deepEqual(validateMenuItemInput({ name: 'Fried Rice', price: '12.50' }), {});

  assert.deepEqual(validateMenuBundleInput({ name: '', price: '0', items: {} }), {
    name: 'Enter the combo name.',
    price: 'Enter a combo price greater than $0.00.',
    items: 'Choose at least one item for this combo.'
  });
  assert.deepEqual(validateMenuBundleInput({ name: 'Lunch Combo', price: '20.00', items: { [regularVariant.id]: 1 } }), {});

  assert.deepEqual(validateTableInput({ name: '', capacity: '0' }), {
    name: 'Enter the table name.',
    capacity: 'Seats must be at least 1.'
  });
  assert.deepEqual(validateTableInput({ name: 'T20', capacity: '4' }), {});
});

test('order draft validation returns step-specific errors', () => {
  const baseInput = {
    fulfillmentType: 'dine_in',
    orderSource: 'in_person',
    tableNumber: '',
    partySize: '0',
    phoneNumber: '',
    serverName: '',
    itemCount: 0,
    maxPartySize: 6,
    selectedTableCapacity: 4,
    requireItems: true
  };

  assert.deepEqual(validateOrderDraftInput(baseInput), {
    tableNumber: 'Choose an available table before continuing.',
    partySize: 'Enter at least 1 guest.',
    serverName: 'Enter the server name.',
    items: 'Select at least one menu item before submitting.'
  });

  assert.deepEqual(validateOrderDraftInput({
    ...baseInput,
    tableNumber: 'T4',
    partySize: '7',
    serverName: 'Kent',
    itemCount: 1
  }), {
    partySize: 'This table seats 4. Maximum party size is 6 with extra chairs.'
  });

  assert.deepEqual(validateOrderDraftInput({
    ...baseInput,
    fulfillmentType: 'pickup',
    orderSource: 'phone',
    partySize: '',
    serverName: 'Kent',
    itemCount: 1,
    requireItems: false
  }), {
    phoneNumber: 'Enter the customer phone number.'
  });

  assert.deepEqual(validateOrderDraftInput({
    ...baseInput,
    tableNumber: 'T4',
    partySize: '4',
    serverName: 'Kent',
    itemCount: 2
  }), {});
});

async function addJsExtensionsForNodeEsm(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      await addJsExtensionsForNodeEsm(path);
      return;
    }

    if (!entry.name.endsWith('.js')) {
      return;
    }

    const source = await readFile(path, 'utf8');
    const updated = source.replace(/from\s+(['"])(\.\.?\/[^'"]+?)(?<!\.js)\1/g, 'from $1$2.js$1');

    if (updated !== source) {
      await writeFile(path, updated);
    }
  }));
}

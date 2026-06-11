import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/restaurant_orders_test';
const TEST_PORT = Number(process.env.TEST_PORT ?? 4100);
const API_URL = `http://127.0.0.1:${TEST_PORT}/api`;
const TAX_RATE = 0.086;

let server;

try {
  if (process.env.SKIP_DOCKER_POSTGRES !== '1') {
    await startPostgres();
  }
  await waitForPostgres();
  await runCommand(process.execPath, ['scripts/init-db.mjs'], {
    DATABASE_URL: TEST_DATABASE_URL
  });

  server = spawn(process.execPath, ['server/dist/index.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      PORT: String(TEST_PORT),
      CLIENT_ORIGIN: 'http://localhost:5173'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  await waitForHealth();
  await runApiTests();

  console.log('API integration tests passed.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  if (server && !server.killed) {
    server.kill('SIGTERM');
  }
}

async function runApiTests() {
  await assertSecurityControls();

  const admin = await login('admin@example.com', 'Admin123!');
  const staff = await login('staff@example.com', 'Staff123!');
  const chef = await login('chef@example.com', 'Chef123!');

  const { response: menuResponse, body: menu } = await request('/menu-items');
  assert(menuResponse.status === 200 && menu.length > 0, 'Public menu should load');
  const staffList = await request('/admin/staff', { token: admin });
  assert(staffList.response.status === 200, 'Admin should fetch staff users');
  const staffUser = staffList.body.find((user) => user.email === 'staff@example.com');
  assert(staffUser, 'Seed staff user should exist');
  const inactiveStaff = await request(`/admin/staff/${staffUser.id}`, {
    method: 'PATCH',
    token: admin,
    body: { isActive: false }
  });
  assert(inactiveStaff.response.status === 403, 'User accounts should not be deactivated');
  const deletedStaff = await request(`/admin/staff/${staffUser.id}`, {
    method: 'DELETE',
    token: admin
  });
  assert(deletedStaff.response.status === 403, 'User accounts should not be deleted');
  const changedDefaultStaffRole = await request(`/admin/staff/${staffUser.id}`, {
    method: 'PATCH',
    token: admin,
    body: { role: 'chef' }
  });
  assert(changedDefaultStaffRole.response.status === 403, 'Default account roles should not be changed');
  const temporaryStaff = await request('/admin/staff', {
    method: 'POST',
    token: admin,
    body: {
      name: 'Temporary Staff',
      email: 'temporary-staff@example.com',
      password: 'Temp12345!',
      role: 'staff'
    }
  });
  assert(temporaryStaff.response.status === 201, 'Admin should create a temporary staff user');
  const inactiveTemporaryStaff = await request(`/admin/staff/${temporaryStaff.body.id}`, {
    method: 'PATCH',
    token: admin,
    body: { isActive: false }
  });
  assert(inactiveTemporaryStaff.response.status === 200 && inactiveTemporaryStaff.body.isActive === false, 'Admin should deactivate added staff users');
  const deletedTemporaryStaff = await request(`/admin/staff/${temporaryStaff.body.id}`, {
    method: 'DELETE',
    token: admin
  });
  assert(deletedTemporaryStaff.response.status === 204, 'Admin should delete added staff users');
  const { response: bundleResponse, body: bundles } = await request('/menu-items/bundles');
  assert(bundleResponse.status === 200 && bundles.length > 0, 'Public menu bundles should load');
  const lunchCombo = bundles.find((bundle) => bundle.name === 'Lunch Combo') ?? bundles[0];
  const drinkItem = menu.find((item) => item.category === 'Drinks');
  assert(drinkItem, 'Seed menu should include a drink item');
  const alwaysAvailableNames = new Set(['Lemon Iced Tea', 'Signature Beef Noodles']);
  const kitchenItems = menu.filter((item) => item.category !== 'Drinks');
  assert(kitchenItems.length > 0, 'Seed menu should include kitchen items');
  const menuItem = kitchenItems.find((item) => !alwaysAvailableNames.has(item.name)) ?? kitchenItems[0];
  const secondMenuItem = kitchenItems.find((item) => item.id !== menuItem.id && !alwaysAvailableNames.has(item.name)) ?? menuItem;
  const variantMenuItem = menu.find((item) => item.name === 'Signature Beef Noodles');
  assert(variantMenuItem?.variants.length >= 3, 'Signature Beef Noodles should include Regular, Small, and Large variants');
  const lemonItem = menu.find((item) => item.name === 'Lemon Iced Tea');
  assert(lemonItem, 'Seed menu should include Lemon Iced Tea');
  const smallVariant = variantMenuItem.variants.find((variant) => variant.name === 'Small');
  const largeVariant = variantMenuItem.variants.find((variant) => variant.name === 'Large');
  assert(smallVariant && largeVariant, 'Seeded menu variants should include Small and Large');
  const drinkVariant = drinkItem.variants.find((variant) => variant.isDefault) ?? drinkItem.variants[0];
  const unavailableLemon = await request(`/menu-items/${lemonItem.id}`, {
    method: 'PATCH',
    token: admin,
    body: { isAvailable: false }
  });
  assert(unavailableLemon.response.status === 403, 'Lemon Iced Tea should always remain available');
  const soldOutSignature = await request(`/menu-items/${variantMenuItem.id}/sold-out`, {
    method: 'PATCH',
    token: chef,
    body: { isSoldOut: true }
  });
  assert(soldOutSignature.response.status === 403, 'Signature Beef Noodles should not be marked sold out');
  const deletedMenuItem = await request(`/menu-items/${menuItem.id}`, {
    method: 'DELETE',
    token: admin
  });
  assert(deletedMenuItem.response.status === 403, 'Menu items should not be deleted');

  const adminBundles = await request('/menu-items/bundles/admin', { token: admin });
  assert(adminBundles.response.status === 200 && adminBundles.body.some((bundle) => bundle.id === lunchCombo.id), 'Admin should fetch all menu bundles');
  const staffBundleCreate = await request('/menu-items/bundles', {
    method: 'POST',
    token: staff,
    body: {
      name: 'Staff Combo',
      priceCents: 999,
      isAvailable: true,
      isSoldOut: false,
      items: [{ menuItemVariantId: smallVariant.id, quantity: 1 }]
    }
  });
  assert(staffBundleCreate.response.status === 403, 'Staff should not create menu bundles');

  const createdBundle = await request('/menu-items/bundles', {
    method: 'POST',
    token: admin,
    body: {
      name: 'Test Combo',
      priceCents: 999,
      isAvailable: true,
      isSoldOut: false,
      items: [
        { menuItemVariantId: smallVariant.id, quantity: 1 },
        { menuItemVariantId: drinkVariant.id, quantity: 1 }
      ]
    }
  });
  assert(createdBundle.response.status === 201, 'Admin should create a menu bundle');
  assert(createdBundle.body.items.length === 2, 'Created menu bundle should include configured components');

  const createdBundleOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ bundleId: createdBundle.body.id, quantity: 1 }]
    }
  });
  assert(createdBundleOrder.response.status === 201, 'Order should use an admin-created bundle');
  assert(createdBundleOrder.body.totalCents === 999, 'Admin-created bundle order should use the configured bundle price');

  const updatedAdminBundle = await request(`/menu-items/bundles/${createdBundle.body.id}`, {
    method: 'PATCH',
    token: admin,
    body: {
      name: 'Updated Test Combo',
      priceCents: 1299,
      items: [{ menuItemVariantId: smallVariant.id, quantity: 2 }]
    }
  });
  assert(updatedAdminBundle.response.status === 200, 'Admin should update a menu bundle');
  assert(updatedAdminBundle.body.priceCents === 1299 && updatedAdminBundle.body.items.length === 1, 'Updated menu bundle should keep new price and components');
  const deletedBundle = await request(`/menu-items/bundles/${createdBundle.body.id}`, {
    method: 'DELETE',
    token: admin
  });
  assert(deletedBundle.response.status === 403, 'Menu bundles should not be deleted');

  const activeOrdersAfterBundleUpdate = await request('/orders?page=1&limit=100', { token: admin });
  const persistedBundleOrder = activeOrdersAfterBundleUpdate.body.orders.find((order) => order.id === createdBundleOrder.body.id);
  assert(persistedBundleOrder?.totalCents === 999, 'Existing orders should keep the original bundle price after bundle updates');

  const soldOutBundle = await request(`/menu-items/bundles/${createdBundle.body.id}/sold-out`, {
    method: 'PATCH',
    token: admin,
    body: { isSoldOut: true }
  });
  assert(soldOutBundle.response.status === 200 && soldOutBundle.body.isSoldOut === true, 'Admin should mark a menu bundle sold out');
  const publicBundlesAfterSoldOut = await request('/menu-items/bundles');
  assert(!publicBundlesAfterSoldOut.body.some((bundle) => bundle.id === createdBundle.body.id), 'Sold-out menu bundles should be hidden from public ordering');

  const variantOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [
        { menuItemId: variantMenuItem.id, menuItemVariantId: smallVariant.id, quantity: 1 },
        { menuItemId: variantMenuItem.id, menuItemVariantId: largeVariant.id, quantity: 1 }
      ]
    }
  });
  assert(variantOrder.response.status === 201, 'Order with menu item variants should be created');
  assert(variantOrder.body.totalCents === smallVariant.priceCents + largeVariant.priceCents, 'Variant prices should determine order total');
  assert(
    variantOrder.body.items.some((item) => item.variantName === 'Small')
      && variantOrder.body.items.some((item) => item.variantName === 'Large'),
    'Created order should preserve each selected variant name'
  );

  const bundleOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ bundleId: lunchCombo.id, quantity: 1 }]
    }
  });
  assert(bundleOrder.response.status === 201, 'Order with a menu bundle should be created');
  assert(bundleOrder.body.totalCents === lunchCombo.priceCents, 'Bundle order total should use the discounted bundle price');
  assert(bundleOrder.body.items.length === lunchCombo.items.reduce((sum, item) => sum + item.quantity, 0), 'Bundle should expand into component order items');
  assert(bundleOrder.body.items.every((item) => item.bundleName === lunchCombo.name), 'Bundle component items should keep bundle context');

  const updatedBundleOrder = await request(`/orders/${bundleOrder.body.id}`, {
    method: 'PATCH',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ bundleId: lunchCombo.id, quantity: 1 }]
    }
  });
  assert(updatedBundleOrder.response.status === 200, 'Bundle order should be editable as a bundle');
  assert(updatedBundleOrder.body.totalCents === lunchCombo.priceCents, 'Edited bundle order should keep the discounted bundle price');
  assert(updatedBundleOrder.body.items.every((item) => item.bundleName === lunchCombo.name), 'Edited bundle order should keep bundle context');

  const itemWorkflowOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [
        { menuItemId: menuItem.id, quantity: 1 },
        { menuItemId: secondMenuItem.id, quantity: 1 }
      ]
    }
  });
  assert(itemWorkflowOrder.response.status === 201, 'Item workflow order should be created');
  assert(itemWorkflowOrder.body.items.every((item) => item.status === 'pending'), 'New order items should start pending');
  const firstWorkflowItem = itemWorkflowOrder.body.items[0];
  const secondWorkflowItem = itemWorkflowOrder.body.items[1];

  const itemPreparing = await request(`/orders/${itemWorkflowOrder.body.id}/items/${firstWorkflowItem.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'preparing' }
  });
  assert(itemPreparing.response.status === 200, 'Chef should start an individual item');
  assert(itemPreparing.body.status === 'preparing', 'Order should become preparing when one item starts');
  assert(findOrderItem(itemPreparing.body, firstWorkflowItem.id).status === 'preparing', 'Started item should be preparing');
  assert(findOrderItem(itemPreparing.body, secondWorkflowItem.id).status === 'pending', 'Other item should remain pending');

  const itemReady = await request(`/orders/${itemWorkflowOrder.body.id}/items/${firstWorkflowItem.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'ready' }
  });
  assert(itemReady.response.status === 200, 'Chef should mark an individual item ready');
  assert(findOrderItem(itemReady.body, firstWorkflowItem.id).status === 'ready', 'Item should become ready');

  const itemServed = await request(`/orders/${itemWorkflowOrder.body.id}/items/${firstWorkflowItem.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'served' }
  });
  assert(itemServed.response.status === 200, 'Staff should serve an individual ready item');
  assert(findOrderItem(itemServed.body, firstWorkflowItem.id).status === 'served', 'Item should become served');
  assert(itemServed.body.status === 'preparing', 'Order should remain preparing while other items are not ready');

  const staffBadItemTransition = await request(`/orders/${itemWorkflowOrder.body.id}/items/${secondWorkflowItem.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'preparing' }
  });
  assert(staffBadItemTransition.response.status === 403, 'Staff should not start kitchen item preparation');

  const cancelledItemWorkflowOrder = await request(`/orders/${itemWorkflowOrder.body.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'cancelled' }
  });
  assert(cancelledItemWorkflowOrder.response.status === 200, 'Admin should cancel item workflow test order');

  const splitQuantityOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 2 }]
    }
  });
  assert(splitQuantityOrder.response.status === 201, 'Quantity split order should be created');
  assert(splitQuantityOrder.body.items.length === 2, 'Quantity 2 should create two independently trackable items');
  assert(splitQuantityOrder.body.items.every((item) => item.quantity === 1), 'Split items should each represent one dish');

  const firstSplitItem = splitQuantityOrder.body.items[0];
  const secondSplitItem = splitQuantityOrder.body.items[1];
  const splitItemPreparing = await request(`/orders/${splitQuantityOrder.body.id}/items/${firstSplitItem.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'preparing' }
  });
  assert(splitItemPreparing.response.status === 200, 'Chef should prepare one split item');
  assert(findOrderItem(splitItemPreparing.body, firstSplitItem.id).status === 'preparing', 'First split item should be preparing');
  assert(findOrderItem(splitItemPreparing.body, secondSplitItem.id).status === 'pending', 'Second split item should remain pending');

  const cancelledSplitQuantityOrder = await request(`/orders/${splitQuantityOrder.body.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'cancelled' }
  });
  assert(cancelledSplitQuantityOrder.response.status === 200, 'Admin should cancel split quantity test order');

  const splitPaymentOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [
        { menuItemId: menuItem.id, quantity: 1 },
        { menuItemId: secondMenuItem.id, quantity: 1 }
      ]
    }
  });
  assert(splitPaymentOrder.response.status === 201, 'Split payment order should be created');

  const splitPaymentPreparing = await request(`/orders/${splitPaymentOrder.body.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'preparing' }
  });
  assert(splitPaymentPreparing.response.status === 200, 'Admin should prepare split payment order');

  const splitPaymentReady = await request(`/orders/${splitPaymentOrder.body.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'ready' }
  });
  assert(splitPaymentReady.response.status === 200, 'Admin should ready split payment order');

  const splitPaymentServed = await request(`/orders/${splitPaymentOrder.body.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'served' }
  });
  assert(splitPaymentServed.response.status === 200, 'Admin should serve split payment order');

  const firstPaymentItem = splitPaymentServed.body.items[0];
  const secondPaymentItem = splitPaymentServed.body.items[1];
  const firstSplitTax = Math.round(firstPaymentItem.priceCents * TAX_RATE);
  const firstSplitPayment = await request(`/orders/${splitPaymentOrder.body.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'card',
      orderItemIds: [firstPaymentItem.id],
      subtotalCents: firstPaymentItem.priceCents,
      taxCents: firstSplitTax,
      tipCents: 100,
      totalCents: firstPaymentItem.priceCents + firstSplitTax + 100
    }
  });
  assert(firstSplitPayment.response.status === 200, 'First split payment should be recorded');
  assert(firstSplitPayment.body.paymentStatus === 'partially_paid', 'Order should be partially paid after one item is checked out');
  assert(firstSplitPayment.body.items.find((item) => item.id === firstPaymentItem.id).paymentId, 'Paid item should carry a payment id');
  assert(!firstSplitPayment.body.items.find((item) => item.id === secondPaymentItem.id).paymentId, 'Unpaid item should remain unassigned');

  const duplicateSplitItemPayment = await request(`/orders/${splitPaymentOrder.body.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'cash',
      orderItemIds: [firstPaymentItem.id],
      subtotalCents: firstPaymentItem.priceCents,
      taxCents: firstSplitTax,
      tipCents: 0,
      totalCents: firstPaymentItem.priceCents + firstSplitTax
    }
  });
  assert(duplicateSplitItemPayment.response.status === 409, 'Already paid split item should not be charged twice');

  const secondSplitTax = Math.round(secondPaymentItem.priceCents * TAX_RATE);
  const finalSplitPayment = await request(`/orders/${splitPaymentOrder.body.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'cash',
      orderItemIds: [secondPaymentItem.id],
      subtotalCents: secondPaymentItem.priceCents,
      taxCents: secondSplitTax,
      tipCents: 0,
      totalCents: secondPaymentItem.priceCents + secondSplitTax
    }
  });
  assert(finalSplitPayment.response.status === 200, 'Final split payment should be recorded');
  assert(finalSplitPayment.body.paymentStatus === 'paid', 'Order should be paid after all items are checked out');
  assert(finalSplitPayment.body.payments.length === 2, 'Order should retain both split payment records');

  const amountSplitOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [
        { menuItemId: menuItem.id, quantity: 1 },
        { menuItemId: secondMenuItem.id, quantity: 1 }
      ]
    }
  });
  assert(amountSplitOrder.response.status === 201, 'Amount split order should be created');
  await request(`/orders/${amountSplitOrder.body.id}/status`, { method: 'PATCH', token: admin, body: { status: 'preparing' } });
  await request(`/orders/${amountSplitOrder.body.id}/status`, { method: 'PATCH', token: admin, body: { status: 'ready' } });
  const amountSplitServed = await request(`/orders/${amountSplitOrder.body.id}/status`, {
    method: 'PATCH',
    token: admin,
    body: { status: 'served' }
  });
  assert(amountSplitServed.response.status === 200, 'Admin should serve amount split order');

  const firstAmountSubtotal = Math.floor(amountSplitServed.body.totalCents / 2);
  const secondAmountSubtotal = amountSplitServed.body.totalCents - firstAmountSubtotal;
  const firstAmountTax = Math.round(firstAmountSubtotal * TAX_RATE);
  const firstAmountPayment = await request(`/orders/${amountSplitOrder.body.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'card',
      subtotalCents: firstAmountSubtotal,
      taxCents: firstAmountTax,
      tipCents: 0,
      totalCents: firstAmountSubtotal + firstAmountTax
    }
  });
  assert(firstAmountPayment.response.status === 200, 'First amount split payment should be recorded');
  assert(firstAmountPayment.body.paymentStatus === 'partially_paid', 'Amount split order should be partially paid after first payment');

  const secondAmountTax = Math.round(secondAmountSubtotal * TAX_RATE);
  const secondAmountPayment = await request(`/orders/${amountSplitOrder.body.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'cash',
      subtotalCents: secondAmountSubtotal,
      taxCents: secondAmountTax,
      tipCents: 0,
      totalCents: secondAmountSubtotal + secondAmountTax
    }
  });
  assert(secondAmountPayment.response.status === 200, 'Final amount split payment should be recorded');
  assert(secondAmountPayment.body.paymentStatus === 'paid', 'Amount split order should be paid when subtotal balance is covered');
  assert(secondAmountPayment.body.payments.length === 2, 'Amount split order should retain both payment records');

  const legacyQuantityOrder = await createLegacyQuantityOrder(menuItem);
  const legacyTax = Math.round(legacyQuantityOrder.subtotalCents * TAX_RATE);
  const legacyQuantityCheckout = await request(`/orders/${legacyQuantityOrder.orderId}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'card',
      orderItemIds: [legacyQuantityOrder.itemId],
      subtotalCents: legacyQuantityOrder.subtotalCents,
      taxCents: legacyTax,
      tipCents: 0,
      totalCents: legacyQuantityOrder.subtotalCents + legacyTax
    }
  });
  assert(legacyQuantityCheckout.response.status === 200, 'Legacy quantity order item should checkout successfully');
  assert(legacyQuantityCheckout.body.paymentStatus === 'paid', 'Legacy quantity order should be paid after checkout');

  const drinkOnlyOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ menuItemId: drinkItem.id, quantity: 1 }]
    }
  });
  assert(drinkOnlyOrder.response.status === 201, 'Drink-only order should be created');
  const drinkOrderItem = drinkOnlyOrder.body.items[0];
  assert(drinkOrderItem.isKitchenItem === false, 'Drink item should not require kitchen preparation');

  const chefOrdersWithDrinkOnly = await request('/orders?page=1&limit=100', { token: chef });
  assert(
    chefOrdersWithDrinkOnly.response.status === 200
      && !chefOrdersWithDrinkOnly.body.orders.some((candidate) => candidate.id === drinkOnlyOrder.body.id),
    'Chef board should not include drink-only orders'
  );

  const servedDrink = await request(`/orders/${drinkOnlyOrder.body.id}/items/${drinkOrderItem.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'served' }
  });
  assert(servedDrink.response.status === 200, 'Staff should serve a drink without kitchen preparation');
  assert(servedDrink.body.status === 'served', 'Drink-only order should become served after staff serves the drink');

  const drinkOrderCheckoutTax = Math.round(servedDrink.body.totalCents * TAX_RATE);
  const paidDrinkOrder = await request(`/orders/${drinkOnlyOrder.body.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'cash',
      subtotalCents: servedDrink.body.totalCents,
      taxCents: drinkOrderCheckoutTax,
      tipCents: 0,
      totalCents: servedDrink.body.totalCents + drinkOrderCheckoutTax
    }
  });
  assert(paidDrinkOrder.response.status === 200, 'Staff should checkout a served drink-only order');

  let { response: tablesResponse, body: tables } = await request('/tables', { token: staff });
  assert(tablesResponse.status === 200, 'Staff should fetch tables');
  let t1 = findTable(tables, 'T1');
  const t2 = findTable(tables, 'T2');
  const t3 = findTable(tables, 'T3');
  const deletedTable = await request(`/tables/${t3.id}`, {
    method: 'DELETE',
    token: admin
  });
  assert(deletedTable.response.status === 403, 'Default restaurant tables should not be deleted');
  const temporaryTable = await request('/tables', {
    method: 'POST',
    token: admin,
    body: { name: 'T99', capacity: 2 }
  });
  assert(temporaryTable.response.status === 201, 'Admin should create a temporary table');
  const deletedTemporaryTable = await request(`/tables/${temporaryTable.body.id}`, {
    method: 'DELETE',
    token: admin
  });
  assert(deletedTemporaryTable.response.status === 204, 'Admin should delete added tables');
  const realtime = await createRealtimeWaiter(staff, (event) => event.type === 'order_changed' && event.action === 'created');

  const created = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'dine_in',
      tableNumber: 'T1',
      partySize: 4,
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    }
  });
  assert(created.response.status === 201, `Dine-in order should be created: ${created.response.status}`);
  const order = created.body;
  const realtimeEvent = await realtime.next;
  realtime.close();
  assert(realtimeEvent.resourceId === order.id, 'Order creation should emit a realtime event');

  const duplicateTable = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'dine_in',
      tableNumber: 'T1',
      partySize: 2,
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    }
  });
  assert(duplicateTable.response.status === 400, 'Occupied table should reject a second dine-in order');

  const tooManyGuests = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'dine_in',
      tableNumber: 'T2',
      partySize: t2.capacity + 3,
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    }
  });
  assert(tooManyGuests.response.status === 400, 'Party size above table capacity plus extra chairs should be rejected');

  const staffBadTablePatch = await request(`/tables/${t3.id}`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'occupied' }
  });
  assert(staffBadTablePatch.response.status === 403, 'Staff should not set arbitrary table status');

  const staffHistory = await request(`/orders/${order.id}/events`, { token: staff });
  assert(staffHistory.response.status === 403, 'Staff should not read admin-only order history');

  const preparing = await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'preparing' }
  });
  assert(preparing.response.status === 200 && preparing.body.status === 'preparing', 'Chef should start pending order');

  const ready = await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: chef,
    body: { status: 'ready' }
  });
  assert(ready.response.status === 200 && ready.body.status === 'ready', 'Chef should mark preparing order ready');

  const staffInvalidTransition = await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'cancelled' }
  });
  assert(staffInvalidTransition.response.status === 403, 'Staff should not cancel a ready order');

  const served = await request(`/orders/${order.id}/status`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'served' }
  });
  assert(served.response.status === 200 && served.body.status === 'served', 'Staff should serve ready order');

  const wrongTax = await request(`/orders/${order.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'card',
      subtotalCents: served.body.totalCents,
      taxCents: 0,
      tipCents: 0,
      totalCents: served.body.totalCents
    }
  });
  assert(wrongTax.response.status === 409, 'Checkout should reject incorrect tax');

  const taxCents = Math.round(served.body.totalCents * TAX_RATE);
  const paid = await request(`/orders/${order.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'card',
      subtotalCents: served.body.totalCents,
      taxCents,
      tipCents: 100,
      totalCents: served.body.totalCents + taxCents + 100
    }
  });
  assert(paid.response.status === 200 && paid.body.paymentStatus === 'paid', 'Checkout should mark order paid');

  const duplicateCheckout = await request(`/orders/${order.id}/checkout`, {
    method: 'POST',
    token: staff,
    body: {
      paymentMethod: 'cash',
      subtotalCents: served.body.totalCents,
      taxCents,
      tipCents: 0,
      totalCents: served.body.totalCents + taxCents
    }
  });
  assert(duplicateCheckout.response.status === 409, 'Paid order should not be checked out twice');

  const activeOrders = await request('/orders?page=1&limit=100&activeOnly=true', { token: staff });
  assert(activeOrders.response.status === 200, 'Staff should fetch active orders');
  assert(
    activeOrders.body.orders.every((item) => item.status !== 'cancelled' && item.paymentStatus !== 'paid'),
    'Active order filter should exclude cancelled and paid orders'
  );

  const events = await request(`/orders/${order.id}/events`, { token: admin });
  assert(events.response.status === 200, 'Admin should read order history');
  assert(events.body.some((event) => event.eventType === 'payment_recorded'), 'History should include payment event');

  ({ response: tablesResponse, body: tables } = await request('/tables', { token: staff }));
  assert(tablesResponse.status === 200, 'Tables should reload after checkout flow');
  t1 = findTable(tables, 'T1');
  assert(t1.status === 'needs_cleaning', 'Served dine-in table should need cleaning');

  const cleaned = await request(`/tables/${t1.id}`, {
    method: 'PATCH',
    token: staff,
    body: { status: 'available' }
  });
  assert(cleaned.response.status === 200 && cleaned.body.status === 'available', 'Staff should mark needs-cleaning table available');

  const soldOut = await request(`/menu-items/${menuItem.id}/sold-out`, {
    method: 'PATCH',
    token: chef,
    body: { isSoldOut: true }
  });
  assert(soldOut.response.status === 200 && soldOut.body.isSoldOut, 'Chef should mark menu item sold out');

  const soldOutOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ menuItemId: menuItem.id, quantity: 1 }]
    }
  });
  assert(soldOutOrder.response.status === 400, 'Sold-out menu item should be rejected in new orders');

  const lunchComboComponent = lunchCombo.items.find((item) => !alwaysAvailableNames.has(item.menuItemName)) ?? lunchCombo.items[0];
  const soldOutBundleComponent = await request(`/menu-items/${lunchComboComponent.menuItemId}/sold-out`, {
    method: 'PATCH',
    token: chef,
    body: { isSoldOut: true }
  });
  assert(soldOutBundleComponent.response.status === 200, 'Chef should mark a bundle component sold out');

  const publicBundlesAfterComponentSoldOut = await request('/menu-items/bundles');
  assert(
    publicBundlesAfterComponentSoldOut.response.status === 200
      && !publicBundlesAfterComponentSoldOut.body.some((bundle) => bundle.id === lunchCombo.id),
    'Bundles with sold-out components should be hidden from public ordering'
  );

  const soldOutComponentBundleOrder = await request('/orders', {
    method: 'POST',
    token: staff,
    body: {
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ bundleId: lunchCombo.id, quantity: 1 }]
    }
  });
  assert(soldOutComponentBundleOrder.response.status === 400, 'Bundles with sold-out components should be rejected in new orders');

  const invalidBundleWithSoldOutComponent = await request('/menu-items/bundles', {
    method: 'POST',
    token: admin,
    body: {
      name: 'Invalid Sold Out Combo',
      priceCents: 1000,
      isAvailable: true,
      isSoldOut: false,
      items: [{ menuItemVariantId: lunchComboComponent.menuItemVariantId, quantity: 1 }]
    }
  });
  assert(invalidBundleWithSoldOutComponent.response.status === 400, 'Admin should not create bundles with sold-out components');

  console.log(JSON.stringify({
    checked: [
      'auth',
      'menu',
      'menu bundles',
      'table occupancy',
      'capacity limits',
      'role boundaries',
      'destructive action guards',
      'seed data protection guards',
      'status transitions',
      'item-level kitchen workflow',
      'split quantity item tracking',
      'menu item size variants',
      'staff-handled drinks',
      'checkout tax validation',
      'duplicate checkout prevention',
      'split payment checkout',
      'amount split checkout',
      'legacy quantity checkout',
      'active order filtering',
      'admin history',
      'table cleaning',
      'sold-out ordering guard',
      'bundle sold-out dependency guard',
      'security headers',
      'request id header',
      'realtime order events',
      'login rate limiting',
      'request body size limit'
    ]
  }, null, 2));
}

async function assertSecurityControls() {
  const health = await request('/health');
  assert(health.response.headers.get('x-content-type-options') === 'nosniff', 'Helmet should set security headers');
  assert(Boolean(health.response.headers.get('x-request-id')), 'API responses should include a request id');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failed = await request('/auth/login', {
      method: 'POST',
      body: { email: 'rate-limit@example.com', password: 'wrong-password' }
    });
    assert(failed.response.status === 401, 'Invalid login should be rejected before lockout');
  }

  const limited = await request('/auth/login', {
    method: 'POST',
    body: { email: 'rate-limit@example.com', password: 'wrong-password' }
  });
  assert(limited.response.status === 429, 'Repeated failed logins should be rate limited');

  const oversized = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'large-payload@example.com',
      password: 'x'.repeat(120_000)
    })
  });
  assert(oversized.status === 413, 'Oversized JSON requests should be rejected');
}

async function login(email, password) {
  const { response, body } = await request('/auth/login', {
    method: 'POST',
    body: { email, password }
  });

  assert(response.status === 200, `Login failed for ${email}: ${response.status}`);
  return body.accessToken;
}

async function createRealtimeWaiter(token, predicate) {
  const controller = new AbortController();
  const response = await fetch(`${API_URL}/events`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controller.signal
  });

  assert(response.status === 200 && response.body, 'Realtime event stream should connect');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const next = new Promise((resolve, reject) => {
    async function read() {
      try {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();

          if (done) {
            reject(new Error('Realtime stream closed before expected event'));
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';

          for (const chunk of chunks) {
            const dataLine = chunk.split('\n').find((line) => line.startsWith('data: '));

            if (!dataLine) {
              continue;
            }

            const event = JSON.parse(dataLine.slice('data: '.length));

            if (predicate(event)) {
              resolve(event);
              return;
            }
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          reject(error);
        }
      }
    }

    void read();
  });

  return {
    next,
    close() {
      controller.abort();
    }
  };
}

async function createLegacyQuantityOrder(menuItem) {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    const variant = await client.query(
      'SELECT id, price_cents FROM menu_item_variants WHERE menu_item_id = $1 AND is_default = TRUE',
      [menuItem.id]
    );
    assert(variant.rowCount === 1, 'Legacy quantity test requires a default variant');

    const order = await client.query(
      `
        INSERT INTO orders (
          order_source,
          fulfillment_type,
          server_name,
          status,
          payment_status
        )
        VALUES ('in_person', 'to_go', 'Kent', 'served', 'unpaid')
        RETURNING id
      `
    );
    const item = await client.query(
      `
        INSERT INTO order_items (
          order_id,
          menu_item_id,
          menu_item_variant_id,
          quantity,
          price_cents,
          status,
          prepared_at,
          served_at
        )
        VALUES ($1, $2, $3, 2, $4, 'served', NOW(), NOW())
        RETURNING id
      `,
      [order.rows[0].id, menuItem.id, variant.rows[0].id, variant.rows[0].price_cents]
    );

    await client.query('COMMIT');

    return {
      orderId: order.rows[0].id,
      itemId: item.rows[0].id,
      subtotalCents: variant.rows[0].price_cents * 2
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

async function waitForHealth() {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    try {
      const { response } = await request('/health');
      if (response.status === 200) {
        return;
      }
    } catch {
      await delay(250);
    }
  }

  throw new Error(`API server did not become ready on port ${TEST_PORT}`);
}

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIR,
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function startPostgres() {
  if (process.platform === 'win32') {
    return runCommand('cmd.exe', ['/c', 'scripts\\start-postgres.cmd']);
  }

  return runCommand('sh', ['scripts/start-postgres.cmd']);
}

async function waitForPostgres() {
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const deadline = Date.now() + 30000;
  let lastError;

  while (Date.now() < deadline) {
    const client = new pg.Client({ connectionString: adminUrl.toString() });

    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      await delay(500);
    }
  }

  throw lastError ?? new Error('PostgreSQL did not become ready');
}

function findTable(tables, name) {
  const table = tables.find((item) => item.name === name);
  assert(table, `Expected table ${name} to exist`);
  return table;
}

function findOrderItem(order, itemId) {
  const item = order.items.find((candidate) => candidate.id === itemId);
  assert(item, `Expected order item ${itemId} to exist`);
  return item;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

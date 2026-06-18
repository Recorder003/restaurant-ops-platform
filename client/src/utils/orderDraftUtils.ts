import type { FulfillmentType, MenuBundle, Order, OrderItem, OrderSource } from '../types';

export function getOrderTitle(order: Order) {
  if (order.orderSource === 'phone') {
    return `Phone ${order.phoneNumber ?? ''}`.trim();
  }

  if (order.fulfillmentType === 'to_go') {
    return 'To-go order';
  }

  return `Table ${order.tableNumber} / ${order.partySize ?? 0} guests`;
}

export function formatOrderItemName(item: OrderItem) {
  const name = item.variantName === 'Regular' ? item.menuItemName : `${item.menuItemName} / ${item.variantName}`;
  const displayName = item.bundleName ? `${item.bundleName} / ${name}` : name;
  return item.quantity === 1 ? displayName : `${displayName} x ${item.quantity}`;
}

export function getSelectedItemsFromOrder(order: Order) {
  return order.items.reduce<Record<string, number>>((selected, item) => {
    if (item.bundleId) {
      return selected;
    }

    selected[item.menuItemVariantId] = (selected[item.menuItemVariantId] ?? 0) + item.quantity;
    return selected;
  }, {});
}

export function getSelectedBundlesFromOrder(order: Order, menuBundles: MenuBundle[]) {
  const componentCounts = order.items.reduce<Record<string, number>>((counts, item) => {
    if (!item.bundleId) {
      return counts;
    }

    counts[item.bundleId] = (counts[item.bundleId] ?? 0) + item.quantity;
    return counts;
  }, {});

  return Object.entries(componentCounts).reduce<Record<string, number>>((selected, [bundleId, componentCount]) => {
    const bundle = menuBundles.find((candidate) => candidate.id === bundleId);
    const componentsPerBundle = bundle?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

    if (componentsPerBundle > 0) {
      selected[bundleId] = Math.max(1, Math.floor(componentCount / componentsPerBundle));
    }

    return selected;
  }, {});
}

export function getOrderFlowLabel(
  orderSource: OrderSource,
  fulfillmentType: FulfillmentType,
  tableNumber: string,
  partySize: string,
  phoneNumber: string
) {
  if (orderSource === 'phone') {
    return `${fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}${phoneNumber ? ` / ${phoneNumber}` : ''}`;
  }

  if (fulfillmentType === 'to_go') {
    return 'Walk-in / To-go';
  }

  return tableNumber ? `${tableNumber} / ${partySize} guests` : 'Dine-in';
}

import { describe, expect, it } from 'vitest';
import {
  formatOrderItemName,
  getOrderFlowLabel,
  getOrderTitle,
  getSelectedBundlesFromOrder,
  getSelectedItemsFromOrder
} from './orderDraftUtils';
import { createMenuBundle, createOrder, createOrderItem } from '../test/factories';

const baseItem = createOrderItem({
  menuItemName: 'Signature Beef Noodles',
  priceCents: 1380,
  status: 'pending'
});

const order = createOrder({
  tableNumber: 'T3',
  partySize: 4,
  status: 'pending',
  totalCents: 1380,
  items: [baseItem]
});

const combo = createMenuBundle({
  id: 'combo-1',
  priceCents: 2380,
  items: [
    {
      menuItemId: 'menu-1',
      menuItemVariantId: 'variant-1',
      menuItemName: 'Signature Beef Noodles',
      variantName: 'Regular',
      category: 'Entrees',
      quantity: 1,
      priceCents: 1380,
      isAvailable: true,
      isSoldOut: false
    },
    {
      menuItemId: 'menu-2',
      menuItemVariantId: 'variant-2',
      menuItemName: 'Lemon Iced Tea',
      variantName: 'Large',
      category: 'Drinks',
      quantity: 2,
      priceCents: 580,
      isAvailable: true,
      isSoldOut: false
    }
  ]
});

describe('order draft utilities', () => {
  it('formats order titles for dine-in, to-go, and phone orders', () => {
    expect(getOrderTitle(order)).toBe('Table T3 / 4 guests');
    expect(getOrderTitle({ ...order, fulfillmentType: 'to_go', tableNumber: null, partySize: null })).toBe('To-go order');
    expect(getOrderTitle({ ...order, orderSource: 'phone', fulfillmentType: 'pickup', phoneNumber: '6025550100' })).toBe('Phone 6025550100');
    expect(getOrderTitle({ ...order, orderSource: 'phone', fulfillmentType: 'delivery', phoneNumber: null })).toBe('Phone');
  });

  it('formats item names with variants, bundles, and quantities', () => {
    expect(formatOrderItemName(baseItem)).toBe('Signature Beef Noodles');
    expect(formatOrderItemName({ ...baseItem, variantName: 'Large' })).toBe('Signature Beef Noodles / Large');
    expect(formatOrderItemName({ ...baseItem, bundleName: 'Lunch Combo' })).toBe('Lunch Combo / Signature Beef Noodles');
    expect(formatOrderItemName({ ...baseItem, quantity: 3, variantName: 'Small' })).toBe('Signature Beef Noodles / Small x 3');
  });

  it('restores non-bundle item quantities when editing an order', () => {
    const selected = getSelectedItemsFromOrder({
      ...order,
      items: [
        baseItem,
        { ...baseItem, id: 'item-2', quantity: 2 },
        { ...baseItem, id: 'item-3', bundleId: 'combo-1', bundleName: 'Lunch Combo', quantity: 1 }
      ]
    });

    expect(selected).toEqual({ 'variant-1': 3 });
  });

  it('restores bundle quantities from component counts when editing an order', () => {
    const selected = getSelectedBundlesFromOrder({
      ...order,
      items: [
        { ...baseItem, id: 'combo-item-1', bundleId: 'combo-1', bundleName: 'Lunch Combo', quantity: 1 },
        { ...baseItem, id: 'combo-item-2', bundleId: 'combo-1', bundleName: 'Lunch Combo', quantity: 2 },
        { ...baseItem, id: 'combo-item-3', bundleId: 'combo-1', bundleName: 'Lunch Combo', quantity: 3 },
        { ...baseItem, id: 'standalone-item', bundleId: null, bundleName: null, quantity: 5 }
      ]
    }, [combo]);

    expect(selected).toEqual({ 'combo-1': 2 });
  });

  it('ignores unknown bundles that cannot be matched to menu data', () => {
    const selected = getSelectedBundlesFromOrder({
      ...order,
      items: [{ ...baseItem, bundleId: 'missing-combo', bundleName: 'Missing Combo', quantity: 3 }]
    }, [combo]);

    expect(selected).toEqual({});
  });

  it('describes the current order flow step for each service type', () => {
    expect(getOrderFlowLabel('in_person', 'dine_in', '', '', '')).toBe('Dine-in');
    expect(getOrderFlowLabel('in_person', 'dine_in', 'T4', '5', '')).toBe('T4 / 5 guests');
    expect(getOrderFlowLabel('in_person', 'to_go', '', '', '')).toBe('Walk-in / To-go');
    expect(getOrderFlowLabel('phone', 'pickup', '', '', '6025550100')).toBe('Pickup / 6025550100');
    expect(getOrderFlowLabel('phone', 'delivery', '', '', '')).toBe('Delivery');
  });
});

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrderDraft } from './useOrderDraft';
import { createMenuBundle, createMenuItem, createOrder, createOrderItem, createRestaurantTable, createStaffUser } from '../test/factories';

const api = vi.hoisted(() => ({
  createOrder: vi.fn(),
  updateOrder: vi.fn()
}));

vi.mock('../api', () => api);

const staffUser = createStaffUser();
const menuItem = createMenuItem({ name: 'Noodles' });
const table = createRestaurantTable();
const combo = createMenuBundle({
  priceCents: 1800,
  items: [{
    menuItemId: menuItem.id,
    menuItemVariantId: 'variant-1',
    menuItemName: menuItem.name,
    variantName: 'Regular',
    category: 'Entrees',
    quantity: 1,
    priceCents: 1200,
    isAvailable: true,
    isSoldOut: false
  }]
});
const order = createOrder({
  status: 'pending',
  notes: 'Less salt',
  items: [createOrderItem({
    menuItemId: menuItem.id,
    menuItemName: menuItem.name,
    menuItemCategory: menuItem.category,
    status: 'pending'
  })]
});

describe('useOrderDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.createOrder.mockResolvedValue({});
  });

  it('guides dine-in orders through table and party-size steps', () => {
    const { result } = renderOrderDraftHook();

    act(() => {
      result.current.initializeForUser(staffUser);
      result.current.startStaffOrder('in_person', 'dine_in');
    });
    expect(result.current.staffOrderStep).toBe('table');

    act(() => {
      result.current.handlePartySizeChange('10');
      result.current.handleTableSelect(table);
    });
    expect(result.current.tableNumber).toBe('T1');
    expect(result.current.partySize).toBe('6');
    expect(result.current.maxPartySize).toBe(6);

    act(() => {
      result.current.goToStaffPartyStep();
    });
    expect(result.current.staffOrderStep).toBe('party');
  });

  it('calculates draft quantities and totals from menu variants', () => {
    const { result } = renderOrderDraftHook();

    act(() => {
      result.current.handleMenuQuantityChange('variant-1', 2);
    });

    expect(result.current.selectedItems).toEqual({ 'variant-1': 2 });
    expect(result.current.draftItems).toEqual([{
      menuItemId: 'menu-1',
      menuItemVariantId: 'variant-1',
      quantity: 2
    }]);
    expect(result.current.draftTotal).toBe(2400);
  });

  it('submits a valid order and resets the workflow', async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderOrderDraftHook(onSaved);

    act(() => {
      result.current.initializeForUser(staffUser);
      result.current.startStaffOrder('in_person', 'to_go');
      result.current.handleMenuQuantityChange('variant-1', 1);
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as never);
    });

    expect(api.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      orderSource: 'in_person',
      fulfillmentType: 'to_go',
      serverName: 'Kent',
      items: [{ menuItemId: 'menu-1', menuItemVariantId: 'variant-1', quantity: 1 }]
    }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.staffOrderStep).toBe('service');
    expect(result.current.selectedItems).toEqual({});
  });

  it('guides phone pickup orders through phone and menu steps', () => {
    const onError = vi.fn();
    const { result } = renderOrderDraftHook(undefined, { onError });

    act(() => result.current.startStaffOrder('phone', 'pickup'));
    expect(result.current.staffOrderStep).toBe('phone');
    expect(result.current.orderSource).toBe('phone');
    expect(result.current.fulfillmentType).toBe('pickup');

    act(() => result.current.goToStaffMenuStep());
    expect(result.current.staffOrderStep).toBe('phone');
    expect(result.current.orderFormErrors.phoneNumber).toBeTruthy();

    act(() => result.current.handlePhoneNumberChange('6025550100'));
    act(() => result.current.goToStaffMenuStep());

    expect(result.current.staffOrderStep).toBe('menu');
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('tracks combo quantities and keeps category selection valid', () => {
    const { result, rerender } = renderOrderDraftHook(undefined, { menuBundles: [combo] });

    act(() => {
      result.current.setSelectedCategory('Missing');
      result.current.handleBundleQuantityChange('bundle-1', 2);
    });
    rerender();

    expect(result.current.categories).toEqual(['Combos', 'Entrees']);
    expect(result.current.selectedCategory).toBe('Combos');
    expect(result.current.selectedBundles).toEqual({ 'bundle-1': 2 });
    expect(result.current.draftItems).toEqual([{ bundleId: 'bundle-1', quantity: 2 }]);
    expect(result.current.draftTotal).toBe(3600);
  });

  it('edits pending orders and submits changes through the update API', async () => {
    api.updateOrder.mockResolvedValue({});
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const { result } = renderOrderDraftHook(onSaved, { onError });

    act(() => result.current.handleEditOrder(order));

    expect(result.current.editingOrderId).toBe('order-1');
    expect(result.current.staffOrderStep).toBe('menu');
    expect(result.current.notes).toBe('Less salt');
    expect(result.current.selectedItems).toEqual({ 'variant-1': 1 });

    act(() => {
      result.current.setNotes('No onions');
      result.current.handleMenuQuantityChange('variant-1', 2);
    });

    await act(async () => {
      await result.current.handleSubmit(formEvent());
    });

    expect(api.updateOrder).toHaveBeenCalledWith('order-1', expect.objectContaining({
      notes: 'No onions',
      tableNumber: 'T1',
      partySize: 2,
      items: [{ menuItemId: 'menu-1', menuItemVariantId: 'variant-1', quantity: 2 }]
    }));
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenLastCalledWith(null);
    expect(result.current.editingOrderId).toBeNull();
  });

  it('prevents editing non-pending orders and can cancel an edit session', () => {
    const onError = vi.fn();
    const { result } = renderOrderDraftHook(undefined, { onError });

    act(() => result.current.handleEditOrder({ ...order, status: 'preparing' }));

    expect(result.current.editingOrderId).toBeNull();
    expect(onError).toHaveBeenCalledWith('Only pending orders can be edited');

    act(() => {
      result.current.handleEditOrder(order);
      result.current.handleCancelEdit();
    });

    expect(result.current.editingOrderId).toBeNull();
    expect(result.current.staffOrderStep).toBe('service');
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('removes unavailable selected menu variants and bundles from the draft', () => {
    const { result } = renderOrderDraftHook(undefined, { menuBundles: [combo] });

    act(() => {
      result.current.handleMenuQuantityChange('variant-1', 2);
      result.current.handleBundleQuantityChange('bundle-1', 1);
      result.current.removeSelectedItemVariants(['variant-1']);
      result.current.removeSelectedBundle('bundle-1');
    });

    expect(result.current.selectedItems).toEqual({});
    expect(result.current.selectedBundles).toEqual({});

    act(() => {
      result.current.handleBundleQuantityChange('bundle-1', 1);
      result.current.handleBundleQuantityChange('missing-bundle', 1);
      result.current.retainSelectedBundles(['bundle-1']);
    });

    expect(result.current.selectedBundles).toEqual({ 'bundle-1': 1 });
  });

  it('surfaces save failures without resetting the draft', async () => {
    api.createOrder.mockRejectedValueOnce(new Error('Order API failed'));
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const onError = vi.fn();
    const { result } = renderOrderDraftHook(onSaved, { onError });

    act(() => {
      result.current.initializeForUser(staffUser);
      result.current.startStaffOrder('in_person', 'to_go');
      result.current.handleMenuQuantityChange('variant-1', 1);
    });

    await act(async () => {
      await result.current.handleSubmit(formEvent());
    });

    expect(onSaved).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Order API failed');
    expect(result.current.selectedItems).toEqual({ 'variant-1': 1 });
    expect(result.current.isSubmitting).toBe(false);
  });

  it('opens and closes the table picker and clears related errors on selection', () => {
    const { result } = renderOrderDraftHook();

    act(() => {
      result.current.startStaffOrder('in_person', 'dine_in');
      result.current.goToStaffPartyStep();
    });
    expect(result.current.orderFormErrors.tableNumber).toBeTruthy();

    act(() => {
      result.current.openTablePicker();
      result.current.handleTableSelect(table);
    });

    expect(result.current.isTablePickerOpen).toBe(false);
    expect(result.current.orderFormErrors.tableNumber).toBeUndefined();

    act(() => result.current.openTablePicker());
    expect(result.current.isTablePickerOpen).toBe(true);
    act(() => result.current.closeTablePicker());
    expect(result.current.isTablePickerOpen).toBe(false);
  });
});

type OrderDraftOptions = Partial<Parameters<typeof useOrderDraft>[0]>;

function renderOrderDraftHook(onSaved = vi.fn().mockResolvedValue(undefined), overrides: OrderDraftOptions = {}) {
  return renderHook(() => useOrderDraft({
    user: staffUser,
    menuItems: [menuItem],
    menuBundles: [],
    restaurantTables: [table],
    extraChairsAllowed: 2,
    onSaved,
    onError: vi.fn(),
    ...overrides
  }));
}

function formEvent() {
  return { preventDefault: vi.fn() } as never;
}

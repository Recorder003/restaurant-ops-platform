import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMenuManagement } from './useMenuManagement';
import { createAdminUser, createChefUser, createMenuBundle, createMenuItem } from '../test/factories';
import { createStateSetter } from '../test/state';
import type { MenuBundle, MenuItem } from '../types';
import type { FormEvent } from 'react';

const api = vi.hoisted(() => ({
  createMenuBundle: vi.fn(), createMenuItem: vi.fn(), fetchMenuBundles: vi.fn(),
  updateMenuBundle: vi.fn(), updateMenuBundleSoldOut: vi.fn(),
  updateMenuItem: vi.fn(), updateMenuItemSoldOut: vi.fn()
}));
vi.mock('../api', () => api);

const admin = createAdminUser({ id: 'a1' });
const chef = createChefUser({ id: 'c1' });

const regularItem = createMenuItem({
  id: 'm1',
  variants: [{ id: 'v1', menuItemId: 'm1', name: 'Regular', priceCents: 1200, isDefault: true }]
});

const drinkItem = createMenuItem({
  id: 'm2',
  name: 'Lemon Iced Tea',
  category: 'Drinks',
  priceCents: 480,
  variants: [{ id: 'v2', menuItemId: 'm2', name: 'Regular', priceCents: 480, isDefault: true }]
});

const combo = createMenuBundle({
  id: 'b1',
  priceCents: 2100,
  items: [
    {
      menuItemId: 'm1', menuItemVariantId: 'v1', menuItemName: 'Fried Rice',
      variantName: 'Regular', category: 'Entrees', quantity: 1, priceCents: 1200,
      isAvailable: true, isSoldOut: false
    },
    {
      menuItemId: 'm2', menuItemVariantId: 'v2', menuItemName: 'Lemon Iced Tea',
      variantName: 'Regular', category: 'Drinks', quantity: 1, priceCents: 480,
      isAvailable: true, isSoldOut: false
    }
  ]
});

describe('useMenuManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchMenuBundles.mockResolvedValue([combo]);
  });

  it('creates available menu items and resets the admin form', async () => {
    const created = { ...regularItem, id: 'm3', name: 'Garlic Broccoli', category: 'Vegetables', priceCents: 880 };
    api.createMenuItem.mockResolvedValue(created);
    const activeItems = createStateSetter<MenuItem[]>([regularItem]);
    const adminItems = createStateSetter<MenuItem[]>([regularItem]);
    const resetItem = vi.fn();
    const clearSection = vi.fn();
    const onError = vi.fn();
    const { result } = renderMenuHook({
      setMenuItems: activeItems.setter,
      setAdminMenuItems: adminItems.setter,
      form: { name: 'Garlic Broccoli', category: 'Vegetables', price: '8.80', available: true },
      resetItem,
      clearSection,
      onError
    });

    await act(async () => result.current.handleCreateMenuItem(formEvent()));

    expect(api.createMenuItem).toHaveBeenCalledWith({
      name: 'Garlic Broccoli', category: 'Vegetables', priceCents: 880,
      isAvailable: true, isSoldOut: false
    });
    expect(activeItems.getState().map((item) => item.name)).toEqual(['Fried Rice', 'Garlic Broccoli']);
    expect(adminItems.getState().map((item) => item.name)).toEqual(['Fried Rice', 'Garlic Broccoli']);
    expect(resetItem).toHaveBeenCalled();
    expect(clearSection).toHaveBeenCalledWith('menuItem');
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('does not create menu items when validation fails', async () => {
    const validateItem = vi.fn(() => false);
    const { result } = renderMenuHook({ validateItem });

    await act(async () => result.current.handleCreateMenuItem(formEvent()));

    expect(validateItem).toHaveBeenCalled();
    expect(api.createMenuItem).not.toHaveBeenCalled();
  });

  it('creates available combos from selected component quantities', async () => {
    const created = { ...combo, id: 'b2', name: 'Dinner Combo' };
    api.createMenuBundle.mockResolvedValue(created);
    const activeBundles = createStateSetter<MenuBundle[]>([combo]);
    const adminBundles = createStateSetter<MenuBundle[]>([combo]);
    const resetBundle = vi.fn();
    const clearSection = vi.fn();
    const onError = vi.fn();
    const { result } = renderMenuHook({
      setMenuBundles: activeBundles.setter,
      setAdminMenuBundles: adminBundles.setter,
      form: {
        bundleName: 'Dinner Combo', bundlePrice: '21.00',
        bundleAvailable: true, bundleItems: { v1: 1, v2: 2 }
      },
      resetBundle,
      clearSection,
      onError
    });

    await act(async () => result.current.handleCreateMenuBundle(formEvent()));

    expect(api.createMenuBundle).toHaveBeenCalledWith({
      name: 'Dinner Combo', priceCents: 2100, isAvailable: true, isSoldOut: false,
      items: [{ menuItemVariantId: 'v1', quantity: 1 }, { menuItemVariantId: 'v2', quantity: 2 }]
    });
    expect(activeBundles.getState().map((bundle) => bundle.name)).toEqual(['Dinner Combo', 'Lunch Combo']);
    expect(adminBundles.getState().map((bundle) => bundle.name)).toEqual(['Dinner Combo', 'Lunch Combo']);
    expect(resetBundle).toHaveBeenCalled();
    expect(clearSection).toHaveBeenCalledWith('menuBundle');
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('updates combo components and guards against empty combos', async () => {
    const updated = { ...combo, items: [{ ...combo.items[0], quantity: 2 }] };
    api.updateMenuBundle.mockResolvedValue(updated);
    const activeBundles = createStateSetter<MenuBundle[]>([combo]);
    const adminBundles = createStateSetter<MenuBundle[]>([combo]);
    const onError = vi.fn();
    const { result } = renderMenuHook({
      setMenuBundles: activeBundles.setter,
      setAdminMenuBundles: adminBundles.setter,
      onError
    });

    await act(async () => result.current.handleBundleComponentChange(combo, 'v1', 2));

    expect(api.updateMenuBundle).toHaveBeenCalledWith('b1', {
      items: [{ menuItemVariantId: 'v1', quantity: 2 }, { menuItemVariantId: 'v2', quantity: 1 }]
    });
    expect(activeBundles.getState()[0].items[0].quantity).toBe(2);

    api.updateMenuBundle.mockClear();
    const oneItemCombo = { ...combo, items: [combo.items[0]] };
    await act(async () => result.current.handleBundleComponentChange(oneItemCombo, 'v1', 0));

    expect(api.updateMenuBundle).not.toHaveBeenCalled();
    expect(onError).toHaveBeenLastCalledWith('A combo must include at least one item');
  });

  it('removes sold-out combos from active menus and selected draft bundles', async () => {
    const soldOutCombo = { ...combo, isSoldOut: true };
    api.updateMenuBundleSoldOut.mockResolvedValue(soldOutCombo);
    const activeBundles = createStateSetter<MenuBundle[]>([combo]);
    const adminBundles = createStateSetter<MenuBundle[]>([combo]);
    const removeSelectedBundle = vi.fn();
    const onError = vi.fn();
    const { result } = renderMenuHook({
      setMenuBundles: activeBundles.setter,
      setAdminMenuBundles: adminBundles.setter,
      removeSelectedBundle,
      onError
    });

    await act(async () => result.current.handleBundleSoldOutChange(combo, true));

    expect(api.updateMenuBundleSoldOut).toHaveBeenCalledWith('b1', true);
    expect(activeBundles.getState()).toEqual([]);
    expect(adminBundles.getState()).toEqual([soldOutCombo]);
    expect(removeSelectedBundle).toHaveBeenCalledWith('b1');
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('updates menu items, refreshes combo availability, and retains selected active combos', async () => {
    const updated = { ...regularItem, name: 'Fried Rice Deluxe' };
    api.updateMenuItem.mockResolvedValue(updated);
    api.fetchMenuBundles.mockResolvedValue([{ ...combo, name: 'Available Combo' }]);
    const activeItems = createStateSetter<MenuItem[]>([regularItem]);
    const adminItems = createStateSetter<MenuItem[]>([regularItem]);
    const activeBundles = createStateSetter<MenuBundle[]>([]);
    const retainSelectedBundles = vi.fn();
    const onError = vi.fn();
    const { result } = renderMenuHook({
      setMenuItems: activeItems.setter,
      setAdminMenuItems: adminItems.setter,
      setMenuBundles: activeBundles.setter,
      retainSelectedBundles,
      onError
    });

    await act(async () => result.current.handleMenuItemUpdate(regularItem, { name: 'Fried Rice Deluxe' }));

    expect(api.updateMenuItem).toHaveBeenCalledWith('m1', { name: 'Fried Rice Deluxe' });
    expect(activeItems.getState()[0].name).toBe('Fried Rice Deluxe');
    expect(adminItems.getState()[0].name).toBe('Fried Rice Deluxe');
    expect(activeBundles.getState()[0].name).toBe('Available Combo');
    expect(retainSelectedBundles).toHaveBeenCalledWith(['b1']);
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('uses chef sold-out endpoint for non-admin users', async () => {
    const updated = { ...regularItem, isSoldOut: true };
    api.updateMenuItemSoldOut.mockResolvedValue(updated);
    const removeSelectedItemVariants = vi.fn();
    const { result } = renderMenuHook({ user: chef, removeSelectedItemVariants });

    await act(async () => result.current.handleSoldOutChange(regularItem, true));

    expect(api.updateMenuItemSoldOut).toHaveBeenCalledWith('m1', true);
    expect(api.updateMenuItem).not.toHaveBeenCalled();
    expect(removeSelectedItemVariants).toHaveBeenCalledWith(['v1']);
  });

  it('protects always-available seed menu items', async () => {
    const onError = vi.fn();
    const { result } = renderMenuHook({ onError });

    await act(async () => result.current.handleSoldOutChange(drinkItem, true));

    expect(api.updateMenuItem).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Lemon Iced Tea cannot be marked sold out');
  });

  it('surfaces API failures without mutating local menu state', async () => {
    api.updateMenuItem.mockRejectedValue(new Error('Menu API failed'));
    const activeItems = createStateSetter<MenuItem[]>([regularItem]);
    const onError = vi.fn();
    const { result } = renderMenuHook({ setMenuItems: activeItems.setter, onError });

    await act(async () => result.current.handleMenuItemUpdate(regularItem, { name: 'Broken' }));

    expect(activeItems.getState()[0].name).toBe('Fried Rice');
    expect(onError).toHaveBeenCalledWith('Menu API failed');
  });

  it('clears bundle validation errors before changing new combo quantities', () => {
    const clearBundleItemsError = vi.fn();
    const updateNewBundleQuantity = vi.fn();
    const { result } = renderMenuHook({ clearBundleItemsError, updateNewBundleQuantity });

    act(() => result.current.handleNewBundleItemQuantityChange('v1', 3));

    expect(clearBundleItemsError).toHaveBeenCalled();
    expect(updateNewBundleQuantity).toHaveBeenCalledWith('v1', 3);
  });
});

type MenuManagementOptions = Parameters<typeof useMenuManagement>[0];
type HookOverrides = Omit<Partial<MenuManagementOptions>, 'form'> & {
  form?: Partial<MenuManagementOptions['form']>;
};

function renderMenuHook(overrides: HookOverrides = {}) {
  const { form, ...rest } = overrides;
  return renderHook(() => useMenuManagement({
    user: admin,
    setMenuItems: vi.fn(), setMenuBundles: vi.fn(),
    setAdminMenuItems: vi.fn(), setAdminMenuBundles: vi.fn(),
    form: {
      name: '', category: 'Entrees', price: '12', available: true,
      bundleName: '', bundlePrice: '20', bundleAvailable: true, bundleItems: {},
      ...form
    },
    validateItem: vi.fn(() => true), validateBundle: vi.fn(() => true),
    resetItem: vi.fn(), resetBundle: vi.fn(), clearSection: vi.fn(),
    clearBundleItemsError: vi.fn(), updateNewBundleQuantity: vi.fn(),
    removeSelectedBundle: vi.fn(), removeSelectedItemVariants: vi.fn(),
    retainSelectedBundles: vi.fn(), onError: vi.fn(),
    ...rest
  }));
}

function formEvent() {
  return { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
}

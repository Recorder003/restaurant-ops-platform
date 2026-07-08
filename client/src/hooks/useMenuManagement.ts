import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import {
  createMenuBundle, createMenuItem, fetchMenuBundles, updateMenuBundle,
  updateMenuBundleSoldOut, updateMenuItem, updateMenuItemSoldOut
} from '../api';
import type { MenuBundle, MenuItem, User } from '../types';
import { dollarsToCents } from '../utils/formatters';
import {
  compareMenuBundles, compareMenuItems, getBundleItemsInput, getBundleQuantityMap,
  isAlwaysAvailableMenuItem, setBundleItemQuantity
} from '../utils/menuUtils';

type Options = {
  user: User | null;
  setMenuItems: Dispatch<SetStateAction<MenuItem[]>>;
  setMenuBundles: Dispatch<SetStateAction<MenuBundle[]>>;
  setAdminMenuItems: Dispatch<SetStateAction<MenuItem[]>>;
  setAdminMenuBundles: Dispatch<SetStateAction<MenuBundle[]>>;
  form: {
    name: string; category: string; price: string; available: boolean;
    bundleName: string; bundlePrice: string; bundleAvailable: boolean;
    bundleItems: Record<string, number>;
  };
  validateItem: (input: { name: string; price: string }) => boolean;
  validateBundle: (input: { name: string; price: string; items: Record<string, number> }) => boolean;
  resetItem: () => void;
  resetBundle: () => void;
  clearSection: (section: 'menuItem' | 'menuBundle') => void;
  clearBundleItemsError: () => void;
  updateNewBundleQuantity: (id: string, quantity: number) => void;
  removeSelectedBundle: (id: string) => void;
  removeSelectedItemVariants: (ids: string[]) => void;
  retainSelectedBundles: (ids: string[]) => void;
  onError: (message: string | null) => void;
};

type BundleUpdateInput = Partial<{
  name: string;
  priceCents: number;
  isAvailable: boolean;
  isSoldOut: boolean;
  items: Array<{ menuItemVariantId: string; quantity: number }>;
}>;

export function useMenuManagement(o: Options) {
  const [isCreatingMenuItem, setIsCreatingMenuItem] = useState(false);
  const [isCreatingMenuBundle, setIsCreatingMenuBundle] = useState(false);

  async function handleCreateMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!o.validateItem({ name: o.form.name, price: o.form.price })) return;
    try {
      setIsCreatingMenuItem(true);
      const created = await createMenuItem({ name: o.form.name, category: o.form.category, priceCents: dollarsToCents(o.form.price), isAvailable: o.form.available, isSoldOut: false });
      o.setAdminMenuItems((items) => [...items, created].sort(compareMenuItems));
      if (created.isAvailable && !created.isSoldOut) o.setMenuItems((items) => [...items, created].sort(compareMenuItems));
      o.resetItem(); o.clearSection('menuItem'); o.onError(null);
    } catch (error) { o.onError(error instanceof Error ? error.message : 'Failed to create menu item'); }
    finally { setIsCreatingMenuItem(false); }
  }

  function handleNewBundleItemQuantityChange(id: string, quantity: number) {
    o.clearBundleItemsError(); o.updateNewBundleQuantity(id, quantity);
  }

  async function handleCreateMenuBundle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!o.validateBundle({ name: o.form.bundleName, price: o.form.bundlePrice, items: o.form.bundleItems })) return;
    try {
      setIsCreatingMenuBundle(true);
      const created = await createMenuBundle({ name: o.form.bundleName, priceCents: dollarsToCents(o.form.bundlePrice), isAvailable: o.form.bundleAvailable, isSoldOut: false, items: getBundleItemsInput(o.form.bundleItems) });
      o.setAdminMenuBundles((items) => [...items, created].sort(compareMenuBundles));
      if (created.isAvailable && !created.isSoldOut) o.setMenuBundles((items) => [...items, created].sort(compareMenuBundles));
      o.resetBundle(); o.clearSection('menuBundle'); o.onError(null);
    } catch (error) { o.onError(error instanceof Error ? error.message : 'Failed to create menu bundle'); }
    finally { setIsCreatingMenuBundle(false); }
  }

  async function handleMenuBundleUpdate(bundle: MenuBundle, input: BundleUpdateInput) {
    try {
      const updated = await updateMenuBundle(bundle.id, input);
      syncBundle(updated);
      if (!updated.isAvailable || updated.isSoldOut) o.removeSelectedBundle(updated.id);
      o.onError(null);
    } catch (error) { o.onError(error instanceof Error ? error.message : 'Failed to update menu bundle'); }
  }

  async function handleBundleSoldOutChange(bundle: MenuBundle, isSoldOut: boolean) {
    try {
      const updated = await updateMenuBundleSoldOut(bundle.id, isSoldOut);
      syncBundle(updated);
      if (updated.isSoldOut) o.removeSelectedBundle(updated.id);
      o.onError(null);
    } catch (error) { o.onError(error instanceof Error ? error.message : 'Failed to update combo sold out status'); }
  }

  function handleBundleComponentChange(bundle: MenuBundle, variantId: string, quantity: number) {
    const items = getBundleItemsInput(setBundleItemQuantity(getBundleQuantityMap(bundle), variantId, quantity));
    if (!items.length) { o.onError('A combo must include at least one item'); return; }
    void handleMenuBundleUpdate(bundle, { items });
  }

  async function handleMenuItemUpdate(item: MenuItem, input: Partial<MenuItem>) {
    if (isAlwaysAvailableMenuItem(item) && (input.isAvailable === false || input.isSoldOut === true)) { o.onError(`${item.name} must remain available`); return; }
    try { await syncItem(await updateMenuItem(item.id, input)); o.onError(null); }
    catch (error) { o.onError(error instanceof Error ? error.message : 'Failed to update menu item'); }
  }

  async function handleSoldOutChange(item: MenuItem, isSoldOut: boolean) {
    if (isAlwaysAvailableMenuItem(item) && isSoldOut) { o.onError(`${item.name} cannot be marked sold out`); return; }
    try {
      const updated = o.user?.role === 'admin' ? await updateMenuItem(item.id, { isSoldOut }) : await updateMenuItemSoldOut(item.id, isSoldOut);
      await syncItem(updated); o.onError(null);
    } catch (error) { o.onError(error instanceof Error ? error.message : 'Failed to update sold out status'); }
  }

  function syncBundle(updated: MenuBundle) {
    o.setAdminMenuBundles((items) => items.map((item) => item.id === updated.id ? updated : item).sort(compareMenuBundles));
    o.setMenuBundles((items) => {
      const rest = items.filter((item) => item.id !== updated.id);
      return updated.isAvailable && !updated.isSoldOut ? [...rest, updated].sort(compareMenuBundles) : rest;
    });
  }

  async function syncItem(updated: MenuItem) {
    o.setAdminMenuItems((items) => items.map((item) => item.id === updated.id ? updated : item).sort(compareMenuItems));
    o.setMenuItems((items) => {
      const rest = items.filter((item) => item.id !== updated.id);
      return updated.isAvailable && !updated.isSoldOut ? [...rest, updated].sort(compareMenuItems) : rest;
    });
    if (!updated.isAvailable || updated.isSoldOut) o.removeSelectedItemVariants(updated.variants.map((variant) => variant.id));
    const bundles = await fetchMenuBundles();
    o.setMenuBundles(bundles); o.retainSelectedBundles(bundles.map((bundle) => bundle.id));
  }

  return { isCreatingMenuItem, isCreatingMenuBundle, handleCreateMenuItem, handleNewBundleItemQuantityChange, handleCreateMenuBundle, handleMenuBundleUpdate, handleBundleSoldOutChange, handleBundleComponentChange, handleMenuItemUpdate, handleSoldOutChange };
}

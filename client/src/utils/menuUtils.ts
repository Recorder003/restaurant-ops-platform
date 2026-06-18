import type { MenuBundle, MenuItem } from '../types';

const alwaysAvailableMenuItemNames = new Set(['Lemon Iced Tea', 'Signature Beef Noodles']);

export function compareMenuItems(left: MenuItem, right: MenuItem) {
  return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
}

export function compareMenuBundles(left: MenuBundle, right: MenuBundle) {
  return left.name.localeCompare(right.name);
}

export function isAlwaysAvailableMenuItem(menuItem: MenuItem) {
  return alwaysAvailableMenuItemNames.has(menuItem.name);
}

export function getMenuVariantOptions(menuItems: MenuItem[]) {
  return menuItems
    .filter((item) => item.isAvailable && !item.isSoldOut)
    .flatMap((item) => item.variants.map((variant) => ({
      menuItemVariantId: variant.id,
      label: formatMenuVariantLabel(item, variant),
      category: item.category,
      priceCents: variant.priceCents
    })))
    .sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label));
}

export function setBundleItemQuantity(current: Record<string, number>, menuItemVariantId: string, quantity: number) {
  const next = { ...current };
  const normalized = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;

  if (normalized > 0) {
    next[menuItemVariantId] = normalized;
  } else {
    delete next[menuItemVariantId];
  }

  return next;
}

export function getBundleItemsInput(items: Record<string, number>) {
  return Object.entries(items)
    .filter(([, quantity]) => quantity > 0)
    .map(([menuItemVariantId, quantity]) => ({ menuItemVariantId, quantity }));
}

export function getBundleQuantityMap(menuBundle: MenuBundle) {
  return menuBundle.items.reduce<Record<string, number>>((quantities, item) => {
    quantities[item.menuItemVariantId] = item.quantity;
    return quantities;
  }, {});
}

export function getBundleComponentQuantity(menuBundle: MenuBundle, menuItemVariantId: string) {
  return menuBundle.items.find((item) => item.menuItemVariantId === menuItemVariantId)?.quantity ?? 0;
}

export function formatMenuBundleItemLabel(item: MenuBundle['items'][number]) {
  return item.variantName === 'Regular' ? item.menuItemName : `${item.menuItemName} / ${item.variantName}`;
}

export function getMenuItemByVariantId(menuItems: MenuItem[], variantId: string) {
  return menuItems.find((item) => item.variants.some((variant) => variant.id === variantId));
}

export function getMenuItemVariantById(menuItems: MenuItem[], variantId: string) {
  return menuItems.flatMap((item) => item.variants).find((variant) => variant.id === variantId);
}

export function formatMenuVariantLabel(menuItem: MenuItem, variant: MenuItem['variants'][number]) {
  return variant.name === 'Regular' ? menuItem.name : `${menuItem.name} / ${variant.name}`;
}

import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MenuManagementPanel } from './MenuManagementPanel';
import { createMenuBundle, createMenuItem } from '../test/factories';

const menuItem = createMenuItem();
const bundle = createMenuBundle({
  items: [{
    menuItemId: 'menu-1', menuItemVariantId: 'variant-1', menuItemName: 'Fried Rice',
    variantName: 'Regular', category: 'Entrees', quantity: 1, priceCents: 1200,
    isAvailable: true, isSoldOut: false
  }]
});
const variantOption = { menuItemVariantId: 'variant-1', label: 'Fried Rice', category: 'Entrees', priceCents: 1200 };

describe('MenuManagementPanel', () => {
  it('forwards new item fields and creation', async () => {
    const onName = vi.fn(); const onCreate = vi.fn((event) => event.preventDefault());
    render(<MenuManagementPanel {...props({ onNewMenuNameChange: onName, onCreateMenuItem: onCreate })} />);
    await userEvent.type(screen.getByLabelText(/Item/), 'Soup');
    await userEvent.click(screen.getByRole('button', { name: 'Create Item' }));
    expect(onName).toHaveBeenCalled();
    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.getByText('Enter the menu item name.')).toBeInTheDocument();
  });

  it('updates an existing menu item and its availability controls', async () => {
    const onMenuItemUpdate = vi.fn();
    const onMenuItemSoldOutChange = vi.fn();
    render(<MenuManagementPanel {...props({ menuItems: [menuItem], onMenuItemUpdate, onMenuItemSoldOutChange })} />);
    const row = screen.getByText('Fried Rice').closest('article')!;

    const name = within(row).getByLabelText('Fried Rice name');
    await userEvent.clear(name);
    await userEvent.type(name, 'House Fried Rice');
    await userEvent.tab();
    await userEvent.selectOptions(within(row).getByLabelText('Fried Rice category'), 'Vegetables');
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Available' }));
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Sold Out' }));

    expect(onMenuItemUpdate).toHaveBeenCalledWith(menuItem, { name: 'House Fried Rice' });
    expect(onMenuItemUpdate).toHaveBeenCalledWith(menuItem, { category: 'Vegetables' });
    expect(onMenuItemUpdate).toHaveBeenCalledWith(menuItem, { isAvailable: false });
    expect(onMenuItemSoldOutChange).toHaveBeenCalledWith(menuItem, true);
  });

  it('disables availability changes for protected default menu items', () => {
    render(<MenuManagementPanel {...props({ menuItems: [menuItem], isAlwaysAvailableMenuItem: () => true })} />);
    const row = screen.getByText('Fried Rice').closest('article')!;

    expect(within(row).getByText('Protected availability')).toBeInTheDocument();
    expect(within(row).getByRole('checkbox', { name: 'Available' })).toBeDisabled();
    expect(within(row).getByRole('checkbox', { name: 'Sold Out' })).toBeDisabled();
  });

  it('creates a combo and updates an existing combo and its components', async () => {
    const onCreateMenuBundle = vi.fn((event) => event.preventDefault());
    const onNewBundleItemQuantityChange = vi.fn();
    const onMenuBundleUpdate = vi.fn();
    const onMenuBundleSoldOutChange = vi.fn();
    const onBundleComponentChange = vi.fn();
    render(<MenuManagementPanel {...props({
      menuBundles: [bundle], menuVariantOptions: [variantOption],
      getBundleComponentQuantity: () => 1,
      formatMenuBundleItemLabel: (item) => item.menuItemName,
      onCreateMenuBundle, onNewBundleItemQuantityChange, onMenuBundleUpdate,
      onMenuBundleSoldOutChange, onBundleComponentChange
    })} />);

    await userEvent.type(screen.getByLabelText(/Combo \*/), 'Dinner Combo');
    await userEvent.clear(screen.getByLabelText('Fried Rice combo quantity'));
    await userEvent.type(screen.getByLabelText('Fried Rice combo quantity'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Create Combo' }));

    const row = screen.getByText('Lunch Combo').closest('article')!;
    const price = within(row).getByLabelText('Lunch Combo price');
    await userEvent.clear(price);
    await userEvent.type(price, '18.50');
    await userEvent.tab();
    await userEvent.click(within(row).getByRole('checkbox', { name: 'Sold Out' }));
    const quantity = within(row).getByLabelText('Lunch Combo Fried Rice quantity');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '2');
    await userEvent.tab();

    expect(onNewBundleItemQuantityChange).toHaveBeenLastCalledWith('variant-1', 2);
    expect(onCreateMenuBundle).toHaveBeenCalledOnce();
    expect(onMenuBundleUpdate).toHaveBeenCalledWith(bundle, { priceCents: 1850 });
    expect(onMenuBundleSoldOutChange).toHaveBeenCalledWith(bundle, true);
    expect(onBundleComponentChange).toHaveBeenCalledWith(bundle, 'variant-1', 2);
  });
});

function props(overrides: Partial<ComponentProps<typeof MenuManagementPanel>> = {}): ComponentProps<typeof MenuManagementPanel> {
  const noop = vi.fn();
  return {
    menuCategories: ['Combos', 'Entrees', 'Vegetables'], menuItems: [], menuBundles: [], menuVariantOptions: [],
    newMenuName: '', newMenuCategory: 'Entrees', newMenuPrice: '12.00', newMenuAvailable: true,
    newBundleName: '', newBundlePrice: '20.00', newBundleAvailable: true, newBundleItems: {},
    menuItemErrors: { name: 'Enter the menu item name.' }, menuBundleErrors: {},
    isCreatingMenuItem: false, isCreatingMenuBundle: false,
    formatMoney: (value) => `$${(value / 100).toFixed(2)}`, dollarsToCents: (value) => Math.round(Number(value) * 100),
    formatMenuBundleItemLabel: () => '', getBundleComponentQuantity: () => 0,
    isAlwaysAvailableMenuItem: () => false, onCreateMenuItem: noop, onCreateMenuBundle: noop,
    onNewMenuNameChange: noop, onNewMenuCategoryChange: noop, onNewMenuPriceChange: noop,
    onNewMenuAvailableChange: noop, onNewBundleNameChange: noop, onNewBundlePriceChange: noop,
    onNewBundleAvailableChange: noop, onNewBundleItemQuantityChange: noop, onMenuItemUpdate: noop,
    onMenuItemSoldOutChange: noop, onMenuBundleUpdate: noop, onMenuBundleSoldOutChange: noop,
    onBundleComponentChange: noop, ...overrides
  };
}

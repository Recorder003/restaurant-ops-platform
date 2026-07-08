import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrderMenuPicker } from './OrderMenuPicker';
import { createMenuBundle, createMenuItem } from '../../test/factories';
import type { DraftItem } from '../../types';

const menuItem = createMenuItem({
  id: 'menu-1',
  name: 'Beef Noodles',
  category: 'Entrees',
  variants: [{ id: 'variant-1', menuItemId: 'menu-1', name: 'Regular', priceCents: 1380, isDefault: true }]
});

const bundle = createMenuBundle({
  id: 'bundle-1',
  name: 'Lunch Combo',
  priceCents: 2000
});

const draftItem: DraftItem = {
  menuItemId: 'menu-1',
  menuItemVariantId: 'variant-1',
  quantity: 2
};

const bundleDraftItem: DraftItem = {
  bundleId: 'bundle-1',
  quantity: 1
};

describe('OrderMenuPicker', () => {
  it('changes categories and adds visible menu items', async () => {
    const user = userEvent.setup();
    const onSelectedCategoryChange = vi.fn();
    const onMenuQuantityChange = vi.fn();

    renderMenuPicker({
      onSelectedCategoryChange,
      onMenuQuantityChange,
      selectedItems: { 'variant-1': 1 }
    });

    await user.click(screen.getByRole('button', { name: 'Combos' }));
    await user.click(screen.getByRole('button', { name: /Beef Noodles/ }));

    expect(onSelectedCategoryChange).toHaveBeenCalledWith('Combos');
    expect(onMenuQuantityChange).toHaveBeenCalledWith('variant-1', 2);
  });

  it('adds combos and adjusts item and combo quantities from the summary', async () => {
    const user = userEvent.setup();
    const onMenuQuantityChange = vi.fn();
    const onBundleQuantityChange = vi.fn();

    renderMenuPicker({
      selectedCategory: 'Combos',
      selectedBundles: { 'bundle-1': 1 },
      draftItems: [draftItem, bundleDraftItem],
      onMenuQuantityChange,
      onBundleQuantityChange
    });

    await user.click(screen.getByRole('button', { name: /Lunch Combo/ }));

    const itemSummary = screen.getByText('Beef Noodles x 2').closest('li')!;
    await user.click(itemSummary.querySelectorAll('button')[0]);
    await user.click(itemSummary.querySelectorAll('button')[1]);

    const bundleSummary = screen.getByText('Lunch Combo x 1').closest('li')!;
    await user.click(bundleSummary.querySelectorAll('button')[0]);
    await user.click(bundleSummary.querySelectorAll('button')[1]);

    expect(onBundleQuantityChange).toHaveBeenNthCalledWith(1, 'bundle-1', 2);
    expect(onMenuQuantityChange).toHaveBeenNthCalledWith(1, 'variant-1', 1);
    expect(onMenuQuantityChange).toHaveBeenNthCalledWith(2, 'variant-1', 3);
    expect(onBundleQuantityChange).toHaveBeenNthCalledWith(2, 'bundle-1', 0);
    expect(onBundleQuantityChange).toHaveBeenNthCalledWith(3, 'bundle-1', 2);
  });

  it('focuses item errors, shows empty summaries, and handles notes/cancel/save labels', async () => {
    const user = userEvent.setup();
    const onNotesChange = vi.fn();
    const onCancel = vi.fn();

    renderMenuPicker({
      draftItems: [],
      formErrors: { items: 'Add at least one item.' },
      notes: 'Less spicy',
      isSubmitting: true,
      editingOrderId: 'order-1',
      onNotesChange,
      onCancel
    });

    expect(screen.getByText('Add at least one item.')).toHaveFocus();
    expect(screen.getByText('No items selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();

    await user.type(screen.getByLabelText('Notes'), ' please');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onNotesChange).toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

type MenuPickerOverrides = Partial<Parameters<typeof OrderMenuPicker>[0]>;

function renderMenuPicker(overrides: MenuPickerOverrides = {}) {
  const props = {
    categories: ['Entrees', 'Combos'],
    selectedCategory: 'Entrees',
    selectedItems: {},
    selectedBundles: {},
    menuItems: [menuItem],
    menuBundles: [bundle],
    draftItems: [draftItem],
    formErrors: {},
    notes: '',
    isSubmitting: false,
    editingOrderId: null,
    formatMoney: (cents: number) => `$${(cents / 100).toFixed(2)}`,
    formatMenuVariantLabel: () => 'Beef Noodles',
    getMenuItemVariantById: () => menuItem.variants[0],
    onSelectedCategoryChange: vi.fn(),
    onMenuQuantityChange: vi.fn(),
    onBundleQuantityChange: vi.fn(),
    onNotesChange: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  };

  return render(<OrderMenuPicker {...props} />);
}

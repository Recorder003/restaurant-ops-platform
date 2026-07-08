import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OrderBoard } from './OrderBoard';
import { OrderEntryPanel } from './OrderEntryPanel';
import { createMenuBundle, createMenuItem, createRestaurantTable } from '../test/factories';
import type { DraftItem } from '../types';

const menuItem = createMenuItem({
  name: 'Beef Noodles',
  priceCents: 1380,
  variants: [{ id: 'variant-1', menuItemId: 'menu-1', name: 'Regular', priceCents: 1380, isDefault: true }]
});
const availableTable = createRestaurantTable();
const occupiedTable = createRestaurantTable({ id: 'table-2', name: 'T2', status: 'occupied' });
const cleaningTable = createRestaurantTable({ id: 'table-3', name: 'T3', status: 'needs_cleaning' });
const draftItem: DraftItem = {
  menuItemId: 'menu-1', menuItemVariantId: 'variant-1', quantity: 2
};
const combo = createMenuBundle({
  id: 'combo-1',
  priceCents: 1800,
  items: [{
    menuItemId: 'menu-1',
    menuItemVariantId: 'variant-1',
    menuItemName: 'Beef Noodles',
    variantName: 'Regular',
    category: 'Entrees',
    quantity: 1,
    priceCents: 1380,
    isAvailable: true,
    isSoldOut: false
  }]
});
const comboDraftItem: DraftItem = {
  bundleId: 'combo-1',
  quantity: 1
};

describe('workflow panels', () => {
  it('passes staff filter edits and form commands to the order board controller', async () => {
    const onFiltersChange = vi.fn();
    const onFilterSubmit = vi.fn((event) => event.preventDefault());
    render(<OrderBoard {...orderBoardProps({ onFiltersChange, onFilterSubmit })} />);

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'pending');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onFiltersChange).toHaveBeenCalled();
    expect(onFilterSubmit).toHaveBeenCalledOnce();
    expect(screen.getByText('No orders yet')).toBeInTheDocument();
  });

  it('starts the selected service workflow from the order entry screen', async () => {
    const onStartStaffOrder = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({ onStartStaffOrder })} />);

    await userEvent.click(screen.getByRole('button', { name: /Dine-in/ }));
    await userEvent.click(screen.getByRole('button', { name: /Phone delivery/ }));

    expect(onStartStaffOrder).toHaveBeenNthCalledWith(1, 'in_person', 'dine_in');
    expect(onStartStaffOrder).toHaveBeenNthCalledWith(2, 'phone', 'delivery');
  });

  it('updates party size and advances the dine-in workflow', async () => {
    const onPartySizeChange = vi.fn(); const onNext = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({ staffOrderStep: 'party', partySize: '2', maxPartySize: 4, onPartySizeChange, onGoToStaffMenuStep: onNext })} />);
    await userEvent.click(screen.getByRole('button', { name: '+' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPartySizeChange).toHaveBeenCalledWith('3');
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('shows phone validation and forwards phone input', async () => {
    const onPhoneNumberChange = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({ staffOrderStep: 'phone', orderSource: 'phone', fulfillmentType: 'pickup', formErrors: { phoneNumber: 'Enter the customer phone number.' }, onPhoneNumberChange })} />);
    const phone = screen.getByLabelText(/Phone/);
    expect(phone).toHaveFocus();
    await userEvent.type(phone, '6025550100');
    expect(onPhoneNumberChange).toHaveBeenCalled();
  });

  it('selects available tables, blocks occupied ones, and reports cleaning', async () => {
    const onTableSelect = vi.fn();
    const onTableCleaned = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({
      staffOrderStep: 'table',
      restaurantTables: [availableTable, occupiedTable, cleaningTable],
      onTableSelect,
      onTableCleaned
    })} />);

    await userEvent.click(screen.getByRole('button', { name: /T1Available/ }));
    expect(screen.getByRole('button', { name: /T2Occupied/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'T3 Cleaned' }));

    expect(onTableSelect).toHaveBeenCalledWith(availableTable);
    expect(onTableCleaned).toHaveBeenCalledWith(cleaningTable);
  });

  it('changes menu categories and updates item quantities from menu and summary', async () => {
    const onSelectedCategoryChange = vi.fn();
    const onMenuQuantityChange = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({
      staffOrderStep: 'menu',
      categories: ['Entrees', 'Drinks'],
      selectedCategory: 'Entrees',
      selectedItems: { 'variant-1': 2 },
      menuItems: [menuItem],
      draftItems: [draftItem],
      onSelectedCategoryChange,
      onMenuQuantityChange,
      formatMenuVariantLabel: (item) => item.name,
      getMenuItemVariantById: () => menuItem.variants[0]
    })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Drinks' }));
    await userEvent.click(screen.getByRole('button', { name: /Beef Noodles\$13.80/ }));
    const summary = screen.getByText('Beef Noodles x 2').closest('li')!;
    await userEvent.click(summary.querySelectorAll('button')[0]);
    await userEvent.click(summary.querySelectorAll('button')[1]);

    expect(onSelectedCategoryChange).toHaveBeenCalledWith('Drinks');
    expect(onMenuQuantityChange).toHaveBeenNthCalledWith(1, 'variant-1', 3);
    expect(onMenuQuantityChange).toHaveBeenNthCalledWith(2, 'variant-1', 1);
    expect(onMenuQuantityChange).toHaveBeenNthCalledWith(3, 'variant-1', 3);
  });

  it('submits edits, exposes cancel, and disables duplicate saves', async () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    const onCancelEdit = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({
      role: 'admin', editingOrderId: 'order-1', isSubmitting: false, onSubmit, onCancelEdit
    })} />);

    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Edit' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onCancelEdit).toHaveBeenCalledOnce();
  });

  it('lets staff add and adjust combos from the menu picker', async () => {
    const onBundleQuantityChange = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({
      staffOrderStep: 'menu',
      categories: ['Combos', 'Entrees'],
      selectedCategory: 'Combos',
      selectedBundles: { 'combo-1': 1 },
      menuBundles: [combo],
      draftItems: [comboDraftItem],
      onBundleQuantityChange
    })} />);

    await userEvent.click(screen.getByRole('button', { name: /Lunch Combo/ }));
    const summary = screen.getByText('Lunch Combo x 1').closest('li')!;
    await userEvent.click(summary.querySelectorAll('button')[0]);
    await userEvent.click(summary.querySelectorAll('button')[1]);

    expect(onBundleQuantityChange).toHaveBeenNthCalledWith(1, 'combo-1', 2);
    expect(onBundleQuantityChange).toHaveBeenNthCalledWith(2, 'combo-1', 0);
    expect(onBundleQuantityChange).toHaveBeenNthCalledWith(3, 'combo-1', 2);
  });

  it('shows item validation errors, empty menu summary, notes, and saving state', async () => {
    const onNotesChange = vi.fn();
    const onResetOrderDraft = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({
      staffOrderStep: 'menu',
      formErrors: { items: 'Add at least one item.' },
      notes: 'Less spicy',
      isSubmitting: true,
      onNotesChange,
      onResetOrderDraft
    })} />);

    expect(screen.getByText('Add at least one item.')).toHaveFocus();
    expect(screen.getByText('No items selected')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Notes'), ' please');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(onNotesChange).toHaveBeenCalled();
    expect(onResetOrderDraft).toHaveBeenCalledOnce();
  });

  it('renders admin dine-in table picker controls and forwards service edits', async () => {
    const onOpenTablePicker = vi.fn();
    const onFulfillmentTypeChange = vi.fn();
    const onPartySizeChange = vi.fn();
    const onNotesChange = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({
      role: 'admin',
      selectedTable: availableTable,
      tableNumber: 'T1',
      partySize: '2',
      maxPartySize: 6,
      formErrors: { partySize: 'Party size is too large.' },
      notes: 'Window seat',
      onOpenTablePicker,
      onFulfillmentTypeChange,
      onPartySizeChange,
      onNotesChange
    })} />);

    expect(screen.getByText('Selected: T1 / 4 seats / max 6 guests')).toBeInTheDocument();
    expect(screen.getByText('Party size is too large.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change T1' }));
    await userEvent.selectOptions(screen.getByLabelText('Service'), 'to_go');
    await userEvent.clear(screen.getByLabelText(/Party Size/));
    await userEvent.type(screen.getByLabelText(/Party Size/), '5');
    await userEvent.type(screen.getByLabelText('Notes'), ' please');

    expect(onOpenTablePicker).toHaveBeenCalledOnce();
    expect(onFulfillmentTypeChange).toHaveBeenCalledWith('to_go');
    expect(onPartySizeChange).toHaveBeenCalled();
    expect(onNotesChange).toHaveBeenCalled();
  });

  it('renders admin phone service controls and source switching', async () => {
    const onOrderSourceChange = vi.fn();
    const onFulfillmentTypeChange = vi.fn();
    const onPhoneNumberChange = vi.fn();
    const onServerNameChange = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({
      role: 'admin',
      orderSource: 'phone',
      fulfillmentType: 'pickup',
      phoneNumber: '6025550100',
      serverName: '',
      formErrors: {
        phoneNumber: 'Enter the customer phone number.',
        serverName: 'Enter the server name.'
      },
      onOrderSourceChange,
      onFulfillmentTypeChange,
      onPhoneNumberChange,
      onServerNameChange
    })} />);

    expect(screen.getByText('Enter the customer phone number.')).toBeInTheDocument();
    expect(screen.getByText('Enter the server name.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'In-person' }));
    await userEvent.selectOptions(screen.getByLabelText('Service'), 'delivery');
    await userEvent.type(screen.getByLabelText(/Phone/), '1');
    await userEvent.type(screen.getByLabelText(/Server/), 'Kent');

    expect(onOrderSourceChange).toHaveBeenCalledWith('in_person');
    expect(onFulfillmentTypeChange).toHaveBeenCalledWith('delivery');
    expect(onPhoneNumberChange).toHaveBeenCalled();
    expect(onServerNameChange).toHaveBeenCalled();
  });

  it('renders admin menu quantities for combos and variants', async () => {
    const onBundleQuantityChange = vi.fn();
    const onMenuQuantityChange = vi.fn();
    render(<OrderEntryPanel {...orderEntryProps({
      role: 'admin',
      categories: ['Combos', 'Entrees'],
      menuBundles: [combo],
      menuItems: [menuItem],
      selectedBundles: { 'combo-1': 1 },
      selectedItems: { 'variant-1': 2 },
      onBundleQuantityChange,
      onMenuQuantityChange,
      formatMenuVariantLabel: (item) => item.name
    })} />);

    fireEvent.change(screen.getByLabelText('Lunch Combo quantity'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Beef Noodles quantity'), { target: { value: '4' } });

    expect(onBundleQuantityChange).toHaveBeenLastCalledWith('combo-1', 3);
    expect(onMenuQuantityChange).toHaveBeenLastCalledWith('variant-1', 4);
  });
});

function orderBoardProps(overrides: Partial<ComponentProps<typeof OrderBoard>> = {}): ComponentProps<typeof OrderBoard> {
  return {
    role: 'staff', orders: [], filteredOrders: [],
    filters: { status: 'active', tableNumber: '', serverName: '', fromDate: '', toDate: '', page: 1, limit: 8 },
    pagination: { page: 1, limit: 8, total: 0, totalPages: 0 }, isLoading: false,
    processingOrderActionId: null, processingItemActionId: null,
    formatMoney: (value) => `$${(value / 100).toFixed(2)}`, formatOrderItemName: () => '', getOrderTitle: () => '',
    onFiltersChange: vi.fn(), onFilterSubmit: vi.fn(), onFilterReset: vi.fn(), onPageChange: vi.fn(),
    onReceipt: vi.fn(), onHistory: vi.fn(), onEdit: vi.fn(), onOrderStatusChange: vi.fn(),
    onItemStatusChange: vi.fn(), onCheckout: vi.fn(), ...overrides
  };
}

function orderEntryProps(overrides: Partial<ComponentProps<typeof OrderEntryPanel>> = {}): ComponentProps<typeof OrderEntryPanel> {
  const noop = vi.fn();
  return {
    role: 'staff', editingOrderId: null, staffOrderStep: 'service', orderSource: 'in_person',
    fulfillmentType: 'dine_in', tableNumber: '', partySize: '2', phoneNumber: '', serverName: 'Kent',
    notes: '', selectedCategory: 'Entrees', selectedItems: {}, selectedBundles: {}, categories: ['Entrees'],
    menuItems: [], menuBundles: [], restaurantTables: [], selectedTable: undefined,
    tableStatusLabels: { available: 'Available', occupied: 'Occupied', needs_cleaning: 'Needs cleaning' },
    draftItems: [], draftTotal: 0, maxPartySize: 99, formErrors: {}, isSubmitting: false,
    formatMoney: (value) => `$${(value / 100).toFixed(2)}`, formatMenuVariantLabel: () => '',
    getMenuItemVariantById: () => undefined, getOrderFlowLabel: () => 'Dine-in', onSubmit: noop,
    onStartStaffOrder: noop, onOrderSourceChange: noop, onFulfillmentTypeChange: noop, onTableSelect: noop,
    onTableCleaned: noop, onOpenTablePicker: noop, onPartySizeChange: noop, onPhoneNumberChange: noop,
    onServerNameChange: noop, onNotesChange: noop, onSelectedCategoryChange: noop, onStaffOrderStepChange: noop,
    onResetOrderDraft: noop, onGoToStaffPartyStep: noop, onGoToStaffMenuStep: noop,
    onMenuQuantityChange: noop, onBundleQuantityChange: noop, onCancelEdit: noop, ...overrides
  };
}

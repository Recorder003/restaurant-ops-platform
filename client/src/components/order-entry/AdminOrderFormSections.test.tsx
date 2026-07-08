import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminMenuQuantityList, AdminOrderSourceFields, ServerNotesFields } from './AdminOrderFormSections';
import { createMenuBundle, createMenuItem, createRestaurantTable } from '../../test/factories';

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

describe('AdminOrderFormSections', () => {
  it('renders dine-in source fields and forwards source/table/party changes', async () => {
    const user = userEvent.setup();
    const onOrderSourceChange = vi.fn();
    const onFulfillmentTypeChange = vi.fn();
    const onOpenTablePicker = vi.fn();
    const onPartySizeChange = vi.fn();

    render(
      <AdminOrderSourceFields
        orderSource="in_person"
        fulfillmentType="dine_in"
        partySize="2"
        phoneNumber=""
        selectedTable={createRestaurantTable({ name: 'T3', capacity: 4 })}
        maxPartySize={6}
        formErrors={{ tableNumber: 'Choose a table.', partySize: 'Too many guests.' }}
        tableErrorRef={createRef()}
        partySizeRef={createRef()}
        phoneRef={createRef()}
        onOrderSourceChange={onOrderSourceChange}
        onFulfillmentTypeChange={onFulfillmentTypeChange}
        onOpenTablePicker={onOpenTablePicker}
        onPartySizeChange={onPartySizeChange}
        onPhoneNumberChange={vi.fn()}
      />
    );

    expect(screen.getByText('Selected: T3 / 4 seats / max 6 guests')).toBeInTheDocument();
    expect(screen.getByText('Choose a table.')).toBeInTheDocument();
    expect(screen.getByText('Too many guests.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Phone' }));
    await user.selectOptions(screen.getByLabelText('Service'), 'to_go');
    await user.click(screen.getByRole('button', { name: 'Change T3' }));
    await user.clear(screen.getByLabelText(/Party Size/));
    await user.type(screen.getByLabelText(/Party Size/), '5');

    expect(onOrderSourceChange).toHaveBeenCalledWith('phone');
    expect(onFulfillmentTypeChange).toHaveBeenCalledWith('to_go');
    expect(onOpenTablePicker).toHaveBeenCalledOnce();
    expect(onPartySizeChange).toHaveBeenCalled();
  });

  it('renders phone source fields and forwards phone service edits', async () => {
    const user = userEvent.setup();
    const onFulfillmentTypeChange = vi.fn();
    const onPhoneNumberChange = vi.fn();

    render(
      <AdminOrderSourceFields
        orderSource="phone"
        fulfillmentType="pickup"
        partySize="1"
        phoneNumber="6025550100"
        selectedTable={undefined}
        maxPartySize={99}
        formErrors={{ phoneNumber: 'Enter the phone number.' }}
        tableErrorRef={createRef()}
        partySizeRef={createRef()}
        phoneRef={createRef()}
        onOrderSourceChange={vi.fn()}
        onFulfillmentTypeChange={onFulfillmentTypeChange}
        onOpenTablePicker={vi.fn()}
        onPartySizeChange={vi.fn()}
        onPhoneNumberChange={onPhoneNumberChange}
      />
    );

    expect(screen.getByText('Enter the phone number.')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Service'), 'delivery');
    await user.type(screen.getByLabelText(/Phone/), '1');

    expect(onFulfillmentTypeChange).toHaveBeenCalledWith('delivery');
    expect(onPhoneNumberChange).toHaveBeenCalled();
  });

  it('renders server and notes fields with validation', async () => {
    const user = userEvent.setup();
    const onServerNameChange = vi.fn();
    const onNotesChange = vi.fn();

    render(
      <ServerNotesFields
        serverName=""
        notes="Window seat"
        formErrors={{ serverName: 'Enter server name.' }}
        serverRef={createRef()}
        onServerNameChange={onServerNameChange}
        onNotesChange={onNotesChange}
      />
    );

    expect(screen.getByText('Enter server name.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Server/), 'Kent');
    await user.type(screen.getByLabelText('Notes'), ' please');

    expect(onServerNameChange).toHaveBeenCalled();
    expect(onNotesChange).toHaveBeenCalled();
  });

  it('renders admin menu quantities for combos and menu variants', () => {
    const onBundleQuantityChange = vi.fn();
    const onMenuQuantityChange = vi.fn();

    render(
      <AdminMenuQuantityList
        categories={['Combos', 'Entrees']}
        menuItems={[menuItem]}
        menuBundles={[bundle]}
        selectedItems={{ 'variant-1': 2 }}
        selectedBundles={{ 'bundle-1': 1 }}
        formatMoney={(cents) => `$${(cents / 100).toFixed(2)}`}
        formatMenuVariantLabel={() => 'Beef Noodles'}
        onMenuQuantityChange={onMenuQuantityChange}
        onBundleQuantityChange={onBundleQuantityChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Lunch Combo quantity'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Beef Noodles quantity'), { target: { value: '4' } });

    expect(onBundleQuantityChange).toHaveBeenCalledWith('bundle-1', 3);
    expect(onMenuQuantityChange).toHaveBeenCalledWith('variant-1', 4);
  });
});

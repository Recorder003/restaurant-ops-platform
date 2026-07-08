import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CheckoutModal } from './CheckoutModal';
import { SoldOutPanel } from './SoldOutPanel';
import { TablePickerModal } from './TablePickerModal';
import { createMenuItem, createOrder, createOrderItem, createRestaurantTable } from '../test/factories';

const item = createMenuItem({ id: 'm1', variants: [{ id: 'v1', menuItemId: 'm1', name: 'Regular', priceCents: 1200, isDefault: true }] });
const availableTable = createRestaurantTable({ id: 't1' });
const occupiedTable = createRestaurantTable({ id: 't2', name: 'T2', status: 'occupied' });
const orderItem = createOrderItem({ id: 'oi1', menuItemId: 'm1', menuItemVariantId: 'v1' });
const order = createOrder({ id: 'o1', items: [] });

function createCheckoutProps(overrides: Partial<ComponentProps<typeof CheckoutModal>> = {}): ComponentProps<typeof CheckoutModal> {
  return {
    order, isSplitBillOpen: false, splitBills: [], activeSplitBill: undefined,
    activeSplitBillId: null, activeSplitLabel: 'Full unpaid bill', isActiveAmountSplit: false,
    selectedItemIds: [], unpaidItems: [], paymentMethod: 'card', tip: '0.00', tipPreset: 'custom',
    tipPresetOptions: [10, 15, 20], subtotalCents: 1200, taxCents: 103, tipCents: 0,
    totalCents: 1303, isCheckingOut: false, formatMoney: (value) => `$${(value / 100).toFixed(2)}`,
    formatOrderItemName: (value) => value.menuItemName, getOrderTitle: () => 'Table T1 / 2 guests',
    getSplitBillSubtotal: (splitBill) => splitBill.amountCents ?? 1200,
    isPayableSplitBill: () => true,
    onCloseCheckout: vi.fn(), onSubmitCheckout: vi.fn(), onOpenSplitBill: vi.fn(), onCloseSplitBill: vi.fn(),
    onTipPreset: vi.fn(), onTipChange: vi.fn(), onPaymentMethodChange: vi.fn(), onActiveSplitBillChange: vi.fn(),
    onAddSplitBill: vi.fn(), onSplitItemClick: vi.fn(), onDistributeSplitBills: vi.fn(),
    onSelectAllForActiveSplit: vi.fn(), onClearActiveSplit: vi.fn(), onMergeSplitBills: vi.fn(),
    onRemoveActiveSplitBill: vi.fn(), onApplyActiveSplitBill: vi.fn(),
    ...overrides
  };
}

describe('operational controls', () => {
  it('reports a chef sold-out change from a real checkbox interaction', async () => {
    const onSoldOutChange = vi.fn();
    render(<SoldOutPanel menuItems={[item]} isAlwaysAvailableMenuItem={() => false} onSoldOutChange={onSoldOutChange} />);

    await userEvent.click(screen.getByRole('checkbox'));

    expect(onSoldOutChange).toHaveBeenCalledWith(item, true);
  });

  it('selects available tables and prevents occupied table selection', async () => {
    const onSelect = vi.fn();
    render(<TablePickerModal
      tables={[availableTable, occupiedTable]}
      tableNumber=""
      selectedTable={undefined}
      tableStatusLabels={{ available: 'Available', occupied: 'Occupied', needs_cleaning: 'Needs cleaning' }}
      onSelect={onSelect}
      onClose={() => {}}
    />);

    await userEvent.click(screen.getByRole('button', { name: /T1/ }));

    expect(onSelect).toHaveBeenCalledWith(availableTable);
    expect(screen.getByRole('button', { name: /T2/ })).toBeDisabled();
  });

  it('handles checkout tip and close commands', async () => {
    const onTipPreset = vi.fn();
    const onCloseCheckout = vi.fn();
    const props = createCheckoutProps({ onTipPreset, onCloseCheckout });
    render(<CheckoutModal {...props} />);

    await userEvent.click(screen.getByRole('button', { name: '10%' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onTipPreset).toHaveBeenCalledWith(10);
    expect(onCloseCheckout).toHaveBeenCalledOnce();
  });

  it('submits custom tip and payment method interactions', async () => {
    const onTipChange = vi.fn();
    const onPaymentMethodChange = vi.fn();
    const onSubmitCheckout = vi.fn((event) => event.preventDefault());
    function CheckoutHarness() {
      const [tip, setTip] = useState('0.00');
      const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
      return <CheckoutModal {...createCheckoutProps({
        tip,
        paymentMethod,
        onTipChange: (value) => {
          onTipChange(value);
          setTip(value);
        },
        onPaymentMethodChange: (value) => {
          onPaymentMethodChange(value);
          setPaymentMethod(value);
        },
        onSubmitCheckout
      })} />;
    }
    render(<CheckoutHarness />);

    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Custom' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Custom' }), '4.25');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Payment Method' }), 'cash');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment' }));

    expect(onTipChange).toHaveBeenLastCalledWith('4.25');
    expect(onPaymentMethodChange).toHaveBeenCalledWith('cash');
    expect(onSubmitCheckout).toHaveBeenCalledOnce();
  });

  it('disables payment submission while checkout is processing', () => {
    render(<CheckoutModal {...createCheckoutProps({ isCheckingOut: true })} />);

    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
  });

  it('supports split selection and amount distribution commands', async () => {
    const splitBills = [
      { id: 'split-1', label: 'Split 1', itemIds: ['oi1'] },
      { id: 'split-2', label: 'Split 2', itemIds: [], amountCents: 600 }
    ];
    const onActiveSplitBillChange = vi.fn();
    const onSplitItemClick = vi.fn();
    const onDistributeSplitBills = vi.fn();
    const onApplyActiveSplitBill = vi.fn();
    render(<CheckoutModal {...createCheckoutProps({
      isSplitBillOpen: true,
      splitBills,
      activeSplitBill: splitBills[0],
      activeSplitBillId: 'split-1',
      unpaidItems: [orderItem],
      selectedItemIds: ['oi1'],
      onActiveSplitBillChange,
      onSplitItemClick,
      onDistributeSplitBills,
      onApplyActiveSplitBill
    })} />);

    await userEvent.click(screen.getByRole('button', { name: /Split 2/ }));
    await userEvent.click(screen.getByRole('button', { name: /Fried Rice/ }));
    await userEvent.click(screen.getByRole('button', { name: 'By Amount' }));
    await userEvent.click(screen.getByRole('button', { name: 'Use Selected Split' }));

    expect(onActiveSplitBillChange).toHaveBeenCalledWith('split-2');
    expect(onSplitItemClick).toHaveBeenCalledWith('oi1');
    expect(onDistributeSplitBills).toHaveBeenCalledWith('amount');
    expect(onApplyActiveSplitBill).toHaveBeenCalledOnce();
  });
});

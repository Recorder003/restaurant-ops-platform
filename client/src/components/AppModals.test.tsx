import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppModals } from './AppModals';
import type { useCheckoutFlow } from '../hooks/useCheckoutFlow';
import type { useOrderDocuments } from '../hooks/useOrderDocuments';
import { createOrder, createOrderItem, createRestaurantTable } from '../test/factories';

const table = createRestaurantTable();
const orderItem = createOrderItem();
const order = createOrder({ items: [orderItem] });

describe('AppModals', () => {
  it('renders document and table picker modals from app state', async () => {
    const closeHistory = vi.fn();
    const closeReceipt = vi.fn();
    const onTableSelect = vi.fn();
    const onCloseTablePicker = vi.fn();

    render(<AppModals
      documents={mockDocuments({ historyOrder: order, receiptOrder: order, closeHistory, closeReceipt })}
      checkout={mockCheckout()}
      isTablePickerOpen
      tables={[table]}
      tableNumber=""
      selectedTable={undefined}
      onTableSelect={onTableSelect}
      onCloseTablePicker={onCloseTablePicker}
    />);

    expect(screen.getByRole('dialog', { name: /Order history/ })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Choose table' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Receipt/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /T1/ }));
    expect(onTableSelect).toHaveBeenCalledWith(table);

    await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
    expect(closeHistory).toHaveBeenCalled();
  });

  it('renders checkout and forwards checkout commands', async () => {
    const handleTipPreset = vi.fn();
    const closeCheckout = vi.fn();

    render(<AppModals
      documents={mockDocuments()}
      checkout={mockCheckout({ checkoutTarget: order, handleTipPreset, closeCheckout })}
      isTablePickerOpen={false}
      tables={[]}
      tableNumber=""
      selectedTable={undefined}
      onTableSelect={vi.fn()}
      onCloseTablePicker={vi.fn()}
    />);

    expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '10%' }));
    expect(handleTipPreset).toHaveBeenCalledWith(10);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(closeCheckout).toHaveBeenCalled();
  });
});

function mockDocuments(overrides: Partial<ReturnType<typeof useOrderDocuments>> = {}) {
  const noop = vi.fn();
  return {
    historyOrder: null,
    receiptOrder: null,
    orderEvents: [],
    isLoadingEvents: false,
    openHistory: noop,
    closeHistory: noop,
    openReceipt: noop,
    closeReceipt: noop,
    printReceipt: noop,
    resetDocuments: noop,
    ...overrides
  } as unknown as ReturnType<typeof useOrderDocuments>;
}

function mockCheckout(overrides: Partial<ReturnType<typeof useCheckoutFlow>> = {}) {
  const noop = vi.fn();
  return {
    checkoutTarget: null,
    checkoutPaymentMethod: 'card',
    checkoutTip: '0.00',
    checkoutTipPreset: 'custom',
    checkoutSelectedItemIds: [],
    isSplitBillOpen: false,
    splitBills: [],
    activeSplitBill: undefined,
    activeSplitBillId: null,
    activeSplitLabel: 'Full unpaid bill',
    isActiveAmountSplit: false,
    checkoutUnpaidItems: [orderItem],
    checkoutSubtotalCents: 1200,
    checkoutTaxCents: 103,
    checkoutTipCents: 0,
    checkoutTotalCents: 1303,
    setCheckoutPaymentMethod: noop,
    setActiveSplitBillId: noop,
    setIsSplitBillOpen: noop,
    openCheckout: noop,
    closeCheckout: noop,
    resetCheckoutState: noop,
    handleTipPreset: noop,
    handleTipChange: noop,
    handleOpenSplitBill: noop,
    handleAddSplitBill: noop,
    handleRemoveActiveSplitBill: noop,
    handleSplitItemClick: noop,
    handleSelectAllForActiveSplit: noop,
    handleClearActiveSplit: noop,
    handleMergeSplitBills: noop,
    handleDistributeSplitBills: noop,
    handleApplyActiveSplitBill: noop,
    isCheckingOut: false,
    handleCheckoutSubmit: noop,
    ...overrides
  } as unknown as ReturnType<typeof useCheckoutFlow>;
}

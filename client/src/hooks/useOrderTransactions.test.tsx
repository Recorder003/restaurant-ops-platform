import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCheckoutFlow } from './useCheckoutFlow';
import { useOrderDocuments } from './useOrderDocuments';
import { createOrder } from '../test/factories';
import type { Order, OrderItem } from '../types';

const api = vi.hoisted(() => ({ checkoutOrder: vi.fn(), fetchOrderEvents: vi.fn() }));
vi.mock('../api', () => api);

const order = createOrder({
  id: 'o1',
  status: 'served',
  items: [createOrderItem('i1', 'Noodles', 1200)]
});

describe('order transaction hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits checkout and publishes the updated order', async () => {
    const paidOrder = { ...order, paymentStatus: 'paid' as const };
    api.checkoutOrder.mockResolvedValue(paidOrder);
    const onOrderUpdated = vi.fn();
    const { result } = renderHook(() => useCheckoutFlow({ taxRate: 0.086, onError: vi.fn(), onOrderUpdated }));

    act(() => result.current.openCheckout(order));
    await act(async () => result.current.handleCheckoutSubmit(formEvent()));

    expect(api.checkoutOrder).toHaveBeenCalledWith('o1', expect.objectContaining({ subtotalCents: 1200, taxCents: 103 }));
    expect(onOrderUpdated).toHaveBeenCalledWith(paidOrder);
    expect(result.current.checkoutTarget).toBeNull();
  });

  it('updates tip presets from the selected checkout subtotal', () => {
    const { result } = renderHook(() => useCheckoutFlow({ taxRate: 0.086, onError: vi.fn(), onOrderUpdated: vi.fn() }));

    act(() => result.current.openCheckout(order));
    act(() => result.current.handleTipPreset(20));

    expect(result.current.checkoutTipPreset).toBe(20);
    expect(result.current.checkoutTip).toBe('2.40');
    expect(result.current.checkoutTotalCents).toBe(1543);
  });

  it('continues through saved item split payments until the order is paid', async () => {
    const multiItemOrder = withItems([
      createOrderItem('i1', 'Noodles', 1200),
      createOrderItem('i2', 'Tea', 480),
      createOrderItem('i3', 'Broccoli', 880)
    ]);
    const afterFirstPayment = {
      ...multiItemOrder,
      paymentStatus: 'partially_paid' as const,
      items: [
        { ...multiItemOrder.items[0], paymentId: 'p1' },
        multiItemOrder.items[1],
        { ...multiItemOrder.items[2], paymentId: 'p1' }
      ]
    };
    const paidOrder = {
      ...afterFirstPayment,
      paymentStatus: 'paid' as const,
      items: afterFirstPayment.items.map((item) => ({ ...item, paymentId: item.paymentId ?? 'p2' }))
    };
    api.checkoutOrder.mockResolvedValueOnce(afterFirstPayment).mockResolvedValueOnce(paidOrder);
    const onOrderUpdated = vi.fn();
    const { result } = renderHook(() => useCheckoutFlow({ taxRate: 0.086, onError: vi.fn(), onOrderUpdated }));

    act(() => result.current.openCheckout(multiItemOrder));
    act(() => result.current.handleOpenSplitBill());
    act(() => result.current.handleDistributeSplitBills('items'));
    act(() => result.current.handleApplyActiveSplitBill());

    expect(result.current.activeSplitLabel).toBe('Split 1');
    expect(result.current.checkoutSelectedItemIds).toEqual(['i1', 'i3']);

    await act(async () => result.current.handleCheckoutSubmit(formEvent()));

    expect(api.checkoutOrder).toHaveBeenNthCalledWith(1, 'o1', expect.objectContaining({
      orderItemIds: ['i1', 'i3'],
      subtotalCents: 2080
    }));
    expect(result.current.activeSplitLabel).toBe('Split 2');
    expect(result.current.checkoutSelectedItemIds).toEqual(['i2']);

    await act(async () => result.current.handleCheckoutSubmit(formEvent()));

    expect(api.checkoutOrder).toHaveBeenNthCalledWith(2, 'o1', expect.objectContaining({
      orderItemIds: ['i2'],
      subtotalCents: 480
    }));
    expect(onOrderUpdated).toHaveBeenCalledTimes(2);
    expect(result.current.checkoutTarget).toBeNull();
  });

  it('submits equal amount splits without item ids', async () => {
    const multiItemOrder = withItems([
      createOrderItem('i1', 'Noodles', 1200),
      createOrderItem('i2', 'Tea', 480),
      createOrderItem('i3', 'Broccoli', 880)
    ]);
    const afterAmountPayment = { ...multiItemOrder, paymentStatus: 'partially_paid' as const };
    api.checkoutOrder.mockResolvedValue(afterAmountPayment);
    const { result } = renderHook(() => useCheckoutFlow({ taxRate: 0.086, onError: vi.fn(), onOrderUpdated: vi.fn() }));

    act(() => result.current.openCheckout(multiItemOrder));
    act(() => result.current.handleOpenSplitBill());
    act(() => result.current.handleDistributeSplitBills('amount'));
    act(() => result.current.handleApplyActiveSplitBill());

    expect(result.current.isActiveAmountSplit).toBe(true);
    expect(result.current.checkoutSubtotalCents).toBe(1280);

    await act(async () => result.current.handleCheckoutSubmit(formEvent()));

    expect(api.checkoutOrder).toHaveBeenCalledWith('o1', expect.not.objectContaining({ orderItemIds: expect.anything() }));
    expect(api.checkoutOrder).toHaveBeenCalledWith('o1', expect.objectContaining({
      subtotalCents: 1280,
      taxCents: 110,
      totalCents: 1390
    }));
  });

  it('validates empty manual split payments before applying checkout selection', () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useCheckoutFlow({ taxRate: 0.086, onError, onOrderUpdated: vi.fn() }));

    act(() => result.current.openCheckout(order));
    act(() => result.current.handleOpenSplitBill());
    act(() => result.current.handleClearActiveSplit());
    act(() => result.current.handleApplyActiveSplitBill());

    expect(onError).toHaveBeenCalledWith('Please add at least one item to this split bill');
    expect(result.current.checkoutSelectedItemIds).toEqual(['i1']);
  });

  it('loads order history independently from the application shell', async () => {
    api.fetchOrderEvents.mockResolvedValue([{ id: 'e1' }]);
    const { result } = renderHook(() => useOrderDocuments(vi.fn()));

    await act(async () => result.current.openHistory(order));
    await waitFor(() => expect(result.current.isLoadingEvents).toBe(false));

    expect(api.fetchOrderEvents).toHaveBeenCalledWith('o1');
    expect(result.current.historyOrder).toEqual(order);
    expect(result.current.orderEvents).toEqual([{ id: 'e1' }]);
  });

  it('surfaces history load failures and stops the loading state', async () => {
    api.fetchOrderEvents.mockRejectedValue(new Error('History unavailable'));
    const onError = vi.fn();
    const { result } = renderHook(() => useOrderDocuments(onError));

    await act(async () => result.current.openHistory(order));
    await waitFor(() => expect(result.current.isLoadingEvents).toBe(false));

    expect(result.current.historyOrder).toEqual(order);
    expect(result.current.orderEvents).toEqual([]);
    expect(onError).toHaveBeenCalledWith('History unavailable');
  });

  it('opens, closes, prints, and resets receipt/history documents', () => {
    vi.useFakeTimers();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { result } = renderHook(() => useOrderDocuments(vi.fn()));

    act(() => {
      result.current.openReceipt(order);
      result.current.printReceipt();
    });

    expect(result.current.receiptOrder).toEqual(order);
    expect(print).toHaveBeenCalledOnce();
    expect(document.body.classList.contains('printing-receipt')).toBe(true);

    act(() => vi.runOnlyPendingTimers());
    expect(document.body.classList.contains('printing-receipt')).toBe(false);

    act(() => result.current.closeReceipt());
    expect(result.current.receiptOrder).toBeNull();

    act(() => {
      result.current.openReceipt(order);
      result.current.resetDocuments();
    });

    expect(result.current.receiptOrder).toBeNull();
    expect(result.current.historyOrder).toBeNull();
    expect(result.current.orderEvents).toEqual([]);

    print.mockRestore();
    vi.useRealTimers();
  });
});

function createOrderItem(id: string, name: string, priceCents: number): OrderItem {
  return {
    id, menuItemId: `m-${id}`, menuItemVariantId: `v-${id}`, menuItemName: name,
    menuItemCategory: 'Entrees', variantName: 'Regular', bundleId: null, bundleName: null,
    quantity: 1, priceCents, status: 'served', preparedAt: null, servedAt: null,
    isKitchenItem: true, paymentId: null
  };
}

function withItems(items: OrderItem[]): Order {
  return { ...order, items, totalCents: items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0) };
}

function formEvent() {
  return { preventDefault: vi.fn() } as never;
}

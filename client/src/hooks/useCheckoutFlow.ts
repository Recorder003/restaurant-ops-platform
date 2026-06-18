import { useEffect, useMemo, useState } from 'react';
import { centsToDollarsInput, dollarsToCents } from '../utils/formatters';
import {
  arraysHaveSameItems,
  createInitialSplitBills,
  getNextPayableSplitBill,
  normalizeSplitBillsForUnpaidItems
} from '../utils/splitBillUtils';
import type { Order, PaymentMethod, SplitBill } from '../types';

type CheckoutFlowInput = {
  taxRate: number;
  onError: (message: string | null) => void;
};

export function useCheckoutFlow({ taxRate, onError }: CheckoutFlowInput) {
  const [checkoutTarget, setCheckoutTarget] = useState<Order | null>(null);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<PaymentMethod>('card');
  const [checkoutTip, setCheckoutTip] = useState('0.00');
  const [checkoutTipPreset, setCheckoutTipPreset] = useState<number | 'custom'>('custom');
  const [checkoutSelectedItemIds, setCheckoutSelectedItemIds] = useState<string[]>([]);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [splitBills, setSplitBills] = useState<SplitBill[]>([]);
  const [activeSplitBillId, setActiveSplitBillId] = useState<string | null>(null);
  const [splitPlansByOrderId, setSplitPlansByOrderId] = useState<Record<string, SplitBill[]>>({});

  const checkoutUnpaidItems = useMemo(() => {
    return checkoutTarget?.items.filter((item) => !item.paymentId) ?? [];
  }, [checkoutTarget]);
  const activeSplitBill = splitBills.find((splitBill) => splitBill.id === activeSplitBillId) ?? splitBills[0];
  const isActiveAmountSplit = activeSplitBill?.amountCents !== undefined && checkoutSelectedItemIds.length === 0;
  const activeSplitLabel = activeSplitBill && arraysHaveSameItems(checkoutSelectedItemIds, activeSplitBill.itemIds)
    ? activeSplitBill.label
    : isActiveAmountSplit
      ? activeSplitBill.label
      : checkoutSelectedItemIds.length === checkoutUnpaidItems.length
        ? 'Full unpaid bill'
        : 'Selected split';
  const checkoutSubtotalCents = useMemo(() => {
    if (activeSplitBill?.amountCents !== undefined && checkoutSelectedItemIds.length === 0) {
      return activeSplitBill.amountCents;
    }

    return checkoutUnpaidItems
      .filter((item) => checkoutSelectedItemIds.includes(item.id))
      .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  }, [activeSplitBill, checkoutSelectedItemIds, checkoutUnpaidItems]);
  const checkoutTaxCents = Math.round(checkoutSubtotalCents * taxRate);
  const checkoutTipCents = dollarsToCents(checkoutTip);
  const checkoutTotalCents = checkoutSubtotalCents + checkoutTaxCents + checkoutTipCents;

  useEffect(() => {
    if (checkoutTipPreset === 'custom') {
      return;
    }

    setCheckoutTip(centsToDollarsInput(Math.round(checkoutSubtotalCents * (checkoutTipPreset / 100))));
  }, [checkoutSubtotalCents, checkoutTipPreset]);

  function openCheckout(order: Order) {
    const unpaidItemIds = order.items.filter((item) => !item.paymentId).map((item) => item.id);
    const savedPlan = splitPlansByOrderId[order.id];
    const usablePlan = savedPlan
      ? normalizeSplitBillsForUnpaidItems(savedPlan, unpaidItemIds)
      : createInitialSplitBills(unpaidItemIds);
    const firstBill = usablePlan.find((splitBill) => splitBill.itemIds.length > 0) ?? usablePlan[0];

    setCheckoutTarget(order);
    setCheckoutSelectedItemIds(firstBill?.itemIds ?? unpaidItemIds);
    setSplitBills(usablePlan);
    setActiveSplitBillId(firstBill?.id ?? null);
    setIsSplitBillOpen(false);
    setCheckoutPaymentMethod('card');
    setCheckoutTip('0.00');
    setCheckoutTipPreset('custom');
    saveSplitPlan(order.id, usablePlan);
    onError(null);
  }

  function closeCheckout() {
    setCheckoutTarget(null);
    setCheckoutSelectedItemIds([]);
    setIsSplitBillOpen(false);
  }

  function resetSplitBills() {
    setIsSplitBillOpen(false);
    setSplitBills([]);
    setActiveSplitBillId(null);
  }

  function resetCheckoutState() {
    setCheckoutTarget(null);
    setCheckoutSelectedItemIds([]);
    resetSplitBills();
    setSplitPlansByOrderId({});
  }

  function handleTipPreset(percent: number) {
    if (!checkoutTarget) {
      return;
    }

    setCheckoutTip(centsToDollarsInput(Math.round(checkoutSubtotalCents * (percent / 100))));
    setCheckoutTipPreset(percent);
  }

  function handleTipChange(value: string) {
    setCheckoutTip(value);
    setCheckoutTipPreset('custom');
  }

  function handleOpenSplitBill() {
    if (!checkoutTarget) {
      return;
    }

    const unpaidItemIds = checkoutUnpaidItems.map((item) => item.id);
    const savedPlan = splitPlansByOrderId[checkoutTarget.id];
    const nextBills = splitBills.length > 0
      ? normalizeSplitBillsForUnpaidItems(splitBills, unpaidItemIds)
      : savedPlan
        ? normalizeSplitBillsForUnpaidItems(savedPlan, unpaidItemIds)
        : createInitialSplitBills(unpaidItemIds);
    setSplitBills(nextBills);
    setActiveSplitBillId(activeSplitBillId ?? nextBills[0]?.id ?? null);
    saveSplitPlan(checkoutTarget.id, nextBills);
    setIsSplitBillOpen(true);
  }

  function updateSplitBills(next: SplitBill[] | ((current: SplitBill[]) => SplitBill[])) {
    setSplitBills((current) => {
      const nextBills = typeof next === 'function' ? next(current) : next;

      if (checkoutTarget) {
        saveSplitPlan(checkoutTarget.id, nextBills);
      }

      return nextBills;
    });
  }

  function saveSplitPlan(orderId: string, nextBills: SplitBill[]) {
    setSplitPlansByOrderId((current) => ({
      ...current,
      [orderId]: nextBills
    }));
  }

  function handleAddSplitBill() {
    updateSplitBills((current) => {
      const nextIndex = current.length + 1;
      const nextBill = {
        id: `split-${Date.now()}`,
        label: `Split ${nextIndex}`,
        itemIds: []
      };
      setActiveSplitBillId(nextBill.id);
      return [...current, nextBill];
    });
  }

  function handleRemoveActiveSplitBill() {
    if (!activeSplitBill || splitBills.length <= 1) {
      return;
    }

    updateSplitBills((current) => {
      const next = current.filter((splitBill) => splitBill.id !== activeSplitBill.id);
      setActiveSplitBillId(next[0]?.id ?? null);
      return next;
    });
  }

  function handleSplitItemClick(itemId: string) {
    if (!activeSplitBillId) {
      return;
    }

    updateSplitBills((current) => current.map((splitBill) => {
      const hasItem = splitBill.itemIds.includes(itemId);

      if (splitBill.id === activeSplitBillId) {
        return {
          ...splitBill,
          amountCents: undefined,
          itemIds: hasItem ? splitBill.itemIds.filter((candidate) => candidate !== itemId) : [...splitBill.itemIds, itemId]
        };
      }

      return {
        ...splitBill,
        itemIds: splitBill.itemIds.filter((candidate) => candidate !== itemId)
      };
    }));
  }

  function handleSelectAllForActiveSplit() {
    if (!activeSplitBillId) {
      return;
    }

    const unpaidItemIds = checkoutUnpaidItems.map((item) => item.id);
    updateSplitBills((current) => current.map((splitBill) => (
      splitBill.id === activeSplitBillId
        ? { ...splitBill, amountCents: undefined, itemIds: unpaidItemIds }
        : { ...splitBill, amountCents: undefined, itemIds: [] }
    )));
  }

  function handleClearActiveSplit() {
    if (!activeSplitBillId) {
      return;
    }

    updateSplitBills((current) => current.map((splitBill) => (
      splitBill.id === activeSplitBillId ? { ...splitBill, amountCents: undefined, itemIds: [] } : splitBill
    )));
  }

  function handleMergeSplitBills() {
    const unpaidItemIds = checkoutUnpaidItems.map((item) => item.id);
    const nextBills = createInitialSplitBills(unpaidItemIds);
    updateSplitBills(nextBills);
    setActiveSplitBillId(nextBills[0].id);
  }

  function handleDistributeSplitBills(mode: 'items' | 'amount' | 'seats') {
    if (!checkoutTarget) {
      return;
    }

    const count = mode === 'seats'
      ? Math.max(2, Math.min(Number(checkoutTarget.partySize ?? 2), checkoutUnpaidItems.length || 2))
      : Math.max(2, splitBills.length);
    const nextBills: SplitBill[] = Array.from({ length: count }, (_, index) => ({
      id: `split-${index + 1}`,
      label: `Split ${index + 1}`,
      itemIds: [] as string[]
    }));

    if (mode === 'amount') {
      const unpaidSubtotalCents = checkoutUnpaidItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
      const baseAmountCents = Math.floor(unpaidSubtotalCents / count);
      const remainderCents = unpaidSubtotalCents % count;

      nextBills.forEach((splitBill, index) => {
        splitBill.amountCents = baseAmountCents + (index < remainderCents ? 1 : 0);
      });
    } else {
      checkoutUnpaidItems.forEach((item, index) => {
        nextBills[index % nextBills.length].itemIds.push(item.id);
      });
    }

    updateSplitBills(nextBills);
    setActiveSplitBillId(nextBills[0]?.id ?? null);
  }

  function handleApplyActiveSplitBill() {
    if (!activeSplitBill || (activeSplitBill.itemIds.length === 0 && activeSplitBill.amountCents === undefined)) {
      onError('Please add at least one item to this split bill');
      return;
    }

    setCheckoutSelectedItemIds(activeSplitBill.itemIds);
    setCheckoutTip('0.00');
    setCheckoutTipPreset('custom');
    setIsSplitBillOpen(false);
    onError(null);
  }

  function resetTip() {
    setCheckoutTip('0.00');
    setCheckoutTipPreset('custom');
  }

  function completePaidCheckout(orderId: string) {
    setCheckoutTarget(null);
    setCheckoutSelectedItemIds([]);
    resetSplitBills();
    setSplitPlansByOrderId((current) => {
      const { [orderId]: _removed, ...rest } = current;
      return rest;
    });
  }

  function continueSplitCheckout(updatedOrder: Order) {
    const remainingUnpaidIds = updatedOrder.items.filter((item) => !item.paymentId).map((item) => item.id);
    const nextBills = isActiveAmountSplit
      ? splitBills.filter((splitBill) => splitBill.id !== activeSplitBill?.id)
      : normalizeSplitBillsForUnpaidItems(splitBills, remainingUnpaidIds);
    const nextBill = getNextPayableSplitBill(nextBills, checkoutSelectedItemIds);

    setCheckoutTarget(updatedOrder);
    setSplitBills(nextBills);
    setActiveSplitBillId(nextBill?.id ?? null);
    setCheckoutSelectedItemIds(nextBill?.amountCents !== undefined ? [] : nextBill?.itemIds ?? remainingUnpaidIds);
    saveSplitPlan(updatedOrder.id, nextBills);
  }

  return {
    checkoutTarget,
    checkoutPaymentMethod,
    checkoutTip,
    checkoutTipPreset,
    checkoutSelectedItemIds,
    isSplitBillOpen,
    splitBills,
    activeSplitBill,
    activeSplitBillId,
    activeSplitLabel,
    isActiveAmountSplit,
    checkoutUnpaidItems,
    checkoutSubtotalCents,
    checkoutTaxCents,
    checkoutTipCents,
    checkoutTotalCents,
    setCheckoutPaymentMethod,
    setActiveSplitBillId,
    setIsSplitBillOpen,
    openCheckout,
    closeCheckout,
    resetCheckoutState,
    handleTipPreset,
    handleTipChange,
    handleOpenSplitBill,
    handleAddSplitBill,
    handleRemoveActiveSplitBill,
    handleSplitItemClick,
    handleSelectAllForActiveSplit,
    handleClearActiveSplit,
    handleMergeSplitBills,
    handleDistributeSplitBills,
    handleApplyActiveSplitBill,
    resetTip,
    completePaidCheckout,
    continueSplitCheckout
  };
}

import type { OrderItem, SplitBill } from '../types';

export function createInitialSplitBills(itemIds: string[]): SplitBill[] {
  return [
    {
      id: 'split-1',
      label: 'Split 1',
      itemIds
    }
  ];
}

export function normalizeSplitBillsForUnpaidItems(splitBills: SplitBill[], unpaidItemIds: string[]): SplitBill[] {
  const unpaidSet = new Set(unpaidItemIds);
  const normalized = splitBills
    .map((splitBill, index) => ({
      ...splitBill,
      label: splitBill.label || `Split ${index + 1}`,
      itemIds: splitBill.itemIds.filter((itemId) => unpaidSet.has(itemId))
    }))
    .filter(isPayableSplitBill);
  const assignedIds = new Set(normalized.flatMap((splitBill) => splitBill.itemIds));
  const unassignedIds = unpaidItemIds.filter((itemId) => !assignedIds.has(itemId));

  if (normalized.length === 0) {
    return createInitialSplitBills(unpaidItemIds);
  }

  if (normalized.some((splitBill) => splitBill.amountCents !== undefined)) {
    return normalized;
  }

  if (unassignedIds.length > 0) {
    const nextSplitNumber = getNextSplitBillNumber(normalized);
    normalized.push({
      id: `split-${nextSplitNumber}`,
      label: `Split ${nextSplitNumber}`,
      itemIds: unassignedIds
    });
  }

  return normalized;
}

export function getNextSplitBillNumber(splitBills: SplitBill[]) {
  const usedNumbers = splitBills
    .map((splitBill) => splitBill.label.match(/\d+/)?.[0])
    .filter((value): value is string => Boolean(value))
    .map(Number);

  return usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : splitBills.length + 1;
}

export function getNextPayableSplitBill(splitBills: SplitBill[], paidItemIds: string[]) {
  return splitBills.find((splitBill) => isPayableSplitBill(splitBill) && !arraysHaveSameItems(splitBill.itemIds, paidItemIds))
    ?? splitBills.find(isPayableSplitBill);
}

export function isPayableSplitBill(splitBill: SplitBill) {
  return splitBill.itemIds.length > 0 || splitBill.amountCents !== undefined;
}

export function arraysHaveSameItems(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

export function getSplitBillSubtotal(splitBill: SplitBill, items: OrderItem[]) {
  if (splitBill.amountCents !== undefined) {
    return splitBill.amountCents;
  }

  return items
    .filter((item) => splitBill.itemIds.includes(item.id))
    .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

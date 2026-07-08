import { useState } from 'react';
import { fetchOrderEvents } from '../api';
import type { Order, OrderEvent } from '../types';

export function useOrderDocuments(onError: (message: string | null) => void) {
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [orderEvents, setOrderEvents] = useState<OrderEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  async function openHistory(order: Order) {
    try {
      setHistoryOrder(order);
      setIsLoadingEvents(true);
      setOrderEvents(await fetchOrderEvents(order.id));
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to load order history');
    } finally {
      setIsLoadingEvents(false);
    }
  }

  function printReceipt() {
    document.body.classList.add('printing-receipt');
    window.print();
    window.setTimeout(() => document.body.classList.remove('printing-receipt'), 0);
  }

  function resetDocuments() {
    setHistoryOrder(null);
    setReceiptOrder(null);
    setOrderEvents([]);
  }

  return {
    historyOrder, receiptOrder, orderEvents, isLoadingEvents,
    openHistory, closeHistory: () => setHistoryOrder(null),
    openReceipt: setReceiptOrder, closeReceipt: () => setReceiptOrder(null),
    printReceipt, resetDocuments
  };
}

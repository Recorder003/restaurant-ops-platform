import type { FulfillmentType, Order, OrderItem, OrderSource } from '../types';

type ReceiptModalProps = {
  order: Order;
  orderSourceLabels: Record<OrderSource, string>;
  fulfillmentLabels: Record<FulfillmentType, string>;
  formatMoney: (cents: number) => string;
  formatOrderItemName: (item: OrderItem) => string;
  formatDateTime: (value: string) => string;
  getOrderTitle: (order: Order) => string;
  onPrint: () => void;
  onClose: () => void;
};

export function ReceiptModal({
  order,
  orderSourceLabels,
  fulfillmentLabels,
  formatMoney,
  formatOrderItemName,
  formatDateTime,
  getOrderTitle,
  onPrint,
  onClose
}: ReceiptModalProps) {
  return (
    <div className="modal-backdrop">
      <section className="history-modal receipt-modal" role="dialog" aria-modal="true" aria-label="Receipt preview">
        <div className="panel-heading no-print">
          <div>
            <h2>Receipt</h2>
            <span>{getOrderTitle(order)}</span>
          </div>
          <div className="modal-actions">
            <button className="primary-button" onClick={onPrint}>
              Print
            </button>
            <button className="ghost-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <article className="receipt-print-area">
          <div className="receipt-header">
            <h2>Restaurant Ops</h2>
            <span>Order Receipt</span>
          </div>

          <div className="receipt-meta">
            <span>Order</span><strong>{order.id.slice(0, 8).toUpperCase()}</strong>
            <span>Type</span><strong>{orderSourceLabels[order.orderSource]} / {fulfillmentLabels[order.fulfillmentType]}</strong>
            <span>{order.orderSource === 'phone' ? 'Phone' : 'Table'}</span><strong>{order.orderSource === 'phone' ? order.phoneNumber : order.tableNumber ?? '-'}</strong>
            <span>Server</span><strong>{order.serverName}</strong>
            <span>Date</span><strong>{formatDateTime(order.createdAt)}</strong>
          </div>

          <ul className="receipt-items">
            {order.items.map((item) => (
              <li key={item.id}>
                <span>{formatOrderItemName(item)}{item.paymentId ? ' / Paid' : ''}</span>
                <strong>{formatMoney(item.priceCents * item.quantity)}</strong>
              </li>
            ))}
          </ul>

          {order.notes && <p className="receipt-notes">{order.notes}</p>}

          <div className="receipt-totals">
            <span>Subtotal</span><strong>{formatMoney(order.paymentSubtotalCents ?? order.totalCents)}</strong>
            <span>Tax</span><strong>{formatMoney(order.paymentTaxCents ?? 0)}</strong>
            <span>Tip</span><strong>{formatMoney(order.paymentTipCents ?? 0)}</strong>
            <span>Total</span><strong>{formatMoney(order.paymentTotalCents ?? order.totalCents)}</strong>
          </div>

          {order.payments.length > 0 && (
            <div className="receipt-payments-list">
              <strong>Payments</strong>
              {order.payments.map((payment, index) => (
                <div key={payment.id}>
                  <span>Payment {index + 1} / {payment.paymentMethod}</span>
                  <strong>{formatMoney(payment.totalCents)}</strong>
                </div>
              ))}
            </div>
          )}

          <div className="receipt-payment">
            <span className={`payment-status ${order.paymentStatus}`}>{order.paymentStatus}</span>
            {order.paymentMethod && <span>{order.paymentMethod}</span>}
            {order.paidAt && <span>{formatDateTime(order.paidAt)}</span>}
          </div>
        </article>
      </section>
    </div>
  );
}

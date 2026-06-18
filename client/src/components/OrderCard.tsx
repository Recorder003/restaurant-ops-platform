import type { Order, OrderItem, OrderItemStatus, OrderStatus, UserRole } from '../types';
import {
  canCancelOrder,
  canCheckoutOrder,
  canEditOrder,
  getAllowedNextItemStatus,
  getAllowedNextStatus,
  getItemActionLabel,
  getVisibleOrderItems,
  itemStatusLabels,
  statusLabels
} from '../utils/orderRules';

const orderSourceLabels = {
  in_person: 'In-person',
  phone: 'Phone'
};

const fulfillmentLabels = {
  dine_in: 'Dine-in',
  to_go: 'To-go',
  pickup: 'Pickup',
  delivery: 'Delivery'
};

type OrderCardProps = {
  order: Order;
  role: UserRole;
  processingOrderActionId: string | null;
  processingItemActionId: string | null;
  formatMoney: (cents: number) => string;
  formatOrderItemName: (item: OrderItem) => string;
  getOrderTitle: (order: Order) => string;
  onReceipt: (order: Order) => void;
  onHistory: (order: Order) => void;
  onEdit: (order: Order) => void;
  onOrderStatusChange: (order: Order, status: OrderStatus) => void;
  onItemStatusChange: (order: Order, item: OrderItem, status: OrderItemStatus) => void;
  onCheckout: (order: Order) => void;
};

export function OrderCard({
  order,
  role,
  processingOrderActionId,
  processingItemActionId,
  formatMoney,
  formatOrderItemName,
  getOrderTitle,
  onReceipt,
  onHistory,
  onEdit,
  onOrderStatusChange,
  onItemStatusChange,
  onCheckout
}: OrderCardProps) {
  const nextOrderStatus = getAllowedNextStatus(order.status, role);

  return (
    <article className="order-card">
      <div className="order-card-header">
        <div>
          <strong>{getOrderTitle(order)}</strong>
          <span>{orderSourceLabels[order.orderSource]} / {fulfillmentLabels[order.fulfillmentType]}</span>
          <span>{order.serverName}</span>
        </div>
        <div className="status-stack">
          <span className={`status ${order.status}`}>{statusLabels[order.status]}</span>
          <span className={`payment-status ${order.paymentStatus}`}>{order.paymentStatus}</span>
        </div>
      </div>

      <ul>
        {getVisibleOrderItems(order, role).map((item) => {
          const nextItemStatus = getAllowedNextItemStatus(item, role);

          return (
            <li key={item.id} className="order-item-row">
              <div>
                <span>{formatOrderItemName(item)}</span>
                <small>{formatMoney(item.priceCents * item.quantity)}{item.paymentId ? ' / Paid' : ''}</small>
              </div>
              <div className="order-item-controls">
                <span className={`status ${item.status}`}>{itemStatusLabels[item.status]}</span>
                {nextItemStatus && (
                  <button
                    disabled={processingItemActionId === `${item.id}:${nextItemStatus}`}
                    onClick={() => onItemStatusChange(order, item, nextItemStatus)}
                  >
                    {getItemActionLabel(item, role)}
                  </button>
                )}
                {!nextItemStatus && <span className="item-action-spacer" />}
              </div>
            </li>
          );
        })}
      </ul>

      {order.notes && <p className="notes">{order.notes}</p>}

      <div className="order-actions">
        <strong>{formatMoney(order.totalCents)}</strong>
        <div>
          <button onClick={() => onReceipt(order)}>
            Receipt
          </button>
          {role === 'admin' && (
            <button onClick={() => onHistory(order)}>
              History
            </button>
          )}
          {canEditOrder(order.status, role) && (
            <button onClick={() => onEdit(order)}>
              Edit
            </button>
          )}
          {nextOrderStatus && (
            <button
              disabled={processingOrderActionId === `${order.id}:${nextOrderStatus}`}
              onClick={() => onOrderStatusChange(order, nextOrderStatus)}
            >
              {getOrderActionLabel(order.status, role, nextOrderStatus)}
            </button>
          )}
          {canCancelOrder(order.status, role) && (
            <button
              className="danger-button"
              disabled={processingOrderActionId === `${order.id}:cancelled`}
              onClick={() => onOrderStatusChange(order, 'cancelled')}
            >
              Cancel
            </button>
          )}
          {canCheckoutOrder(order, role) && (
            <button className="primary-button" onClick={() => onCheckout(order)}>
              Checkout
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function getOrderActionLabel(status: OrderStatus, role: UserRole, nextStatus: OrderStatus) {
  if (role === 'chef' && status === 'pending') {
    return 'Start';
  }

  if (role === 'chef' && status === 'preparing') {
    return 'Mark Done';
  }

  return statusLabels[nextStatus];
}

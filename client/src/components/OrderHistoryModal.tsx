import type { Order, OrderEvent } from '../types';

type OrderHistoryModalProps = {
  order: Order;
  events: OrderEvent[];
  isLoading: boolean;
  getOrderTitle: (order: Order) => string;
  formatOrderEvent: (event: OrderEvent) => string;
  formatDateTime: (value: string) => string;
  onClose: () => void;
};

export function OrderHistoryModal({
  order,
  events,
  isLoading,
  getOrderTitle,
  formatOrderEvent,
  formatDateTime,
  onClose
}: OrderHistoryModalProps) {
  return (
    <div className="modal-backdrop">
      <section className="history-modal" role="dialog" aria-modal="true" aria-label="Order history">
        <div className="panel-heading">
          <div>
            <h2>Order History</h2>
            <span>{getOrderTitle(order)}</span>
          </div>
          <button className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        {isLoading ? (
          <div className="empty-state">Loading history...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">No history yet</div>
        ) : (
          <ol className="history-list">
            {events.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>{formatOrderEvent(event)}</strong>
                  <span>{event.actorName} / {event.actorRole}</span>
                </div>
                <time>{formatDateTime(event.createdAt)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

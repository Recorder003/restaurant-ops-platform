import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createOrder, fetchMenuItems, fetchOrders, updateOrderStatus } from './api';
import type { DraftItem, MenuItem, Order, OrderStatus } from './types';

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  cancelled: 'Cancelled'
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served'
};

function App() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [tableNumber, setTableNumber] = useState('');
  const [serverName, setServerName] = useState('');
  const [notes, setNotes] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      const [menu, orderList] = await Promise.all([fetchMenuItems(), fetchOrders()]);
      setMenuItems(menu);
      setOrders(orderList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  const categories = useMemo(() => {
    return Array.from(new Set(menuItems.map((item) => item.category)));
  }, [menuItems]);

  const draftItems: DraftItem[] = useMemo(() => {
    return Object.entries(selectedItems)
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
  }, [selectedItems]);

  const draftTotal = useMemo(() => {
    return draftItems.reduce((total, item) => {
      const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
      return total + (menuItem?.priceCents ?? 0) * item.quantity;
    }, 0);
  }, [draftItems, menuItems]);

  const filteredOrders = statusFilter === 'all'
    ? orders
    : orders.filter((order) => order.status === statusFilter);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draftItems.length === 0) {
      setError('Please select at least one menu item');
      return;
    }

    try {
      setIsSubmitting(true);
      const order = await createOrder({ tableNumber, serverName, notes, items: draftItems });
      setOrders((current) => [order, ...current]);
      setTableNumber('');
      setServerName('');
      setNotes('');
      setSelectedItems({});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    try {
      const updated = await updateOrderStatus(order.id, status);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Restaurant Ops</p>
            <h1>Restaurant Order Manager</h1>
          </div>
          <button className="ghost-button" onClick={loadData} disabled={isLoading}>
            Refresh
          </button>
        </header>

        {error && <div className="alert">{error}</div>}

        <div className="layout">
          <form className="panel order-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <h2>New Order</h2>
              <strong>{formatMoney(draftTotal)}</strong>
            </div>

            <label>
              Table
              <input value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} required />
            </label>

            <label>
              Server
              <input value={serverName} onChange={(event) => setServerName(event.target.value)} required />
            </label>

            <label>
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </label>

            <div className="menu-list">
              {categories.map((category) => (
                <div key={category} className="menu-category">
                  <h3>{category}</h3>
                  {menuItems
                    .filter((item) => item.category === category)
                    .map((item) => (
                      <div key={item.id} className="menu-row">
                        <div>
                          <strong>{item.name}</strong>
                          <span>{formatMoney(item.priceCents)}</span>
                        </div>
                        <input
                          aria-label={`${item.name} quantity`}
                          min="0"
                          type="number"
                          value={selectedItems[item.id] ?? 0}
                          onChange={(event) => {
                            const quantity = Number(event.target.value);
                            setSelectedItems((current) => ({ ...current, [item.id]: quantity }));
                          }}
                        />
                      </div>
                    ))}
                </div>
              ))}
            </div>

            <button className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Order'}
            </button>
          </form>

          <section className="orders-panel">
            <div className="panel-heading">
              <h2>Order Board</h2>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')}>
                <option value="all">All Statuses</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="metrics">
              <Metric label="Orders Today" value={orders.length.toString()} />
              <Metric label="In Progress" value={orders.filter((order) => ['pending', 'preparing', 'ready'].includes(order.status)).length.toString()} />
              <Metric label="Revenue" value={formatMoney(orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + order.totalCents, 0))} />
            </div>

            <div className="order-grid">
              {isLoading ? (
                <div className="empty-state">Loading orders...</div>
              ) : filteredOrders.length === 0 ? (
                <div className="empty-state">No orders yet</div>
              ) : (
                filteredOrders.map((order) => (
                  <article key={order.id} className="order-card">
                    <div className="order-card-header">
                      <div>
                        <strong>Table {order.tableNumber}</strong>
                        <span>{order.serverName}</span>
                      </div>
                      <span className={`status ${order.status}`}>{statusLabels[order.status]}</span>
                    </div>

                    <ul>
                      {order.items.map((item) => (
                        <li key={item.id}>
                          <span>{item.menuItemName} x {item.quantity}</span>
                          <span>{formatMoney(item.priceCents * item.quantity)}</span>
                        </li>
                      ))}
                    </ul>

                    {order.notes && <p className="notes">{order.notes}</p>}

                    <div className="order-actions">
                      <strong>{formatMoney(order.totalCents)}</strong>
                      <div>
                        {nextStatus[order.status] && (
                          <button onClick={() => handleStatusChange(order, nextStatus[order.status]!)}>
                            {statusLabels[nextStatus[order.status]!]}
                          </button>
                        )}
                        {order.status !== 'served' && order.status !== 'cancelled' && (
                          <button className="danger-button" onClick={() => handleStatusChange(order, 'cancelled')}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(cents / 100);
}

export default App;

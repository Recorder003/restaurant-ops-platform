import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  clearStoredToken,
  createMenuItem,
  createOrder,
  createStaffUser,
  deleteStaffUser,
  fetchAdminMenuItems,
  fetchCurrentUser,
  fetchMenuItems,
  fetchOrders,
  fetchStaffUsers,
  login,
  storeToken,
  updateMenuItem,
  updateStaffUser,
  updateOrderStatus
} from './api';
import type { DraftItem, MenuItem, Order, OrderStatus, User, UserRole } from './types';

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

const menuCategories = ['Entrees', 'Vegetables', 'Small Plates', 'Drinks', 'Desserts'];

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [adminMenuItems, setAdminMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [tableNumber, setTableNumber] = useState('');
  const [serverName, setServerName] = useState('');
  const [notes, setNotes] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('test@example.com');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('staff');
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('Entrees');
  const [newMenuPrice, setNewMenuPrice] = useState('12.00');
  const [newMenuAvailable, setNewMenuAvailable] = useState(true);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [isCreatingMenuItem, setIsCreatingMenuItem] = useState(false);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      setIsLoading(true);
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      await loadData(currentUser);
      setError(null);
    } catch {
      clearStoredToken();
      setUser(null);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadData(currentUser = user) {
    try {
      setIsLoading(true);
      const [menu, orderList, staffList, adminMenu] = await Promise.all([
        fetchMenuItems(),
        fetchOrders(),
        currentUser?.role === 'admin' ? fetchStaffUsers() : Promise.resolve([]),
        currentUser?.role === 'admin' ? fetchAdminMenuItems() : Promise.resolve([])
      ]);
      setMenuItems(menu);
      setOrders(orderList);
      setStaffUsers(staffList);
      setAdminMenuItems(adminMenu);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsLoggingIn(true);
      const session = await login({ email, password });
      storeToken(session.accessToken);
      setUser(session.user);
      await loadData(session.user);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log in');
    } finally {
      setIsLoggingIn(false);
    }
  }

  function handleLogout() {
    clearStoredToken();
    setUser(null);
    setOrders([]);
    setStaffUsers([]);
    setAdminMenuItems([]);
    setSelectedItems({});
    setError(null);
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

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsCreatingStaff(true);
      const created = await createStaffUser({
        name: newStaffName,
        email: newStaffEmail,
        password: newStaffPassword,
        role: newStaffRole
      });
      setStaffUsers((current) => [created, ...current]);
      setNewStaffName('');
      setNewStaffEmail('test@example.com');
      setNewStaffPassword('');
      setNewStaffRole('staff');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create staff user');
    } finally {
      setIsCreatingStaff(false);
    }
  }

  async function handleStaffRoleChange(staffUser: User, role: UserRole) {
    try {
      const updated = await updateStaffUser(staffUser.id, { role });
      setStaffUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff user');
    }
  }

  async function handleStaffActiveChange(staffUser: User, isActive: boolean) {
    try {
      const updated = await updateStaffUser(staffUser.id, { isActive });
      setStaffUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff user');
    }
  }

  async function handleDeleteStaff(staffUser: User) {
    const confirmed = window.confirm(`Delete ${staffUser.name}? This action cannot be undone.`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteStaffUser(staffUser.id);
      setStaffUsers((current) => current.filter((item) => item.id !== staffUser.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete staff user');
    }
  }

  async function handleCreateMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsCreatingMenuItem(true);
      const created = await createMenuItem({
        name: newMenuName,
        category: newMenuCategory,
        priceCents: dollarsToCents(newMenuPrice),
        isAvailable: newMenuAvailable
      });
      setAdminMenuItems((current) => [...current, created].sort(compareMenuItems));
      if (created.isAvailable) {
        setMenuItems((current) => [...current, created].sort(compareMenuItems));
      }
      setNewMenuName('');
      setNewMenuCategory('Entrees');
      setNewMenuPrice('12.00');
      setNewMenuAvailable(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create menu item');
    } finally {
      setIsCreatingMenuItem(false);
    }
  }

  async function handleMenuItemUpdate(menuItem: MenuItem, input: Partial<MenuItem>) {
    try {
      const updated = await updateMenuItem(menuItem.id, input);
      setAdminMenuItems((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(compareMenuItems));
      setMenuItems((current) => {
        const withoutUpdated = current.filter((item) => item.id !== updated.id);

        return updated.isAvailable
          ? [...withoutUpdated, updated].sort(compareMenuItems)
          : withoutUpdated;
      });
      setSelectedItems((current) => {
        if (updated.isAvailable) {
          return current;
        }

        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update menu item');
    }
  }

  if (!user) {
    return (
      <main className="app-shell auth-shell">
        <section className="login-panel">
          <p className="eyebrow">Restaurant Ops</p>
          <h1>Staff Sign In</h1>
          <p className="login-copy">Use a staff or admin account to manage orders.</p>

          {error && <div className="alert">{error}</div>}

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                autoComplete="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Password
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <button className="primary-button" disabled={isLoggingIn || isLoading}>
              {isLoggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="demo-accounts">
            <strong>Local demo accounts</strong>
            <span>Admin: admin@example.com / Admin123!</span>
            <span>Staff: staff@example.com / Staff123!</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Restaurant Ops</p>
            <h1>Restaurant Order Manager</h1>
          </div>
          <div className="user-actions">
            <span>{user.name} · {user.role}</span>
            <button className="ghost-button" onClick={() => loadData()} disabled={isLoading}>
              Refresh
            </button>
            <button className="ghost-button" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
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

        {user.role === 'admin' && (
          <section className="admin-panel">
            <div className="panel-heading">
              <h2>Menu Management</h2>
              <span>{adminMenuItems.length} items</span>
            </div>

            <form className="menu-admin-form" onSubmit={handleCreateMenuItem}>
              <label>
                Item
                <input value={newMenuName} onChange={(event) => setNewMenuName(event.target.value)} required />
              </label>
              <label>
                Category
                <select value={newMenuCategory} onChange={(event) => setNewMenuCategory(event.target.value)}>
                  {menuCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label>
                Price
                <input
                  min="0"
                  step="0.01"
                  type="number"
                  value={newMenuPrice}
                  onChange={(event) => setNewMenuPrice(event.target.value)}
                  required
                />
              </label>
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={newMenuAvailable}
                  onChange={(event) => setNewMenuAvailable(event.target.checked)}
                />
                Available
              </label>
              <button className="primary-button" disabled={isCreatingMenuItem}>
                {isCreatingMenuItem ? 'Creating...' : 'Create Item'}
              </button>
            </form>

            <div className="menu-admin-list">
              {adminMenuItems.map((menuItem) => (
                <article key={menuItem.id} className="menu-admin-row">
                  <input
                    aria-label={`${menuItem.name} name`}
                    defaultValue={menuItem.name}
                    onBlur={(event) => {
                      if (event.target.value !== menuItem.name) {
                        handleMenuItemUpdate(menuItem, { name: event.target.value });
                      }
                    }}
                  />
                  <select
                    aria-label={`${menuItem.name} category`}
                    value={menuItem.category}
                    onChange={(event) => {
                      if (event.target.value !== menuItem.category) {
                        handleMenuItemUpdate(menuItem, { category: event.target.value });
                      }
                    }}
                  >
                    {menuCategories.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <input
                    aria-label={`${menuItem.name} price`}
                    defaultValue={(menuItem.priceCents / 100).toFixed(2)}
                    min="0"
                    step="0.01"
                    type="number"
                    onBlur={(event) => {
                      const priceCents = dollarsToCents(event.target.value);
                      if (priceCents !== menuItem.priceCents) {
                        handleMenuItemUpdate(menuItem, { priceCents });
                      }
                    }}
                  />
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={menuItem.isAvailable}
                      onChange={(event) => handleMenuItemUpdate(menuItem, { isAvailable: event.target.checked })}
                    />
                    Available
                  </label>
                </article>
              ))}
            </div>
          </section>
        )}

        {user.role === 'admin' && (
          <section className="admin-panel">
            <div className="panel-heading">
              <h2>Staff Management</h2>
              <span>{staffUsers.length} users</span>
            </div>

            <form className="staff-form" onSubmit={handleCreateStaff}>
              <label>
                Name
                <input value={newStaffName} onChange={(event) => setNewStaffName(event.target.value)} required />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={(event) => setNewStaffEmail(event.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  minLength={8}
                  value={newStaffPassword}
                  onChange={(event) => setNewStaffPassword(event.target.value)}
                  required
                />
              </label>
              <label>
                Role
                <select value={newStaffRole} onChange={(event) => setNewStaffRole(event.target.value as UserRole)}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              <button className="primary-button" disabled={isCreatingStaff}>
                {isCreatingStaff ? 'Creating...' : 'Create User'}
              </button>
            </form>

            <div className="staff-list">
              {staffUsers.map((staffUser) => (
                <article key={staffUser.id} className="staff-row">
                  <div>
                    <strong>{staffUser.name}</strong>
                    <span>{staffUser.email}</span>
                  </div>
                  <select
                    value={staffUser.role}
                    onChange={(event) => handleStaffRoleChange(staffUser, event.target.value as UserRole)}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={staffUser.isActive}
                      onChange={(event) => handleStaffActiveChange(staffUser, event.target.checked)}
                    />
                    Active
                  </label>
                  <button
                    className="danger-button subtle-button"
                    disabled={staffUser.id === user.id}
                    onClick={() => handleDeleteStaff(staffUser)}
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
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

function dollarsToCents(value: string) {
  return Math.round(Number(value) * 100);
}

function compareMenuItems(left: MenuItem, right: MenuItem) {
  return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
}

export default App;

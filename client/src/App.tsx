import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  updateOrder,
  updateStaffUser,
  updateOrderStatus
} from './api';
import type {
  DraftItem,
  FulfillmentType,
  MenuItem,
  Order,
  OrderFilters,
  OrderSource,
  OrderStatus,
  User,
  UserRole
} from './types';

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
const orderSourceLabels: Record<OrderSource, string> = {
  in_person: 'In-person',
  phone: 'Phone'
};
const fulfillmentLabels: Record<FulfillmentType, string> = {
  dine_in: 'Dine-in',
  to_go: 'To-go',
  pickup: 'Pickup',
  delivery: 'Delivery'
};
type OrderFilterState = Omit<OrderFilters, 'status'> & {
  status: OrderStatus | 'all';
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [adminMenuItems, setAdminMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [orderSource, setOrderSource] = useState<OrderSource>('in_person');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [phoneNumber, setPhoneNumber] = useState('');
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
  const [orderFilters, setOrderFilters] = useState<OrderFilterState>({
    status: 'all',
    tableNumber: '',
    serverName: '',
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 8
  });
  const [orderPagination, setOrderPagination] = useState({
    page: 1,
    limit: 8,
    total: 0,
    totalPages: 0
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [isCreatingMenuItem, setIsCreatingMenuItem] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const orderFiltersRef = useRef(orderFilters);
  const userRef = useRef<User | null>(user);

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    orderFiltersRef.current = orderFilters;
    userRef.current = user;
  }, [orderFilters, user]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  async function loadSession() {
    try {
      setIsLoading(true);
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      setServerName(currentUser.name);
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

  async function loadData(currentUser = user, filters = orderFilters) {
    try {
      setIsLoading(true);
      const [menu, orderList, staffList, adminMenu] = await Promise.all([
        fetchMenuItems(),
        fetchOrders(toOrderApiFilters(filters)),
        currentUser?.role === 'admin' ? fetchStaffUsers() : Promise.resolve([]),
        currentUser?.role === 'admin' ? fetchAdminMenuItems() : Promise.resolve([])
      ]);
      setMenuItems(menu);
      setOrders(orderList.orders);
      setOrderPagination(orderList.pagination);
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
      setServerName(session.user.name);
      setOrderFilters((current) => ({
        ...current,
        status: session.user.role === 'chef' && !isKitchenStatus(current.status) ? 'all' : current.status,
        page: 1
      }));
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
    setEditingOrderId(null);
    setSelectedItems({});
    setServerName('');
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
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

  const filteredOrders = orders;

  function handleOrderSourceChange(source: OrderSource) {
    setOrderSource(source);
    setFulfillmentType(source === 'in_person' ? 'dine_in' : 'pickup');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (draftItems.length === 0) {
      setError('Please select at least one menu item');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        orderSource,
        fulfillmentType,
        tableNumber: orderSource === 'in_person' ? tableNumber : undefined,
        partySize: orderSource === 'in_person' ? Number(partySize) : undefined,
        phoneNumber: orderSource === 'phone' ? phoneNumber : undefined,
        serverName,
        notes,
        items: draftItems
      };

      if (editingOrderId) {
        await updateOrder(editingOrderId, payload);
      } else {
        await createOrder(payload);
      }
      setEditingOrderId(null);
      setTableNumber('');
      setPartySize('2');
      setPhoneNumber('');
      setServerName(user?.name ?? '');
      setNotes('');
      setSelectedItems({});
      await loadData();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save order');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditOrder(order: Order) {
    if (order.status !== 'pending') {
      setError('Only pending orders can be edited');
      return;
    }

    setEditingOrderId(order.id);
    setOrderSource(order.orderSource);
    setFulfillmentType(order.fulfillmentType);
    setTableNumber(order.tableNumber ?? '');
    setPartySize(order.partySize?.toString() ?? '2');
    setPhoneNumber(order.phoneNumber ?? '');
    setServerName(order.serverName);
    setNotes(order.notes ?? '');
    setSelectedItems(Object.fromEntries(order.items.map((item) => [item.menuItemId, item.quantity])));
    setError(null);
  }

  function handleCancelEdit() {
    setEditingOrderId(null);
    setOrderSource('in_person');
    setFulfillmentType('dine_in');
    setTableNumber('');
    setPartySize('2');
    setPhoneNumber('');
    setServerName(user?.name ?? '');
    setNotes('');
    setSelectedItems({});
    setError(null);
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    if (status === 'cancelled' && !window.confirm(`Cancel ${getOrderTitle(order)}? This action cannot be undone.`)) {
      return;
    }

    try {
      const updated = await updateOrderStatus(order.id, status);
      setOrders((current) => {
        if (orderFilters.status !== 'all' && updated.status !== orderFilters.status) {
          return current.filter((item) => item.id !== updated.id);
        }

        return current.map((item) => (item.id === updated.id ? updated : item));
      });
      if (user?.role === 'chef' && updated.status === 'ready') {
        scheduleOrderListRefresh();
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    }
  }

  async function handleOrderFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = {
      ...orderFilters,
      status: user?.role === 'chef' && !isKitchenStatus(orderFilters.status) ? 'all' : orderFilters.status,
      page: 1
    };
    setOrderFilters(nextFilters);
    await loadData(user, nextFilters);
  }

  async function handleOrderFilterReset() {
    const nextFilters: OrderFilterState = {
      status: 'all',
      tableNumber: '',
      serverName: '',
      fromDate: '',
      toDate: '',
      page: 1,
      limit: orderFilters.limit
    };
    setOrderFilters(nextFilters);
    await loadData(user, nextFilters);
  }

  async function handlePageChange(page: number) {
    const nextFilters = { ...orderFilters, page };
    setOrderFilters(nextFilters);
    await loadData(user, nextFilters);
  }

  function scheduleOrderListRefresh() {
    if (refreshTimeoutRef.current !== null) {
      return;
    }

    refreshTimeoutRef.current = window.setTimeout(() => {
      refreshTimeoutRef.current = null;
      loadData(userRef.current, orderFiltersRef.current);
    }, 3000);
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
            <span>Chef: chef@example.com / Chef123!</span>
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

        <div className={user.role === 'chef' ? 'layout kitchen-layout' : 'layout'}>
          {user.role !== 'chef' && (
          <form className="panel order-form" onSubmit={handleSubmit}>
            <div className="panel-heading">
              <h2>{editingOrderId ? 'Edit Order' : 'New Order'}</h2>
              <strong>{formatMoney(draftTotal)}</strong>
            </div>

            <div className="segmented-control" aria-label="Order source">
              <button
                className={orderSource === 'in_person' ? 'selected' : ''}
                type="button"
                onClick={() => handleOrderSourceChange('in_person')}
              >
                In-person
              </button>
              <button
                className={orderSource === 'phone' ? 'selected' : ''}
                type="button"
                onClick={() => handleOrderSourceChange('phone')}
              >
                Phone
              </button>
            </div>

            {orderSource === 'in_person' ? (
              <>
                <label>
                  Table
                  <input value={tableNumber} onChange={(event) => setTableNumber(event.target.value)} required />
                </label>

                <label>
                  Party Size
                  <input
                    min="1"
                    type="number"
                    value={partySize}
                    onChange={(event) => setPartySize(event.target.value)}
                    required
                  />
                </label>

                <label>
                  Service
                  <select value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as FulfillmentType)}>
                    <option value="dine_in">Dine-in</option>
                    <option value="to_go">To-go</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <label>
                  Phone
                  <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
                </label>

                <label>
                  Service
                  <select value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as FulfillmentType)}>
                    <option value="pickup">Pickup</option>
                    <option value="delivery">Delivery</option>
                  </select>
                </label>
              </>
            )}

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

            <div className="form-actions">
              <button className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingOrderId ? 'Save Changes' : 'Submit Order'}
              </button>
              {editingOrderId && (
                <button className="ghost-button" type="button" onClick={handleCancelEdit}>
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
          )}

          <section className="orders-panel">
            <div className="panel-heading">
              <h2>{user.role === 'chef' ? 'Kitchen Board' : 'Order Board'}</h2>
              <span>{orderPagination.total} matching orders</span>
            </div>

            <form className="order-filters" onSubmit={handleOrderFilterSubmit}>
              <div className="filter-fields">
                <label>
                  Status
                  <select
                    value={orderFilters.status}
                    onChange={(event) => setOrderFilters((current) => ({
                      ...current,
                      status: event.target.value as OrderStatus | 'all'
                    }))}
                  >
                    <option value="all">All Statuses</option>
                    {getVisibleStatusOptions(user.role).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Table
                  <input
                    value={orderFilters.tableNumber}
                    onChange={(event) => setOrderFilters((current) => ({ ...current, tableNumber: event.target.value }))}
                  />
                </label>
                <label>
                  Server
                  <input
                    value={orderFilters.serverName}
                    onChange={(event) => setOrderFilters((current) => ({ ...current, serverName: event.target.value }))}
                  />
                </label>
                <label>
                  From
                  <input
                    type="date"
                    value={orderFilters.fromDate}
                    onChange={(event) => setOrderFilters((current) => ({ ...current, fromDate: event.target.value }))}
                  />
                </label>
                <label>
                  To
                  <input
                    type="date"
                    value={orderFilters.toDate}
                    onChange={(event) => setOrderFilters((current) => ({ ...current, toDate: event.target.value }))}
                  />
                </label>
              </div>
              <div className="filter-actions">
                <button className="primary-button">Apply</button>
                <button className="ghost-button" type="button" onClick={handleOrderFilterReset}>
                  Clear
                </button>
              </div>
            </form>

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
                        <strong>{getOrderTitle(order)}</strong>
                        <span>{orderSourceLabels[order.orderSource]} / {fulfillmentLabels[order.fulfillmentType]}</span>
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
                        {canEditOrder(order.status, user.role) && (
                          <button onClick={() => handleEditOrder(order)}>
                            Edit
                          </button>
                        )}
                        {getAllowedNextStatus(order.status, user.role) && (
                          <button onClick={() => handleStatusChange(order, getAllowedNextStatus(order.status, user.role)!)}>
                            {user.role === 'chef' && order.status === 'pending'
                              ? 'Start'
                              : user.role === 'chef' && order.status === 'preparing'
                                ? 'Mark Done'
                                : statusLabels[getAllowedNextStatus(order.status, user.role)!]}
                          </button>
                        )}
                        {canCancelOrder(order.status, user.role) && (
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

            <div className="pagination">
              <button
                className="ghost-button"
                disabled={orderPagination.page <= 1 || isLoading}
                onClick={() => handlePageChange(orderPagination.page - 1)}
              >
                Previous
              </button>
              <span>
                Page {orderPagination.totalPages === 0 ? 0 : orderPagination.page} of {orderPagination.totalPages}
              </span>
              <button
                className="ghost-button"
                disabled={orderPagination.page >= orderPagination.totalPages || isLoading}
                onClick={() => handlePageChange(orderPagination.page + 1)}
              >
                Next
              </button>
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
                  <option value="chef">Chef</option>
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
                    <option value="chef">Chef</option>
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

function getOrderTitle(order: Order) {
  if (order.orderSource === 'phone') {
    return `Phone ${order.phoneNumber}`;
  }

  return `Table ${order.tableNumber} / ${order.partySize} guests`;
}

function getAllowedNextStatus(status: OrderStatus, role: UserRole) {
  if (role === 'admin') {
    return nextStatus[status];
  }

  if (role === 'chef') {
    if (status === 'pending') {
      return 'preparing';
    }

    if (status === 'preparing') {
      return 'ready';
    }
  }

  if (role === 'staff' && status === 'ready') {
    return 'served';
  }

  return undefined;
}

function canCancelOrder(status: OrderStatus, role: UserRole) {
  if (role === 'admin') {
    return status !== 'served' && status !== 'cancelled';
  }

  return role === 'staff' && status === 'pending';
}

function canEditOrder(status: OrderStatus, role: UserRole) {
  return status === 'pending' && (role === 'staff' || role === 'admin');
}

function getVisibleStatusOptions(role: UserRole) {
  const entries = Object.entries(statusLabels) as Array<[OrderStatus, string]>;

  return role === 'chef'
    ? entries.filter(([status]) => isKitchenStatus(status))
    : entries;
}

function isKitchenStatus(status: OrderStatus | 'all') {
  return status === 'all' || status === 'pending' || status === 'preparing';
}

function toOrderApiFilters(filters: OrderFilterState): OrderFilters {
  return {
    page: filters.page,
    limit: filters.limit,
    ...(filters.status !== 'all' ? { status: filters.status } : {}),
    ...(filters.tableNumber ? { tableNumber: filters.tableNumber } : {}),
    ...(filters.serverName ? { serverName: filters.serverName } : {}),
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {})
  };
}

export default App;

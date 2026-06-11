import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearStoredToken,
  checkoutOrder,
  createMenuBundle,
  createMenuItem,
  createOrder,
  createStaffUser,
  createTable,
  deleteStaffUser,
  deleteTable,
  fetchAdminMenuBundles,
  fetchAdminMenuItems,
  fetchMenuBundles,
  fetchCurrentUser,
  fetchMenuItems,
  fetchOrderEvents,
  fetchOrders,
  fetchStaffUsers,
  fetchTables,
  login,
  storeToken,
  subscribeToRealtimeEvents,
  updateMenuBundle,
  updateMenuBundleSoldOut,
  updateMenuItem,
  updateMenuItemSoldOut,
  updateOrder,
  updateOrderItemStatus,
  updateStaffUser,
  updateOrderStatus,
  updateTable
} from './api';
import type {
  DraftItem,
  FulfillmentType,
  MenuItem,
  MenuBundle,
  Order,
  OrderEvent,
  OrderFilters,
  OrderItem,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  RestaurantTable,
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
const itemStatusLabels: Record<OrderItemStatus, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served'
};

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served'
};

const menuCategories = ['Combos', 'Entrees', 'Vegetables', 'Small Plates', 'Drinks', 'Desserts'];
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
const tableStatusLabels = {
  available: 'Available',
  occupied: 'Occupied',
  needs_cleaning: 'Needs cleaning'
};
const tipPresetOptions = [10, 15, 20];
const extraChairsAllowed = 2;
const taxRate = 0.086;
const protectedDefaultUserEmails = new Set(['admin@example.com', 'staff@example.com', 'chef@example.com']);
const protectedDefaultTableNames = new Set(Array.from({ length: 12 }, (_, index) => `T${index + 1}`));
const alwaysAvailableMenuItemNames = new Set(['Lemon Iced Tea', 'Signature Beef Noodles']);

type OrderFilterState = Omit<OrderFilters, 'status'> & {
  status: OrderStatus | 'all' | 'active';
};
type StaffOrderStep = 'service' | 'table' | 'party' | 'phone' | 'menu';
type SplitBill = {
  id: string;
  label: string;
  itemIds: string[];
  amountCents?: number;
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuBundles, setMenuBundles] = useState<MenuBundle[]>([]);
  const [adminMenuItems, setAdminMenuItems] = useState<MenuItem[]>([]);
  const [adminMenuBundles, setAdminMenuBundles] = useState<MenuBundle[]>([]);
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<PaymentMethod>('card');
  const [checkoutTip, setCheckoutTip] = useState('0.00');
  const [checkoutTipPreset, setCheckoutTipPreset] = useState<number | 'custom'>('custom');
  const [checkoutSelectedItemIds, setCheckoutSelectedItemIds] = useState<string[]>([]);
  const [isSplitBillOpen, setIsSplitBillOpen] = useState(false);
  const [splitBills, setSplitBills] = useState<SplitBill[]>([]);
  const [activeSplitBillId, setActiveSplitBillId] = useState<string | null>(null);
  const [splitPlansByOrderId, setSplitPlansByOrderId] = useState<Record<string, SplitBill[]>>({});
  const [orderEvents, setOrderEvents] = useState<OrderEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [selectedBundles, setSelectedBundles] = useState<Record<string, number>>({});
  const [orderSource, setOrderSource] = useState<OrderSource>('in_person');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('dine_in');
  const [tableNumber, setTableNumber] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [serverName, setServerName] = useState('');
  const [notes, setNotes] = useState('');
  const [staffOrderStep, setStaffOrderStep] = useState<StaffOrderStep>('service');
  const [selectedCategory, setSelectedCategory] = useState(menuCategories[0]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('test@example.com');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('staff');
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('Entrees');
  const [newMenuPrice, setNewMenuPrice] = useState('12.00');
  const [newMenuAvailable, setNewMenuAvailable] = useState(true);
  const [newBundleName, setNewBundleName] = useState('');
  const [newBundlePrice, setNewBundlePrice] = useState('23.80');
  const [newBundleAvailable, setNewBundleAvailable] = useState(true);
  const [newBundleItems, setNewBundleItems] = useState<Record<string, number>>({});
  const [newTableName, setNewTableName] = useState('T13');
  const [newTableCapacity, setNewTableCapacity] = useState('4');
  const [orderFilters, setOrderFilters] = useState<OrderFilterState>({
    status: 'active',
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
  const [isCreatingMenuBundle, setIsCreatingMenuBundle] = useState(false);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [processingOrderActionId, setProcessingOrderActionId] = useState<string | null>(null);
  const [processingItemActionId, setProcessingItemActionId] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const refreshTimeoutRef = useRef<number | null>(null);
  const realtimeRefreshTimeoutRef = useRef<number | null>(null);
  const orderFiltersRef = useRef(orderFilters);
  const userRef = useRef<User | null>(user);

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      clearStoredToken();
      setUser(null);
      setOrders([]);
      setMenuBundles([]);
      setStaffUsers([]);
      setAdminMenuItems([]);
      setAdminMenuBundles([]);
      setRestaurantTables([]);
      setEditingOrderId(null);
      setHistoryOrder(null);
      setCheckoutTarget(null);
      setCheckoutSelectedItemIds([]);
      resetSplitBills();
      setSplitPlansByOrderId({});
      setReceiptOrder(null);
      setOrderEvents([]);
      setSelectedItems({});
      setSelectedBundles({});
      setServerName('');
      setError('Your session expired. Please sign in again.');
    }

    window.addEventListener('restaurant-ops:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('restaurant-ops:unauthorized', handleUnauthorized);
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
      if (realtimeRefreshTimeoutRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return subscribeToRealtimeEvents((event) => {
      if (event.action === 'connected') {
        return;
      }

      scheduleRealtimeDataRefresh();
    });
  }, [user]);

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

  async function loadData(currentUser = user, filters = orderFilters, options: { silent?: boolean } = {}) {
    try {
      if (!options.silent) {
        setIsLoading(true);
      }
      const [menu, bundles, orderList, staffList, adminMenu, adminBundles, tables] = await Promise.all([
        fetchMenuItems(),
        fetchMenuBundles(),
        fetchOrders(toOrderApiFilters(filters, currentUser)),
        currentUser?.role === 'admin' ? fetchStaffUsers() : Promise.resolve([]),
        currentUser?.role === 'admin' || currentUser?.role === 'chef' ? fetchAdminMenuItems() : Promise.resolve([]),
        currentUser?.role === 'admin' ? fetchAdminMenuBundles() : Promise.resolve([]),
        currentUser ? fetchTables() : Promise.resolve([])
      ]);
      setMenuItems(menu);
      setMenuBundles(bundles);
      setOrders(orderList.orders);
      setOrderPagination(orderList.pagination);
      setStaffUsers(staffList);
      setAdminMenuItems(adminMenu);
      setAdminMenuBundles(adminBundles);
      setRestaurantTables(tables);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      if (!options.silent) {
        setIsLoading(false);
      }
    }
  }

  async function refreshTables() {
    setRestaurantTables(await fetchTables());
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
        status: getDefaultStatusFilter(session.user.role, current.status),
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
    setMenuBundles([]);
    setStaffUsers([]);
    setAdminMenuItems([]);
    setAdminMenuBundles([]);
    setRestaurantTables([]);
    setEditingOrderId(null);
    setHistoryOrder(null);
    setCheckoutTarget(null);
    setCheckoutSelectedItemIds([]);
    resetSplitBills();
    setSplitPlansByOrderId({});
    setReceiptOrder(null);
    setOrderEvents([]);
    setSelectedItems({});
    setSelectedBundles({});
    setServerName('');
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    if (realtimeRefreshTimeoutRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimeoutRef.current);
      realtimeRefreshTimeoutRef.current = null;
    }
    setError(null);
  }

  const categories = useMemo(() => {
    return Array.from(new Set([
      ...(menuBundles.length > 0 ? ['Combos'] : []),
      ...menuItems.map((item) => item.category)
    ]));
  }, [menuBundles, menuItems]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const draftItems: DraftItem[] = useMemo(() => {
    const itemDrafts = Object.entries(selectedItems)
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemVariantId, quantity]) => {
        const menuItem = getMenuItemByVariantId(menuItems, menuItemVariantId);

        return {
          menuItemId: menuItem?.id ?? '',
          menuItemVariantId,
          quantity
        };
      })
      .filter((item) => item.menuItemId);
    const bundleDrafts = Object.entries(selectedBundles)
      .filter(([, quantity]) => quantity > 0)
      .map(([bundleId, quantity]) => ({ bundleId, quantity }));

    return [...itemDrafts, ...bundleDrafts];
  }, [selectedBundles, selectedItems, menuItems]);

  const draftTotal = useMemo(() => {
    return draftItems.reduce((total, item) => {
      if (item.bundleId) {
        const bundle = menuBundles.find((candidate) => candidate.id === item.bundleId);
        return total + (bundle?.priceCents ?? 0) * item.quantity;
      }

      if (!item.menuItemVariantId) {
        return total;
      }

      const variant = getMenuItemVariantById(menuItems, item.menuItemVariantId);
      return total + (variant?.priceCents ?? 0) * item.quantity;
    }, 0);
  }, [draftItems, menuBundles, menuItems]);
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

  const filteredOrders = orders;
  const selectedTable = useMemo(() => {
    return restaurantTables.find((table) => table.name === tableNumber);
  }, [restaurantTables, tableNumber]);
  const maxPartySize = selectedTable ? selectedTable.capacity + extraChairsAllowed : 99;
  const adminMenuVariantOptions = useMemo(() => getMenuVariantOptions(adminMenuItems), [adminMenuItems]);

  useEffect(() => {
    if (checkoutTipPreset === 'custom') {
      return;
    }

    setCheckoutTip(centsToDollarsInput(Math.round(checkoutSubtotalCents * (checkoutTipPreset / 100))));
  }, [checkoutSubtotalCents, checkoutTipPreset]);

  function handleOrderSourceChange(source: OrderSource) {
    setOrderSource(source);
    setFulfillmentType(source === 'in_person' ? 'dine_in' : 'pickup');
  }

  function resetOrderDraft() {
    setEditingOrderId(null);
    setOrderSource('in_person');
    setFulfillmentType('dine_in');
    setTableNumber('');
    setPartySize('2');
    setPhoneNumber('');
    setServerName(user?.name ?? '');
    setNotes('');
    setSelectedItems({});
    setSelectedBundles({});
    setStaffOrderStep('service');
  }

  function startStaffOrder(source: OrderSource, fulfillment: FulfillmentType) {
    setEditingOrderId(null);
    setOrderSource(source);
    setFulfillmentType(fulfillment);
    setTableNumber('');
    setPartySize('2');
    setPhoneNumber('');
    setServerName(user?.name ?? '');
    setNotes('');
    setSelectedItems({});
    setSelectedBundles({});
    setStaffOrderStep(fulfillment === 'dine_in' ? 'table' : source === 'phone' ? 'phone' : 'menu');
  }

  function goToStaffPartyStep() {
    if (!tableNumber.trim()) {
      setError('Please choose a table');
      return;
    }

    setPartySize((current) => Math.min(Number(current), maxPartySize).toString());
    setError(null);
    setStaffOrderStep('party');
  }

  function goToStaffMenuStep() {
    if (fulfillmentType === 'dine_in' && Number(partySize) < 1) {
      setError('Please enter the party size');
      return;
    }

    if (fulfillmentType === 'dine_in' && Number(partySize) > maxPartySize) {
      setError(`This table seats ${selectedTable?.capacity ?? maxPartySize}. Maximum party size is ${maxPartySize} with extra chairs.`);
      return;
    }

    if (orderSource === 'phone' && !phoneNumber.trim()) {
      setError('Please enter a phone number');
      return;
    }

    setError(null);
    setStaffOrderStep('menu');
  }

  function handleMenuQuantityChange(menuItemVariantId: string, quantity: number) {
    setSelectedItems((current) => {
      const next = { ...current };

      if (quantity > 0) {
        next[menuItemVariantId] = quantity;
      } else {
        delete next[menuItemVariantId];
      }

      return next;
    });
  }

  function handleBundleQuantityChange(bundleId: string, quantity: number) {
    setSelectedBundles((current) => {
      const next = { ...current };

      if (quantity > 0) {
        next[bundleId] = quantity;
      } else {
        delete next[bundleId];
      }

      return next;
    });
  }

  function handleTableSelect(table: RestaurantTable) {
    const nextMaxPartySize = table.capacity + extraChairsAllowed;
    setTableNumber(table.name);
    setPartySize((current) => Math.min(Number(current), nextMaxPartySize).toString());
    setIsTablePickerOpen(false);
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
        tableNumber: fulfillmentType === 'dine_in' ? tableNumber : undefined,
        partySize: fulfillmentType === 'dine_in' ? Number(partySize) : undefined,
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
      resetOrderDraft();
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
    setSelectedItems(getSelectedItemsFromOrder(order));
    setSelectedBundles(getSelectedBundlesFromOrder(order, menuBundles));
    setStaffOrderStep('menu');
    setError(null);
  }

  function handleCancelEdit() {
    resetOrderDraft();
    setError(null);
  }

  async function handleStatusChange(order: Order, status: OrderStatus) {
    if (status === 'cancelled' && !window.confirm(`Cancel ${getOrderTitle(order)}? This action cannot be undone.`)) {
      return;
    }

    const actionId = `${order.id}:${status}`;

    try {
      setProcessingOrderActionId(actionId);
      const updated = await updateOrderStatus(order.id, status);
      setOrders((current) => {
        if (!doesOrderMatchCurrentStatusFilter(updated, orderFilters.status)) {
          return current.filter((item) => item.id !== updated.id);
        }

        return current.map((item) => (item.id === updated.id ? updated : item));
      });
      if (user?.role === 'chef' && updated.status === 'ready') {
        scheduleOrderListRefresh();
      }
      if (updated.fulfillmentType === 'dine_in' && (updated.status === 'served' || updated.status === 'cancelled')) {
        await refreshTables();
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order status');
    } finally {
      setProcessingOrderActionId(null);
    }
  }

  async function handleItemStatusChange(order: Order, item: OrderItem, status: OrderItemStatus) {
    const actionId = `${item.id}:${status}`;

    try {
      setProcessingItemActionId(actionId);
      const updated = await updateOrderItemStatus(order.id, item.id, status);
      setOrders((current) => {
        if (!doesOrderMatchCurrentStatusFilter(updated, orderFilters.status)) {
          return current.filter((candidate) => candidate.id !== updated.id);
        }

        return current.map((candidate) => (candidate.id === updated.id ? updated : candidate));
      });

      if (updated.fulfillmentType === 'dine_in' && updated.status === 'served') {
        await refreshTables();
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item status');
    } finally {
      setProcessingItemActionId(null);
    }
  }

  async function handleViewHistory(order: Order) {
    try {
      setHistoryOrder(order);
      setIsLoadingEvents(true);
      setOrderEvents(await fetchOrderEvents(order.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load order history');
    } finally {
      setIsLoadingEvents(false);
    }
  }

  function handleOpenCheckout(order: Order) {
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
    setSplitPlansByOrderId((current) => ({
      ...current,
      [order.id]: usablePlan
    }));
    setError(null);
  }

  function handleCloseCheckout() {
    setCheckoutTarget(null);
    setCheckoutSelectedItemIds([]);
    setIsSplitBillOpen(false);
  }

  function resetSplitBills() {
    setIsSplitBillOpen(false);
    setSplitBills([]);
    setActiveSplitBillId(null);
  }

  function handlePrintReceipt() {
    document.body.classList.add('printing-receipt');
    window.print();
    window.setTimeout(() => document.body.classList.remove('printing-receipt'), 0);
  }

  function handleTipPreset(percent: number) {
    if (!checkoutTarget) {
      return;
    }

    setCheckoutTip(centsToDollarsInput(Math.round(checkoutSubtotalCents * (percent / 100))));
    setCheckoutTipPreset(percent);
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
      setError('Please add at least one item to this split bill');
      return;
    }

    setCheckoutSelectedItemIds(activeSplitBill.itemIds);
    setCheckoutTip('0.00');
    setCheckoutTipPreset('custom');
    setIsSplitBillOpen(false);
    setError(null);
  }

  async function handleCheckoutSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!checkoutTarget) {
      return;
    }

    if (checkoutSelectedItemIds.length === 0 && !isActiveAmountSplit) {
      setError('Please select at least one unpaid item to checkout');
      return;
    }

    try {
      setIsCheckingOut(true);
      const updated = await checkoutOrder(checkoutTarget.id, {
        paymentMethod: checkoutPaymentMethod,
        ...(isActiveAmountSplit ? {} : { orderItemIds: checkoutSelectedItemIds }),
        subtotalCents: checkoutSubtotalCents,
        taxCents: checkoutTaxCents,
        tipCents: checkoutTipCents,
        totalCents: checkoutTotalCents
      });
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
      setCheckoutTip('0.00');
      setCheckoutTipPreset('custom');

      if (updated.paymentStatus === 'paid') {
        setCheckoutTarget(null);
        setCheckoutSelectedItemIds([]);
        resetSplitBills();
        setSplitPlansByOrderId((current) => {
          const { [updated.id]: _removed, ...rest } = current;
          return rest;
        });
      } else {
        const remainingUnpaidIds = updated.items.filter((item) => !item.paymentId).map((item) => item.id);
        const nextBills = isActiveAmountSplit
          ? splitBills.filter((splitBill) => splitBill.id !== activeSplitBill?.id)
          : normalizeSplitBillsForUnpaidItems(splitBills, remainingUnpaidIds);
        const nextBill = getNextPayableSplitBill(nextBills, checkoutSelectedItemIds);

        setCheckoutTarget(updated);
        setSplitBills(nextBills);
        setActiveSplitBillId(nextBill?.id ?? null);
        setCheckoutSelectedItemIds(nextBill?.amountCents !== undefined ? [] : nextBill?.itemIds ?? remainingUnpaidIds);
        saveSplitPlan(updated.id, nextBills);
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to checkout order');
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function handleOrderFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = {
      ...orderFilters,
      status: getDefaultStatusFilter(user?.role, orderFilters.status),
      page: 1
    };
    setOrderFilters(nextFilters);
    await loadData(user, nextFilters);
  }

  async function handleOrderFilterReset() {
    const nextFilters: OrderFilterState = {
      status: getDefaultStatusFilter(user?.role),
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
      loadData(userRef.current, orderFiltersRef.current, { silent: true });
    }, 3000);
  }

  function scheduleRealtimeDataRefresh() {
    if (realtimeRefreshTimeoutRef.current !== null) {
      return;
    }

    realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
      realtimeRefreshTimeoutRef.current = null;
      loadData(userRef.current, orderFiltersRef.current, { silent: true });
    }, 500);
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
    if (isProtectedDefaultUser(staffUser)) {
      setError('Default demo account roles cannot be changed');
      return;
    }

    try {
      const updated = await updateStaffUser(staffUser.id, { role });
      setStaffUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff user');
    }
  }

  async function handleStaffActiveChange(staffUser: User, isActive: boolean) {
    if (isProtectedDefaultUser(staffUser)) {
      setError('Default demo accounts cannot be deactivated');
      return;
    }

    try {
      const updated = await updateStaffUser(staffUser.id, { isActive });
      setStaffUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update staff user');
    }
  }

  async function handleDeleteStaff(staffUser: User) {
    if (isProtectedDefaultUser(staffUser)) {
      setError('Default demo accounts cannot be deleted');
      return;
    }

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
        isAvailable: newMenuAvailable,
        isSoldOut: false
      });
      setAdminMenuItems((current) => [...current, created].sort(compareMenuItems));
      if (created.isAvailable && !created.isSoldOut) {
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

  function handleNewBundleItemQuantityChange(menuItemVariantId: string, quantity: number) {
    setNewBundleItems((current) => setBundleItemQuantity(current, menuItemVariantId, quantity));
  }

  async function handleCreateMenuBundle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = getBundleItemsInput(newBundleItems);

    if (items.length === 0) {
      setError('Please choose at least one item for this combo');
      return;
    }

    try {
      setIsCreatingMenuBundle(true);
      const created = await createMenuBundle({
        name: newBundleName,
        priceCents: dollarsToCents(newBundlePrice),
        isAvailable: newBundleAvailable,
        isSoldOut: false,
        items
      });
      setAdminMenuBundles((current) => [...current, created].sort(compareMenuBundles));
      if (created.isAvailable && !created.isSoldOut) {
        setMenuBundles((current) => [...current, created].sort(compareMenuBundles));
      }
      setNewBundleName('');
      setNewBundlePrice('23.80');
      setNewBundleAvailable(true);
      setNewBundleItems({});
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create menu bundle');
    } finally {
      setIsCreatingMenuBundle(false);
    }
  }

  async function handleMenuBundleUpdate(menuBundle: MenuBundle, input: Partial<{
    name: string;
    priceCents: number;
    isAvailable: boolean;
    isSoldOut: boolean;
    items: Array<{ menuItemVariantId: string; quantity: number }>;
  }>) {
    try {
      const updated = await updateMenuBundle(menuBundle.id, input);
      setAdminMenuBundles((current) => current.map((bundle) => (bundle.id === updated.id ? updated : bundle)).sort(compareMenuBundles));
      setMenuBundles((current) => {
        const withoutUpdated = current.filter((bundle) => bundle.id !== updated.id);

        return updated.isAvailable && !updated.isSoldOut
          ? [...withoutUpdated, updated].sort(compareMenuBundles)
          : withoutUpdated;
      });
      setSelectedBundles((current) => {
        if (updated.isAvailable && !updated.isSoldOut) {
          return current;
        }

        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update menu bundle');
    }
  }

  async function handleBundleSoldOutChange(menuBundle: MenuBundle, isSoldOut: boolean) {
    try {
      const updated = await updateMenuBundleSoldOut(menuBundle.id, isSoldOut);
      setAdminMenuBundles((current) => current.map((bundle) => (bundle.id === updated.id ? updated : bundle)).sort(compareMenuBundles));
      setMenuBundles((current) => {
        const withoutUpdated = current.filter((bundle) => bundle.id !== updated.id);

        return updated.isAvailable && !updated.isSoldOut
          ? [...withoutUpdated, updated].sort(compareMenuBundles)
          : withoutUpdated;
      });
      setSelectedBundles((current) => {
        if (!updated.isSoldOut) {
          return current;
        }

        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update combo sold out status');
    }
  }

  function handleBundleComponentChange(menuBundle: MenuBundle, menuItemVariantId: string, quantity: number) {
    const currentItems = getBundleQuantityMap(menuBundle);
    const nextItems = getBundleItemsInput(setBundleItemQuantity(currentItems, menuItemVariantId, quantity));

    if (nextItems.length === 0) {
      setError('A combo must include at least one item');
      return;
    }

    handleMenuBundleUpdate(menuBundle, { items: nextItems });
  }

  async function handleMenuItemUpdate(menuItem: MenuItem, input: Partial<MenuItem>) {
    if (isAlwaysAvailableMenuItem(menuItem) && (input.isAvailable === false || input.isSoldOut === true)) {
      setError(`${menuItem.name} must remain available`);
      return;
    }

    try {
      const updated = await updateMenuItem(menuItem.id, input);
      setAdminMenuItems((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(compareMenuItems));
      setMenuItems((current) => {
        const withoutUpdated = current.filter((item) => item.id !== updated.id);

        return updated.isAvailable && !updated.isSoldOut
          ? [...withoutUpdated, updated].sort(compareMenuItems)
          : withoutUpdated;
      });
      setSelectedItems((current) => {
        if (updated.isAvailable && !updated.isSoldOut) {
          return current;
        }

        const next = { ...current };
        for (const variant of updated.variants) {
          delete next[variant.id];
        }
        return next;
      });
      const availableBundles = await fetchMenuBundles();
      setMenuBundles(availableBundles);
      setSelectedBundles((current) => {
        const availableBundleIds = new Set(availableBundles.map((bundle) => bundle.id));
        return Object.fromEntries(Object.entries(current).filter(([bundleId]) => availableBundleIds.has(bundleId)));
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update menu item');
    }
  }

  async function handleSoldOutChange(menuItem: MenuItem, isSoldOut: boolean) {
    if (isAlwaysAvailableMenuItem(menuItem) && isSoldOut) {
      setError(`${menuItem.name} cannot be marked sold out`);
      return;
    }

    try {
      const updated = user?.role === 'admin'
        ? await updateMenuItem(menuItem.id, { isSoldOut })
        : await updateMenuItemSoldOut(menuItem.id, isSoldOut);

      setAdminMenuItems((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(compareMenuItems));
      setMenuItems((current) => {
        const withoutUpdated = current.filter((item) => item.id !== updated.id);

        return updated.isAvailable && !updated.isSoldOut
          ? [...withoutUpdated, updated].sort(compareMenuItems)
          : withoutUpdated;
      });
      setSelectedItems((current) => {
        if (!updated.isSoldOut) {
          return current;
        }

        const next = { ...current };
        for (const variant of updated.variants) {
          delete next[variant.id];
        }
        return next;
      });
      const availableBundles = await fetchMenuBundles();
      setMenuBundles(availableBundles);
      setSelectedBundles((current) => {
        const availableBundleIds = new Set(availableBundles.map((bundle) => bundle.id));
        return Object.fromEntries(Object.entries(current).filter(([bundleId]) => availableBundleIds.has(bundleId)));
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sold out status');
    }
  }

  async function handleCreateTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsCreatingTable(true);
      const created = await createTable({
        name: newTableName,
        capacity: Number(newTableCapacity)
      });
      setRestaurantTables((current) => [...current, created].sort(compareTables));
      setNewTableName(getNextTableName([...restaurantTables, created]));
      setNewTableCapacity('4');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create table');
    } finally {
      setIsCreatingTable(false);
    }
  }

  async function handleTableUpdate(table: RestaurantTable, input: Partial<RestaurantTable>) {
    try {
      const updated = await updateTable(table.id, input);
      setRestaurantTables((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(compareTables));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update table');
    }
  }

  async function handleDeleteTable(table: RestaurantTable) {
    if (isProtectedDefaultTable(table)) {
      setError('Default restaurant tables cannot be deleted');
      return;
    }

    if (!window.confirm(`Delete ${table.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteTable(table.id);
      setRestaurantTables((current) => current.filter((item) => item.id !== table.id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete table');
    }
  }

  async function handleTableCleaned(table: RestaurantTable) {
    try {
      const updated = await updateTable(table.id, { status: 'available' });
      setRestaurantTables((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update table');
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

        {user.role === 'chef' && (
          <section className="admin-panel sold-out-panel">
            <div className="panel-heading">
              <h2>Sold Out</h2>
              <span>{adminMenuItems.filter((item) => item.isSoldOut).length} unavailable today</span>
            </div>

            <div className="sold-out-grid">
              {adminMenuItems.filter((item) => item.isAvailable).map((menuItem) => (
                <label key={menuItem.id} className="sold-out-item">
                  <input
                    type="checkbox"
                    checked={menuItem.isSoldOut}
                    disabled={isAlwaysAvailableMenuItem(menuItem)}
                    onChange={(event) => handleSoldOutChange(menuItem, event.target.checked)}
                  />
                  <span>
                    <strong>{menuItem.name}</strong>
                    <small>{menuItem.category}{isAlwaysAvailableMenuItem(menuItem) ? ' / Protected' : ''}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
        )}

        <div className={user.role === 'chef' ? 'layout kitchen-layout' : user.role === 'staff' ? 'layout staff-layout' : 'layout'}>
          {user.role !== 'chef' && (
            user.role === 'staff' ? (
              <form className="panel order-wizard" onSubmit={handleSubmit}>
                <div className="panel-heading">
                  <div>
                    <h2>{editingOrderId ? 'Edit Order' : 'New Order'}</h2>
                    <span className="wizard-context">{getOrderFlowLabel(orderSource, fulfillmentType, tableNumber, partySize, phoneNumber)}</span>
                  </div>
                  <strong>{formatMoney(draftTotal)}</strong>
                </div>

                {staffOrderStep === 'service' && (
                  <div className="wizard-step">
                    <div className="wizard-title">
                      <span>Step 1</span>
                      <h3>Choose service type</h3>
                    </div>
                    <div className="service-choice-grid">
                      <button type="button" onClick={() => startStaffOrder('in_person', 'dine_in')}>
                        <strong>Dine-in</strong>
                        <span>Table order</span>
                      </button>
                      <button type="button" onClick={() => startStaffOrder('in_person', 'to_go')}>
                        <strong>To-go</strong>
                        <span>Walk-in takeout</span>
                      </button>
                      <button type="button" onClick={() => startStaffOrder('phone', 'pickup')}>
                        <strong>Phone pickup</strong>
                        <span>Customer picks up</span>
                      </button>
                      <button type="button" onClick={() => startStaffOrder('phone', 'delivery')}>
                        <strong>Phone delivery</strong>
                        <span>Delivery order</span>
                      </button>
                    </div>
                  </div>
                )}

                {staffOrderStep === 'table' && (
                  <div className="wizard-step">
                    <div className="wizard-title">
                      <span>Step 2</span>
                      <h3>Choose table</h3>
                    </div>
                    <div className="table-grid">
                      {restaurantTables.map((table) => (
                        <button
                          key={table.id}
                          className={`${tableNumber === table.name ? 'selected' : ''} ${table.status}`}
                          disabled={table.status !== 'available' && tableNumber !== table.name}
                          type="button"
                          onClick={() => (table.status === 'available' || tableNumber === table.name) && handleTableSelect(table)}
                        >
                          <strong>{table.name}</strong>
                          <span>{tableStatusLabels[table.status]}</span>
                          <small>{table.capacity} seats</small>
                        </button>
                      ))}
                    </div>
                    {restaurantTables.some((table) => table.status === 'needs_cleaning') && (
                      <div className="cleaning-list">
                        {restaurantTables
                          .filter((table) => table.status === 'needs_cleaning')
                          .map((table) => (
                            <button key={table.id} className="ghost-button" type="button" onClick={() => handleTableCleaned(table)}>
                              {table.name} Cleaned
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="wizard-nav">
                      <button className="ghost-button" type="button" onClick={resetOrderDraft}>Back</button>
                      <button className="primary-button" type="button" onClick={goToStaffPartyStep}>Next</button>
                    </div>
                  </div>
                )}

                {staffOrderStep === 'party' && (
                  <div className="wizard-step">
                    <div className="wizard-title">
                      <span>Step 3</span>
                      <h3>How many guests?</h3>
                      {selectedTable && (
                        <p className="wizard-hint">
                          {selectedTable.name} seats {selectedTable.capacity}. Max {maxPartySize} with extra chairs.
                        </p>
                      )}
                    </div>
                    <div className="party-picker">
                      <button
                        type="button"
                        onClick={() => setPartySize(Math.max(1, Number(partySize) - 1).toString())}
                      >
                        -
                      </button>
                      <strong>{partySize}</strong>
                      <button
                        disabled={Number(partySize) >= maxPartySize}
                        type="button"
                        onClick={() => setPartySize(Math.min(maxPartySize, Number(partySize) + 1).toString())}
                      >
                        +
                      </button>
                    </div>
                    <div className="wizard-nav">
                      <button className="ghost-button" type="button" onClick={() => setStaffOrderStep('table')}>Back</button>
                      <button className="primary-button" type="button" onClick={goToStaffMenuStep}>Next</button>
                    </div>
                  </div>
                )}

                {staffOrderStep === 'phone' && (
                  <div className="wizard-step">
                    <div className="wizard-title">
                      <span>Step 2</span>
                      <h3>Enter phone number</h3>
                    </div>
                    <label>
                      Phone
                      <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
                    </label>
                    <div className="wizard-nav">
                      <button className="ghost-button" type="button" onClick={resetOrderDraft}>Back</button>
                      <button className="primary-button" type="button" onClick={goToStaffMenuStep}>Next</button>
                    </div>
                  </div>
                )}

                {staffOrderStep === 'menu' && (
                  <div className="wizard-menu">
                    <aside className="category-rail">
                      {categories.map((category) => (
                        <button
                          key={category}
                          className={selectedCategory === category ? 'selected' : ''}
                          type="button"
                          onClick={() => setSelectedCategory(category)}
                        >
                          {category}
                        </button>
                      ))}
                    </aside>

                    <div className="wizard-menu-items">
                      {selectedCategory === 'Combos' && menuBundles.map((bundle) => (
                        <button
                          key={bundle.id}
                          className="menu-tile combo-tile"
                          type="button"
                          onClick={() => handleBundleQuantityChange(bundle.id, (selectedBundles[bundle.id] ?? 0) + 1)}
                        >
                          <strong>{bundle.name}</strong>
                          <span>{formatMoney(bundle.priceCents)}</span>
                          <small>{bundle.items.map((item) => item.menuItemName).join(' + ')}</small>
                          {(selectedBundles[bundle.id] ?? 0) > 0 && <em>x{selectedBundles[bundle.id]}</em>}
                        </button>
                      ))}
                      {menuItems
                        .filter((item) => item.category === selectedCategory)
                        .map((item) => (
                          item.variants.map((variant) => (
                            <button
                              key={variant.id}
                              className="menu-tile"
                              type="button"
                              onClick={() => handleMenuQuantityChange(variant.id, (selectedItems[variant.id] ?? 0) + 1)}
                            >
                              <strong>{formatMenuVariantLabel(item, variant)}</strong>
                              <span>{formatMoney(variant.priceCents)}</span>
                              {(selectedItems[variant.id] ?? 0) > 0 && <em>x{selectedItems[variant.id]}</em>}
                            </button>
                          ))
                        ))}
                    </div>

                    <aside className="order-summary">
                      <h3>Order</h3>
                      {draftItems.length === 0 ? (
                        <p>No items selected</p>
                      ) : (
                        <ul>
                          {draftItems.map((item) => {
                            if (item.bundleId) {
                              const bundle = menuBundles.find((candidate) => candidate.id === item.bundleId);

                              return (
                                <li key={item.bundleId}>
                                  <span>{bundle?.name} x {item.quantity}</span>
                                  <div>
                                    <button
                                      type="button"
                                      onClick={() => handleBundleQuantityChange(item.bundleId!, item.quantity - 1)}
                                    >
                                      -
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleBundleQuantityChange(item.bundleId!, item.quantity + 1)}
                                    >
                                      +
                                    </button>
                                  </div>
                                </li>
                              );
                            }

                            const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
                            const variant = item.menuItemVariantId ? getMenuItemVariantById(menuItems, item.menuItemVariantId) : undefined;

                            return (
                              <li key={item.menuItemVariantId}>
                                <span>{menuItem && variant ? formatMenuVariantLabel(menuItem, variant) : menuItem?.name} x {item.quantity}</span>
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => handleMenuQuantityChange(item.menuItemVariantId!, item.quantity - 1)}
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMenuQuantityChange(item.menuItemVariantId!, item.quantity + 1)}
                                  >
                                    +
                                  </button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <label>
                        Notes
                        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
                      </label>
                      <div className="wizard-nav">
                        <button className="ghost-button" type="button" onClick={editingOrderId ? handleCancelEdit : resetOrderDraft}>
                          Cancel
                        </button>
                        <button className="primary-button" disabled={isSubmitting || draftItems.length === 0}>
                          {isSubmitting ? 'Saving...' : editingOrderId ? 'Save Changes' : 'Submit Order'}
                        </button>
                      </div>
                    </aside>
                  </div>
                )}
              </form>
            ) : (
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
                      Service
                      <select value={fulfillmentType} onChange={(event) => setFulfillmentType(event.target.value as FulfillmentType)}>
                        <option value="dine_in">Dine-in</option>
                        <option value="to_go">To-go</option>
                      </select>
                    </label>

                    {fulfillmentType === 'dine_in' && (
                      <>
                        <div className="admin-table-picker">
                          <div className="field-heading">
                            <strong>Table</strong>
                            {selectedTable && (
                              <span>
                                Selected: {selectedTable.name} / {selectedTable.capacity} seats / max {maxPartySize} guests
                              </span>
                            )}
                          </div>
                          <button className="ghost-button" type="button" onClick={() => setIsTablePickerOpen(true)}>
                            {selectedTable ? `Change ${selectedTable.name}` : 'Choose Table'}
                          </button>
                          <input className="hidden-input" value={tableNumber} required readOnly />
                        </div>

                        <label>
                          Party Size
                          <input
                            max={maxPartySize}
                            min="1"
                            type="number"
                            value={partySize}
                            onChange={(event) => setPartySize(event.target.value)}
                            required
                          />
                        </label>
                      </>
                    )}
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
                      {category === 'Combos' && menuBundles.map((bundle) => (
                        <div key={bundle.id} className="menu-row">
                          <div>
                            <strong>{bundle.name}</strong>
                            <span>{formatMoney(bundle.priceCents)} / {bundle.items.map((item) => item.menuItemName).join(' + ')}</span>
                          </div>
                          <input
                            aria-label={`${bundle.name} quantity`}
                            min="0"
                            type="number"
                            value={selectedBundles[bundle.id] ?? 0}
                            onChange={(event) => handleBundleQuantityChange(bundle.id, Number(event.target.value))}
                          />
                        </div>
                      ))}
                      {menuItems
                        .filter((item) => item.category === category)
                        .map((item) => (
                          item.variants.map((variant) => (
                            <div key={variant.id} className="menu-row">
                              <div>
                                <strong>{formatMenuVariantLabel(item, variant)}</strong>
                                <span>{formatMoney(variant.priceCents)}</span>
                              </div>
                              <input
                                aria-label={`${formatMenuVariantLabel(item, variant)} quantity`}
                                min="0"
                                type="number"
                                value={selectedItems[variant.id] ?? 0}
                                onChange={(event) => handleMenuQuantityChange(variant.id, Number(event.target.value))}
                              />
                            </div>
                          ))
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
            )
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
                      status: event.target.value as OrderStatus | 'all' | 'active'
                    }))}
                  >
                    {user.role === 'staff' && <option value="active">Active Orders</option>}
                    {user.role !== 'staff' && <option value="all">All Statuses</option>}
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
                {user.role !== 'staff' && (
                  <>
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
                  </>
                )}
              </div>
              <div className="filter-actions">
                <button className="primary-button">Apply</button>
                <button className="ghost-button" type="button" onClick={handleOrderFilterReset}>
                  Clear
                </button>
              </div>
            </form>

            <div className="metrics">
              <Metric label={user.role === 'staff' ? 'Today Orders' : 'Shown Orders'} value={orders.length.toString()} />
              <Metric label={user.role === 'staff' ? 'Today Active' : 'Shown Active'} value={orders.filter((order) => ['pending', 'preparing', 'ready'].includes(order.status)).length.toString()} />
              <Metric label={user.role === 'staff' ? 'Today Paid' : 'Shown Paid'} value={formatMoney(orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + (order.paymentTotalCents ?? order.totalCents), 0))} />
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
                      <div className="status-stack">
                        <span className={`status ${order.status}`}>{statusLabels[order.status]}</span>
                        <span className={`payment-status ${order.paymentStatus}`}>{order.paymentStatus}</span>
                      </div>
                    </div>

                    <ul>
                      {getVisibleOrderItems(order, user.role).map((item) => (
                        <li key={item.id} className="order-item-row">
                          <div>
                            <span>{formatOrderItemName(item)}</span>
                            <small>{formatMoney(item.priceCents * item.quantity)}{item.paymentId ? ' / Paid' : ''}</small>
                          </div>
                          <div className="order-item-controls">
                            <span className={`status ${item.status}`}>{itemStatusLabels[item.status]}</span>
                            {getAllowedNextItemStatus(item, user.role) && (
                              <button
                                disabled={processingItemActionId === `${item.id}:${getAllowedNextItemStatus(item, user.role)}`}
                                onClick={() => handleItemStatusChange(order, item, getAllowedNextItemStatus(item, user.role)!)}
                              >
                                {getItemActionLabel(item, user.role)}
                              </button>
                            )}
                            {!getAllowedNextItemStatus(item, user.role) && <span className="item-action-spacer" />}
                          </div>
                        </li>
                      ))}
                    </ul>

                    {order.notes && <p className="notes">{order.notes}</p>}

                    <div className="order-actions">
                      <strong>{formatMoney(order.totalCents)}</strong>
                      <div>
                        <button onClick={() => setReceiptOrder(order)}>
                          Receipt
                        </button>
                        {user.role === 'admin' && (
                          <button onClick={() => handleViewHistory(order)}>
                            History
                          </button>
                        )}
                        {canEditOrder(order.status, user.role) && (
                          <button onClick={() => handleEditOrder(order)}>
                            Edit
                          </button>
                        )}
                        {getAllowedNextStatus(order.status, user.role) && (
                          <button
                            disabled={processingOrderActionId === `${order.id}:${getAllowedNextStatus(order.status, user.role)}`}
                            onClick={() => handleStatusChange(order, getAllowedNextStatus(order.status, user.role)!)}
                          >
                            {user.role === 'chef' && order.status === 'pending'
                              ? 'Start'
                              : user.role === 'chef' && order.status === 'preparing'
                                ? 'Mark Done'
                                : statusLabels[getAllowedNextStatus(order.status, user.role)!]}
                          </button>
                        )}
                        {canCancelOrder(order.status, user.role) && (
                          <button
                            className="danger-button"
                            disabled={processingOrderActionId === `${order.id}:cancelled`}
                            onClick={() => handleStatusChange(order, 'cancelled')}
                          >
                            Cancel
                          </button>
                        )}
                        {canCheckoutOrder(order, user.role) && (
                          <button className="primary-button" onClick={() => handleOpenCheckout(order)}>
                            Checkout
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
              <span>{adminMenuItems.length} items / {adminMenuBundles.length} combos</span>
            </div>

            <form className="menu-admin-form" onSubmit={handleCreateMenuItem}>
              <label>
                Item
                <input value={newMenuName} onChange={(event) => setNewMenuName(event.target.value)} required />
              </label>
              <label>
                Category
                <select value={newMenuCategory} onChange={(event) => setNewMenuCategory(event.target.value)}>
                  {menuCategories.filter((category) => category !== 'Combos').map((category) => (
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
                  <div className="menu-admin-name">
                    <strong>{menuItem.name}</strong>
                    {isAlwaysAvailableMenuItem(menuItem) && <span className="protected-label">Protected availability</span>}
                    {menuItem.variants.length > 1 && (
                      <span>{menuItem.variants.map((variant) => `${variant.name} ${formatMoney(variant.priceCents)}`).join(' / ')}</span>
                    )}
                  </div>
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
                    {menuCategories.filter((category) => category !== 'Combos').map((category) => (
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
                      disabled={isAlwaysAvailableMenuItem(menuItem)}
                      onChange={(event) => handleMenuItemUpdate(menuItem, { isAvailable: event.target.checked })}
                    />
                    Available
                  </label>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={menuItem.isSoldOut}
                      disabled={isAlwaysAvailableMenuItem(menuItem)}
                      onChange={(event) => handleSoldOutChange(menuItem, event.target.checked)}
                    />
                    Sold Out
                  </label>
                </article>
              ))}
            </div>

            <div className="combo-management">
              <div className="panel-heading compact-heading">
                <h3>Combos</h3>
                <span>{adminMenuBundles.filter((bundle) => bundle.isAvailable && !bundle.isSoldOut).length} active</span>
              </div>

              <form className="bundle-admin-form" onSubmit={handleCreateMenuBundle}>
                <label>
                  Combo
                  <input value={newBundleName} onChange={(event) => setNewBundleName(event.target.value)} required />
                </label>
                <label>
                  Price
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={newBundlePrice}
                    onChange={(event) => setNewBundlePrice(event.target.value)}
                    required
                  />
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={newBundleAvailable}
                    onChange={(event) => setNewBundleAvailable(event.target.checked)}
                  />
                  Available
                </label>
                <button className="primary-button" disabled={isCreatingMenuBundle}>
                  {isCreatingMenuBundle ? 'Creating...' : 'Create Combo'}
                </button>

                <div className="bundle-component-picker">
                  {adminMenuVariantOptions.map((option) => (
                    <label key={option.menuItemVariantId}>
                      <span>{option.label}</span>
                      <input
                        aria-label={`${option.label} combo quantity`}
                        min="0"
                        type="number"
                        value={newBundleItems[option.menuItemVariantId] ?? 0}
                        onChange={(event) => handleNewBundleItemQuantityChange(option.menuItemVariantId, Number(event.target.value))}
                      />
                    </label>
                  ))}
                </div>
              </form>

              <div className="bundle-admin-list">
                {adminMenuBundles.map((bundle) => (
                  <article key={bundle.id} className="bundle-admin-row">
                    <div className="bundle-admin-main">
                      <div className="menu-admin-name">
                        <strong>{bundle.name}</strong>
                        <div className="bundle-component-summary">
                          {bundle.items.map((item) => (
                            <span
                              key={item.menuItemVariantId}
                              className={!item.isAvailable || item.isSoldOut ? 'component-unavailable' : ''}
                            >
                              {formatMenuBundleItemLabel(item)} x {item.quantity}
                              {!item.isAvailable ? ' / Unavailable' : item.isSoldOut ? ' / Sold out' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                      <input
                        aria-label={`${bundle.name} name`}
                        defaultValue={bundle.name}
                        onBlur={(event) => {
                          if (event.target.value !== bundle.name) {
                            handleMenuBundleUpdate(bundle, { name: event.target.value });
                          }
                        }}
                      />
                      <input
                        aria-label={`${bundle.name} price`}
                        defaultValue={(bundle.priceCents / 100).toFixed(2)}
                        min="0"
                        step="0.01"
                        type="number"
                        onBlur={(event) => {
                          const priceCents = dollarsToCents(event.target.value);
                          if (priceCents !== bundle.priceCents) {
                            handleMenuBundleUpdate(bundle, { priceCents });
                          }
                        }}
                      />
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={bundle.isAvailable}
                          onChange={(event) => handleMenuBundleUpdate(bundle, { isAvailable: event.target.checked })}
                        />
                        Available
                      </label>
                      <label className="toggle-label">
                        <input
                          type="checkbox"
                          checked={bundle.isSoldOut}
                          onChange={(event) => handleBundleSoldOutChange(bundle, event.target.checked)}
                        />
                        Sold Out
                      </label>
                    </div>
                    <div className="bundle-component-grid">
                      {adminMenuVariantOptions.map((option) => (
                        <label key={option.menuItemVariantId}>
                          <span>{option.label}</span>
                          <input
                            aria-label={`${bundle.name} ${option.label} quantity`}
                            defaultValue={getBundleComponentQuantity(bundle, option.menuItemVariantId)}
                            min="0"
                            type="number"
                            onBlur={(event) => {
                              const quantity = Number(event.target.value);
                              if (quantity !== getBundleComponentQuantity(bundle, option.menuItemVariantId)) {
                                handleBundleComponentChange(bundle, option.menuItemVariantId, quantity);
                              }
                            }}
                          />
                        </label>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {user.role === 'admin' && (
          <section className="admin-panel">
            <div className="panel-heading">
              <h2>Table Management</h2>
              <span>{restaurantTables.length} tables</span>
            </div>

            <form className="table-admin-form" onSubmit={handleCreateTable}>
              <label>
                Table
                <input value={newTableName} onChange={(event) => setNewTableName(event.target.value)} required />
              </label>
              <label>
                Seats
                <input
                  min="1"
                  type="number"
                  value={newTableCapacity}
                  onChange={(event) => setNewTableCapacity(event.target.value)}
                  required
                />
              </label>
              <button className="primary-button" disabled={isCreatingTable}>
                {isCreatingTable ? 'Creating...' : 'Create Table'}
              </button>
            </form>

            <div className="table-admin-list">
              {restaurantTables.map((table) => (
                <article key={table.id} className="table-admin-row">
                  <input
                    aria-label={`${table.name} name`}
                    defaultValue={table.name}
                    onBlur={(event) => {
                      if (event.target.value !== table.name) {
                        handleTableUpdate(table, { name: event.target.value });
                      }
                    }}
                  />
                  <input
                    aria-label={`${table.name} capacity`}
                    defaultValue={table.capacity}
                    min="1"
                    type="number"
                    onBlur={(event) => {
                      const capacity = Number(event.target.value);
                      if (capacity !== table.capacity) {
                        handleTableUpdate(table, { capacity });
                      }
                    }}
                  />
                  <select
                    aria-label={`${table.name} status`}
                    value={table.status}
                    onChange={(event) => handleTableUpdate(table, { status: event.target.value as RestaurantTable['status'] })}
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="needs_cleaning">Needs cleaning</option>
                  </select>
                  {isProtectedDefaultTable(table) ? (
                    <span className="protected-label">Protected</span>
                  ) : (
                    <button
                      className="danger-button subtle-button"
                      disabled={table.status === 'occupied'}
                      onClick={() => handleDeleteTable(table)}
                    >
                      Delete
                    </button>
                  )}
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
                    disabled={isProtectedDefaultUser(staffUser)}
                    onChange={(event) => handleStaffRoleChange(staffUser, event.target.value as UserRole)}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="chef">Chef</option>
                  </select>
                  {isProtectedDefaultUser(staffUser) ? (
                    <span className="protected-label">Protected</span>
                  ) : (
                    <>
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
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}
      </section>

      {historyOrder && (
        <div className="modal-backdrop">
          <section className="history-modal" role="dialog" aria-modal="true" aria-label="Order history">
            <div className="panel-heading">
              <div>
                <h2>Order History</h2>
                <span>{getOrderTitle(historyOrder)}</span>
              </div>
              <button className="ghost-button" onClick={() => setHistoryOrder(null)}>
                Close
              </button>
            </div>

            {isLoadingEvents ? (
              <div className="empty-state">Loading history...</div>
            ) : orderEvents.length === 0 ? (
              <div className="empty-state">No history yet</div>
            ) : (
              <ol className="history-list">
                {orderEvents.map((event) => (
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
      )}

      {isTablePickerOpen && (
        <div className="modal-backdrop">
          <section className="history-modal table-picker-modal" role="dialog" aria-modal="true" aria-label="Choose table">
            <div className="panel-heading">
              <div>
                <h2>Choose Table</h2>
                <span>{selectedTable ? `Selected: ${selectedTable.name}` : 'Select an available table'}</span>
              </div>
              <button className="ghost-button" onClick={() => setIsTablePickerOpen(false)}>
                Close
              </button>
            </div>

            <div className="table-grid modal-table-grid">
              {restaurantTables.map((table) => (
                <button
                  key={table.id}
                  className={`${tableNumber === table.name ? 'selected' : ''} ${table.status}`}
                  disabled={table.status !== 'available' && tableNumber !== table.name}
                  type="button"
                  onClick={() => (table.status === 'available' || tableNumber === table.name) && handleTableSelect(table)}
                >
                  <strong>{table.name}</strong>
                  <span>{tableStatusLabels[table.status]}</span>
                  <small>{table.capacity} seats</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {receiptOrder && (
        <div className="modal-backdrop">
          <section className="history-modal receipt-modal" role="dialog" aria-modal="true" aria-label="Receipt preview">
            <div className="panel-heading no-print">
              <div>
                <h2>Receipt</h2>
                <span>{getOrderTitle(receiptOrder)}</span>
              </div>
              <div className="modal-actions">
                <button className="primary-button" onClick={handlePrintReceipt}>
                  Print
                </button>
                <button className="ghost-button" onClick={() => setReceiptOrder(null)}>
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
                <span>Order</span><strong>{receiptOrder.id.slice(0, 8).toUpperCase()}</strong>
                <span>Type</span><strong>{orderSourceLabels[receiptOrder.orderSource]} / {fulfillmentLabels[receiptOrder.fulfillmentType]}</strong>
                <span>{receiptOrder.orderSource === 'phone' ? 'Phone' : 'Table'}</span><strong>{receiptOrder.orderSource === 'phone' ? receiptOrder.phoneNumber : receiptOrder.tableNumber ?? '-'}</strong>
                <span>Server</span><strong>{receiptOrder.serverName}</strong>
                <span>Date</span><strong>{formatDateTime(receiptOrder.createdAt)}</strong>
              </div>

              <ul className="receipt-items">
                {receiptOrder.items.map((item) => (
                  <li key={item.id}>
                    <span>{formatOrderItemName(item)}{item.paymentId ? ' / Paid' : ''}</span>
                    <strong>{formatMoney(item.priceCents * item.quantity)}</strong>
                  </li>
                ))}
              </ul>

              {receiptOrder.notes && <p className="receipt-notes">{receiptOrder.notes}</p>}

              <div className="receipt-totals">
                <span>Subtotal</span><strong>{formatMoney(receiptOrder.paymentSubtotalCents ?? receiptOrder.totalCents)}</strong>
                <span>Tax</span><strong>{formatMoney(receiptOrder.paymentTaxCents ?? 0)}</strong>
                <span>Tip</span><strong>{formatMoney(receiptOrder.paymentTipCents ?? 0)}</strong>
                <span>Total</span><strong>{formatMoney(receiptOrder.paymentTotalCents ?? receiptOrder.totalCents)}</strong>
              </div>

              {receiptOrder.payments.length > 0 && (
                <div className="receipt-payments-list">
                  <strong>Payments</strong>
                  {receiptOrder.payments.map((payment, index) => (
                    <div key={payment.id}>
                      <span>Payment {index + 1} / {payment.paymentMethod}</span>
                      <strong>{formatMoney(payment.totalCents)}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div className="receipt-payment">
                <span className={`payment-status ${receiptOrder.paymentStatus}`}>{receiptOrder.paymentStatus}</span>
                {receiptOrder.paymentMethod && <span>{receiptOrder.paymentMethod}</span>}
                {receiptOrder.paidAt && <span>{formatDateTime(receiptOrder.paidAt)}</span>}
              </div>
            </article>
          </section>
        </div>
      )}

      {checkoutTarget && (
        <div className="modal-backdrop">
          <section className="history-modal checkout-modal" role="dialog" aria-modal="true" aria-label="Checkout order">
            <div className="panel-heading">
              <div>
                <h2>Checkout</h2>
                <span>{getOrderTitle(checkoutTarget)}</span>
              </div>
              <button className="ghost-button" onClick={handleCloseCheckout}>
                Close
              </button>
            </div>

            <form className="checkout-form" onSubmit={handleCheckoutSubmit}>
              <div className="checkout-selection-summary">
                <div>
                  <strong>{activeSplitLabel}</strong>
                  <span>{isActiveAmountSplit ? 'Amount split' : `${checkoutSelectedItemIds.length} of ${checkoutUnpaidItems.length} unpaid items selected`} / {splitBills.filter(isPayableSplitBill).length} split left</span>
                </div>
                <button className="ghost-button" type="button" onClick={handleOpenSplitBill}>
                  Split Bill
                </button>
              </div>

              <ul className="checkout-lines">
                <li><span>Subtotal</span><strong>{formatMoney(checkoutSubtotalCents)}</strong></li>
                <li><span>Tax</span><strong>{formatMoney(checkoutTaxCents)}</strong></li>
                <li>
                  <div className="tip-picker">
                    <span>Tip</span>
                    <div className="tip-presets">
                      {tipPresetOptions.map((percent) => (
                        <button
                          key={percent}
                          className={checkoutTipPreset === percent ? 'selected' : ''}
                          type="button"
                          onClick={() => handleTipPreset(percent)}
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                    <label>
                      Custom
                      <input
                        min="0"
                        step="0.01"
                        type="number"
                        value={checkoutTip}
                        onChange={(event) => {
                          setCheckoutTip(event.target.value);
                          setCheckoutTipPreset('custom');
                        }}
                      />
                    </label>
                  </div>
                  <strong>{formatMoney(checkoutTipCents)}</strong>
                </li>
                <li className="checkout-total"><span>Total</span><strong>{formatMoney(checkoutTotalCents)}</strong></li>
              </ul>

              <label>
                Payment Method
                <select value={checkoutPaymentMethod} onChange={(event) => setCheckoutPaymentMethod(event.target.value as PaymentMethod)}>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                </select>
              </label>

              <button className="primary-button" disabled={isCheckingOut}>
                {isCheckingOut ? 'Processing...' : 'Confirm Payment'}
              </button>
            </form>
          </section>
        </div>
      )}

      {checkoutTarget && isSplitBillOpen && (
        <div className="modal-backdrop split-bill-backdrop">
          <section className="history-modal split-bill-modal" role="dialog" aria-modal="true" aria-label="Split bill">
            <div className="panel-heading">
              <div>
                <h2>Split Bill</h2>
                <span>{getOrderTitle(checkoutTarget)}</span>
              </div>
              <button className="ghost-button" onClick={() => setIsSplitBillOpen(false)}>
                Close
              </button>
            </div>

            <div className="split-bill-workspace">
              <section className="split-bill-groups" aria-label="Current split bills">
                {splitBills.map((splitBill, index) => (
                  <button
                    key={splitBill.id}
                    className={`split-card split-color-${index % 5} ${splitBill.id === activeSplitBillId ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setActiveSplitBillId(splitBill.id)}
                  >
                    <strong>{splitBill.label}</strong>
                    <span>{splitBill.amountCents !== undefined ? 'Amount split' : `${splitBill.itemIds.length} items`}</span>
                    <em>{formatMoney(getSplitBillSubtotal(splitBill, checkoutUnpaidItems))}</em>
                  </button>
                ))}
                <button className="split-add-card" type="button" onClick={handleAddSplitBill}>
                  <span>Add Split</span>
                  <strong>+</strong>
                </button>
              </section>

              <section className="split-item-list" aria-label="Order items">
                <div className="split-order-meta">
                  <span>Selected</span>
                  <strong>{activeSplitBill ? `${activeSplitBill.label} / ${formatMoney(getSplitBillSubtotal(activeSplitBill, checkoutUnpaidItems))}` : '-'}</strong>
                </div>
                {checkoutUnpaidItems.map((item) => {
                  const assignedIndex = splitBills.findIndex((splitBill) => splitBill.amountCents === undefined && splitBill.itemIds.includes(item.id));
                  const isActive = activeSplitBill?.itemIds.includes(item.id) ?? false;

                  return (
                    <button
                      key={item.id}
                      className={`split-item ${assignedIndex >= 0 ? `split-color-${assignedIndex % 5}` : ''} ${isActive ? 'selected' : ''}`}
                      type="button"
                      onClick={() => handleSplitItemClick(item.id)}
                    >
                      <span>{formatOrderItemName(item)}</span>
                      <small>{assignedIndex >= 0 ? splitBills[assignedIndex].label : 'Unassigned'}</small>
                      <strong>{formatMoney(item.priceCents * item.quantity)}</strong>
                    </button>
                  );
                })}
              </section>

              <aside className="split-tools" aria-label="Split tools">
                <button type="button" onClick={() => handleDistributeSplitBills('items')}>Even Items</button>
                <button type="button" onClick={() => handleDistributeSplitBills('amount')}>By Amount</button>
                <button type="button" onClick={() => handleDistributeSplitBills('seats')}>By Seats</button>
                <button type="button" onClick={handleSelectAllForActiveSplit}>Select All</button>
                <button type="button" onClick={handleClearActiveSplit}>Clear</button>
                <button type="button" onClick={handleMergeSplitBills}>Merge</button>
                <button type="button" onClick={handleRemoveActiveSplitBill}>Remove</button>
              </aside>
            </div>

            <div className="split-bill-footer">
              <div>
                <span>Total unpaid</span>
                <strong>{formatMoney(checkoutUnpaidItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0))}</strong>
              </div>
              <div className="modal-actions">
                <button className="ghost-button" onClick={() => setIsSplitBillOpen(false)}>
                  Cancel
                </button>
                <button className="primary-button" onClick={handleApplyActiveSplitBill}>
                  Use Selected Split
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
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

function formatOrderItemName(item: OrderItem) {
  const name = item.variantName === 'Regular' ? item.menuItemName : `${item.menuItemName} / ${item.variantName}`;
  const displayName = item.bundleName ? `${item.bundleName} / ${name}` : name;
  return item.quantity === 1 ? displayName : `${displayName} x ${item.quantity}`;
}

function dollarsToCents(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function centsToDollarsInput(cents: number) {
  return (cents / 100).toFixed(2);
}

function compareMenuItems(left: MenuItem, right: MenuItem) {
  return left.category.localeCompare(right.category) || left.name.localeCompare(right.name);
}

function isProtectedDefaultUser(user: User) {
  return protectedDefaultUserEmails.has(user.email);
}

function isProtectedDefaultTable(table: RestaurantTable) {
  return protectedDefaultTableNames.has(table.name);
}

function isAlwaysAvailableMenuItem(menuItem: MenuItem) {
  return alwaysAvailableMenuItemNames.has(menuItem.name);
}

function compareMenuBundles(left: MenuBundle, right: MenuBundle) {
  return left.name.localeCompare(right.name);
}

function getMenuVariantOptions(menuItems: MenuItem[]) {
  return menuItems
    .filter((item) => item.isAvailable && !item.isSoldOut)
    .flatMap((item) => item.variants.map((variant) => ({
      menuItemVariantId: variant.id,
      label: formatMenuVariantLabel(item, variant),
      category: item.category,
      priceCents: variant.priceCents
    })))
    .sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label));
}

function setBundleItemQuantity(current: Record<string, number>, menuItemVariantId: string, quantity: number) {
  const next = { ...current };
  const normalized = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;

  if (normalized > 0) {
    next[menuItemVariantId] = normalized;
  } else {
    delete next[menuItemVariantId];
  }

  return next;
}

function getBundleItemsInput(items: Record<string, number>) {
  return Object.entries(items)
    .filter(([, quantity]) => quantity > 0)
    .map(([menuItemVariantId, quantity]) => ({ menuItemVariantId, quantity }));
}

function getBundleQuantityMap(menuBundle: MenuBundle) {
  return menuBundle.items.reduce<Record<string, number>>((quantities, item) => {
    quantities[item.menuItemVariantId] = item.quantity;
    return quantities;
  }, {});
}

function getBundleComponentQuantity(menuBundle: MenuBundle, menuItemVariantId: string) {
  return menuBundle.items.find((item) => item.menuItemVariantId === menuItemVariantId)?.quantity ?? 0;
}

function formatMenuBundleItemLabel(item: MenuBundle['items'][number]) {
  return item.variantName === 'Regular' ? item.menuItemName : `${item.menuItemName} / ${item.variantName}`;
}

function compareTables(left: RestaurantTable, right: RestaurantTable) {
  return getTableSortNumber(left.name) - getTableSortNumber(right.name) || left.name.localeCompare(right.name);
}

function getTableSortNumber(name: string) {
  const match = name.match(/\d+/);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

function getNextTableName(tables: RestaurantTable[]) {
  const highest = tables.reduce((max, table) => Math.max(max, getTableSortNumber(table.name)), 0);
  return `T${highest + 1}`;
}

function getOrderTitle(order: Order) {
  if (order.orderSource === 'phone') {
    return `Phone ${order.phoneNumber}`;
  }

  if (order.fulfillmentType === 'to_go') {
    return 'To-go order';
  }

  return `Table ${order.tableNumber} / ${order.partySize} guests`;
}

function getSelectedItemsFromOrder(order: Order) {
  return order.items.reduce<Record<string, number>>((selected, item) => {
    if (item.bundleId) {
      return selected;
    }

    selected[item.menuItemVariantId] = (selected[item.menuItemVariantId] ?? 0) + item.quantity;
    return selected;
  }, {});
}

function getSelectedBundlesFromOrder(order: Order, menuBundles: MenuBundle[]) {
  const componentCounts = order.items.reduce<Record<string, number>>((counts, item) => {
    if (!item.bundleId) {
      return counts;
    }

    counts[item.bundleId] = (counts[item.bundleId] ?? 0) + item.quantity;
    return counts;
  }, {});

  return Object.entries(componentCounts).reduce<Record<string, number>>((selected, [bundleId, componentCount]) => {
    const bundle = menuBundles.find((candidate) => candidate.id === bundleId);
    const componentsPerBundle = bundle?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

    if (componentsPerBundle > 0) {
      selected[bundleId] = Math.max(1, Math.floor(componentCount / componentsPerBundle));
    }

    return selected;
  }, {});
}

function createInitialSplitBills(itemIds: string[]): SplitBill[] {
  return [
    {
      id: 'split-1',
      label: 'Split 1',
      itemIds
    }
  ];
}

function normalizeSplitBillsForUnpaidItems(splitBills: SplitBill[], unpaidItemIds: string[]): SplitBill[] {
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

function getNextSplitBillNumber(splitBills: SplitBill[]) {
  const usedNumbers = splitBills
    .map((splitBill) => splitBill.label.match(/\d+/)?.[0])
    .filter((value): value is string => Boolean(value))
    .map(Number);

  return usedNumbers.length > 0 ? Math.max(...usedNumbers) + 1 : splitBills.length + 1;
}

function getNextPayableSplitBill(splitBills: SplitBill[], paidItemIds: string[]) {
  return splitBills.find((splitBill) => isPayableSplitBill(splitBill) && !arraysHaveSameItems(splitBill.itemIds, paidItemIds))
    ?? splitBills.find(isPayableSplitBill);
}

function isPayableSplitBill(splitBill: SplitBill) {
  return splitBill.itemIds.length > 0 || splitBill.amountCents !== undefined;
}

function arraysHaveSameItems(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
}

function getSplitBillSubtotal(splitBill: SplitBill, items: OrderItem[]) {
  if (splitBill.amountCents !== undefined) {
    return splitBill.amountCents;
  }

  return items
    .filter((item) => splitBill.itemIds.includes(item.id))
    .reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
}

function getMenuItemByVariantId(menuItems: MenuItem[], variantId: string) {
  return menuItems.find((item) => item.variants.some((variant) => variant.id === variantId));
}

function getMenuItemVariantById(menuItems: MenuItem[], variantId: string) {
  return menuItems.flatMap((item) => item.variants).find((variant) => variant.id === variantId);
}

function formatMenuVariantLabel(menuItem: MenuItem, variant: MenuItem['variants'][number]) {
  return variant.name === 'Regular' ? menuItem.name : `${menuItem.name} / ${variant.name}`;
}

function getOrderFlowLabel(
  orderSource: OrderSource,
  fulfillmentType: FulfillmentType,
  tableNumber: string,
  partySize: string,
  phoneNumber: string
) {
  if (orderSource === 'phone') {
    return `${fulfillmentLabels[fulfillmentType]}${phoneNumber ? ` / ${phoneNumber}` : ''}`;
  }

  if (fulfillmentType === 'to_go') {
    return 'Walk-in / To-go';
  }

  return tableNumber ? `${tableNumber} / ${partySize} guests` : 'Dine-in';
}

function formatOrderEvent(event: OrderEvent) {
  if (event.eventType === 'order_created') {
    return 'Order created';
  }

  if (event.eventType === 'order_updated') {
    return 'Order updated';
  }

  if (event.eventType === 'payment_recorded') {
    return `Payment recorded${event.paymentMethod ? ` / ${event.paymentMethod}` : ''}${event.paymentTotalCents ? ` / ${formatMoney(event.paymentTotalCents)}` : ''}`;
  }

  if (event.fromStatus && event.toStatus) {
    return `${statusLabels[event.fromStatus]} -> ${statusLabels[event.toStatus]}`;
  }

  return 'Status changed';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
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

function getVisibleOrderItems(order: Order, role: UserRole) {
  return role === 'chef' ? order.items.filter((item) => item.isKitchenItem) : order.items;
}

function getAllowedNextItemStatus(item: OrderItem, role: UserRole) {
  const status = item.status;

  if (role === 'admin') {
    return itemNextStatus[status];
  }

  if (role === 'chef') {
    if (!item.isKitchenItem) {
      return undefined;
    }

    if (status === 'pending') {
      return 'preparing';
    }

    if (status === 'preparing') {
      return 'ready';
    }
  }

  if (role === 'staff' && !item.isKitchenItem && status === 'pending') {
    return 'served';
  }

  if (role === 'staff' && status === 'ready') {
    return 'served';
  }

  return undefined;
}

const itemNextStatus: Partial<Record<OrderItemStatus, OrderItemStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served'
};

function getItemActionLabel(item: OrderItem, role: UserRole) {
  const status = item.status;
  const next = getAllowedNextItemStatus(item, role);

  if (!next) {
    return '';
  }

  if (role === 'chef' && status === 'pending') {
    return 'Prepare';
  }

  if (role === 'chef' && status === 'preparing') {
    return 'Mark Ready';
  }

  if (role === 'staff' && status === 'ready') {
    return 'Served';
  }

  if (role === 'staff' && !item.isKitchenItem && status === 'pending') {
    return 'Served';
  }

  return itemStatusLabels[next];
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

function canCheckoutOrder(order: Order, role: UserRole) {
  return (role === 'staff' || role === 'admin') && order.status === 'served' && order.paymentStatus !== 'paid';
}

function getDefaultStatusFilter(role?: UserRole, current?: OrderFilterState['status']): OrderFilterState['status'] {
  if (role === 'staff') {
    return current && current !== 'all' ? current : 'active';
  }

  if (role === 'chef') {
    return current && isKitchenStatus(current) ? current : 'all';
  }

  return current ?? 'all';
}

function doesOrderMatchCurrentStatusFilter(order: Order, status: OrderFilterState['status']) {
  if (status === 'all') {
    return true;
  }

  if (status === 'active') {
    return order.status !== 'cancelled' && order.paymentStatus !== 'paid';
  }

  return order.status === status;
}

function getVisibleStatusOptions(role: UserRole) {
  const entries = Object.entries(statusLabels) as Array<[OrderStatus, string]>;

  return role === 'chef'
    ? entries.filter(([status]) => isKitchenStatus(status))
    : entries;
}

function isKitchenStatus(status: OrderStatus | 'all' | 'active') {
  return status === 'all' || status === 'pending' || status === 'preparing';
}

function toOrderApiFilters(filters: OrderFilterState, user: User | null): OrderFilters {
  const isStaffView = user?.role === 'staff';
  const shouldLimitStaffToToday = isStaffView && filters.status !== 'active';
  const today = getTodayDateInputValue();

  return {
    page: filters.page,
    limit: filters.limit,
    ...(filters.status !== 'all' && filters.status !== 'active' ? { status: filters.status } : {}),
    ...(filters.status === 'active' ? { activeOnly: true } : {}),
    ...(filters.tableNumber ? { tableNumber: filters.tableNumber } : {}),
    ...(isStaffView && user ? { serverName: user.name } : filters.serverName ? { serverName: filters.serverName } : {}),
    ...(shouldLimitStaffToToday ? { fromDate: today } : !isStaffView && filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(shouldLimitStaffToToday ? { toDate: today } : !isStaffView && filters.toDate ? { toDate: filters.toDate } : {})
  };
}

function getTodayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default App;

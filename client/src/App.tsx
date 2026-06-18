import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  getOrCreateDeviceId,
  login,
  registerDemoVisitor,
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
import { AppHeader } from './components/AppHeader';
import { AuthScreen } from './components/AuthScreen';
import { CheckoutModal } from './components/CheckoutModal';
import { MenuManagementPanel } from './components/MenuManagementPanel';
import { OrderBoard, type OrderFilterState } from './components/OrderBoard';
import { OrderEntryPanel, type StaffOrderStep } from './components/OrderEntryPanel';
import { OrderHistoryModal } from './components/OrderHistoryModal';
import { ReceiptModal } from './components/ReceiptModal';
import { SoldOutPanel } from './components/SoldOutPanel';
import { StaffManagementPanel } from './components/StaffManagementPanel';
import { TableManagementPanel } from './components/TableManagementPanel';
import { TablePickerModal } from './components/TablePickerModal';
import { useAdminCreateForms } from './hooks/useAdminCreateForms';
import { useAdminFormValidation } from './hooks/useAdminFormValidation';
import { useCheckoutFlow } from './hooks/useCheckoutFlow';
import { useOrderFormValidation } from './hooks/useOrderFormValidation';
import { useRefreshScheduler } from './hooks/useRefreshScheduler';
import {
  dollarsToCents,
  formatDateTime,
  formatMoney
} from './utils/formatters';
import {
  formatOrderItemName,
  getOrderFlowLabel,
  getOrderTitle,
  getSelectedBundlesFromOrder,
  getSelectedItemsFromOrder
} from './utils/orderDraftUtils';
import {
  doesOrderMatchCurrentStatusFilter,
  formatOrderEvent,
  getDefaultStatusFilter,
  toOrderApiFilters
} from './utils/orderFilterUtils';
import {
  compareMenuBundles,
  compareMenuItems,
  formatMenuBundleItemLabel,
  formatMenuVariantLabel,
  getBundleComponentQuantity,
  getBundleItemsInput,
  getBundleQuantityMap,
  getMenuItemByVariantId,
  getMenuItemVariantById,
  getMenuVariantOptions,
  isAlwaysAvailableMenuItem,
  setBundleItemQuantity
} from './utils/menuUtils';
import { getSplitBillSubtotal, isPayableSplitBill } from './utils/splitBillUtils';
import { compareTables, getNextTableName, isProtectedDefaultTable } from './utils/tableUtils';
import { isProtectedDefaultUser } from './utils/userUtils';
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
  RestaurantTable,
  User,
  UserRole
} from './types';

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

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('staff@example.com');
  const [password, setPassword] = useState('Staff123!');
  const [isIntroOpen, setIsIntroOpen] = useState(true);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuBundles, setMenuBundles] = useState<MenuBundle[]>([]);
  const [adminMenuItems, setAdminMenuItems] = useState<MenuItem[]>([]);
  const [adminMenuBundles, setAdminMenuBundles] = useState<MenuBundle[]>([]);
  const [restaurantTables, setRestaurantTables] = useState<RestaurantTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [historyOrder, setHistoryOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
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
  const {
    orderFormErrors,
    clearOrderFormError,
    clearOrderFormErrors,
    validateOrderDraft
  } = useOrderFormValidation();
  const {
    adminFormErrors,
    clearAdminFormError,
    clearAdminFormSection,
    validateStaffForm,
    validateMenuItemForm,
    validateMenuBundleForm,
    validateTableForm
  } = useAdminFormValidation();
  const [selectedCategory, setSelectedCategory] = useState(menuCategories[0]);
  const {
    newStaffName,
    newStaffEmail,
    newStaffPassword,
    newStaffRole,
    newMenuName,
    newMenuCategory,
    newMenuPrice,
    newMenuAvailable,
    newBundleName,
    newBundlePrice,
    newBundleAvailable,
    newBundleItems,
    newTableName,
    newTableCapacity,
    setNewStaffName,
    setNewStaffEmail,
    setNewStaffPassword,
    setNewStaffRole,
    setNewMenuName,
    setNewMenuCategory,
    setNewMenuPrice,
    setNewMenuAvailable,
    setNewBundleName,
    setNewBundlePrice,
    setNewBundleAvailable,
    setNewTableName,
    setNewTableCapacity,
    resetStaffForm,
    resetMenuItemForm,
    resetMenuBundleForm,
    resetTableForm,
    updateNewBundleItemQuantity
  } = useAdminCreateForms();
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
  const {
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
  } = useCheckoutFlow({ taxRate, onError: setError });
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
  const {
    scheduleOrderListRefresh,
    scheduleRealtimeDataRefresh,
    clearScheduledRefreshes
  } = useRefreshScheduler({
    onRefresh: () => {
      loadData(user, orderFilters, { silent: true });
    }
  });

  useEffect(() => {
    loadSession();
    registerVisitor();
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      resetAuthenticatedState();
      setError('Your session expired. Please sign in again.');
    }

    window.addEventListener('restaurant-ops:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('restaurant-ops:unauthorized', handleUnauthorized);
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
      resetAuthenticatedState();
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function registerVisitor() {
    try {
      const result = await registerDemoVisitor(getOrCreateDeviceId());
      setVisitorCount(result.visitorCount);
    } catch {
      setVisitorCount(null);
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

  function resetAuthenticatedState() {
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
    resetCheckoutState();
    setReceiptOrder(null);
    setOrderEvents([]);
    setSelectedItems({});
    setSelectedBundles({});
    setServerName('');
    clearScheduledRefreshes();
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
    resetAuthenticatedState();
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

  const filteredOrders = orders;
  const selectedTable = useMemo(() => {
    return restaurantTables.find((table) => table.name === tableNumber);
  }, [restaurantTables, tableNumber]);
  const maxPartySize = selectedTable ? selectedTable.capacity + extraChairsAllowed : 99;
  const adminMenuVariantOptions = useMemo(() => getMenuVariantOptions(adminMenuItems), [adminMenuItems]);

  function handleOrderSourceChange(source: OrderSource) {
    setOrderSource(source);
    setFulfillmentType(source === 'in_person' ? 'dine_in' : 'pickup');
    clearOrderFormErrors();
  }

  function validateCurrentOrderDraft(requireItems: boolean) {
    return validateOrderDraft({
      fulfillmentType,
      orderSource,
      tableNumber,
      partySize,
      phoneNumber,
      serverName,
      itemCount: draftItems.length,
      maxPartySize,
      selectedTableCapacity: selectedTable?.capacity,
      requireItems
    });
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
    clearOrderFormErrors();
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
    clearOrderFormErrors();
  }

  function goToStaffPartyStep() {
    if (!validateCurrentOrderDraft(false)) {
      return;
    }

    setPartySize((current) => Math.min(Number(current), maxPartySize).toString());
    setError(null);
    setStaffOrderStep('party');
  }

  function goToStaffMenuStep() {
    if (!validateCurrentOrderDraft(false)) {
      return;
    }

    setError(null);
    setStaffOrderStep('menu');
  }

  function handleMenuQuantityChange(menuItemVariantId: string, quantity: number) {
    clearOrderFormError('items');
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
    clearOrderFormError('items');
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
    clearOrderFormError('tableNumber');
    clearOrderFormError('partySize');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateCurrentOrderDraft(true)) {
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
      clearOrderFormErrors();
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
    clearOrderFormErrors();
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
    openCheckout(order);
  }

  function handlePrintReceipt() {
    document.body.classList.add('printing-receipt');
    window.print();
    window.setTimeout(() => document.body.classList.remove('printing-receipt'), 0);
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
      resetTip();

      if (updated.paymentStatus === 'paid') {
        completePaidCheckout(updated.id);
      } else {
        continueSplitCheckout(updated);
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

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validateStaffForm({
      name: newStaffName,
      email: newStaffEmail,
      password: newStaffPassword
    })) {
      return;
    }

    try {
      setIsCreatingStaff(true);
      const created = await createStaffUser({
        name: newStaffName,
        email: newStaffEmail,
        password: newStaffPassword,
        role: newStaffRole
      });
      setStaffUsers((current) => [created, ...current]);
      resetStaffForm();
      clearAdminFormSection('staff');
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

    if (!validateMenuItemForm({
      name: newMenuName,
      price: newMenuPrice
    })) {
      return;
    }

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
      resetMenuItemForm();
      clearAdminFormSection('menuItem');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create menu item');
    } finally {
      setIsCreatingMenuItem(false);
    }
  }

  function handleNewBundleItemQuantityChange(menuItemVariantId: string, quantity: number) {
    clearAdminFormError('menuBundle', 'items');
    updateNewBundleItemQuantity(menuItemVariantId, quantity);
  }

  async function handleCreateMenuBundle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const items = getBundleItemsInput(newBundleItems);

    if (!validateMenuBundleForm({
      name: newBundleName,
      price: newBundlePrice,
      items: newBundleItems
    })) {
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
      resetMenuBundleForm();
      clearAdminFormSection('menuBundle');
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

    if (!validateTableForm({
      name: newTableName,
      capacity: newTableCapacity
    })) {
      return;
    }

    try {
      setIsCreatingTable(true);
      const created = await createTable({
        name: newTableName,
        capacity: Number(newTableCapacity)
      });
      setRestaurantTables((current) => [...current, created].sort(compareTables));
      resetTableForm(getNextTableName([...restaurantTables, created]));
      clearAdminFormSection('table');
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
      <AuthScreen
        email={email}
        password={password}
        isIntroOpen={isIntroOpen}
        visitorCount={visitorCount}
        error={error}
        isLoggingIn={isLoggingIn}
        isLoading={isLoading}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onLogin={handleLogin}
        onOpenIntro={() => setIsIntroOpen(true)}
        onCloseIntro={() => setIsIntroOpen(false)}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <AppHeader user={user} isLoading={isLoading} onRefresh={() => loadData()} onLogout={handleLogout} />

        {error && <div className="alert">{error}</div>}

        {user.role === 'chef' && (
          <SoldOutPanel
            menuItems={adminMenuItems}
            isAlwaysAvailableMenuItem={isAlwaysAvailableMenuItem}
            onSoldOutChange={handleSoldOutChange}
          />
        )}

        <div className={user.role === 'chef' ? 'layout kitchen-layout' : user.role === 'staff' ? 'layout staff-layout' : 'layout'}>
          {user.role !== 'chef' && (
            <OrderEntryPanel
              role={user.role}
              editingOrderId={editingOrderId}
              staffOrderStep={staffOrderStep}
              orderSource={orderSource}
              fulfillmentType={fulfillmentType}
              tableNumber={tableNumber}
              partySize={partySize}
              phoneNumber={phoneNumber}
              serverName={serverName}
              notes={notes}
              selectedCategory={selectedCategory}
              selectedItems={selectedItems}
              selectedBundles={selectedBundles}
              categories={categories}
              menuItems={menuItems}
              menuBundles={menuBundles}
              restaurantTables={restaurantTables}
              selectedTable={selectedTable}
              tableStatusLabels={tableStatusLabels}
              draftItems={draftItems}
              draftTotal={draftTotal}
              maxPartySize={maxPartySize}
              formErrors={orderFormErrors}
              isSubmitting={isSubmitting}
              formatMoney={formatMoney}
              formatMenuVariantLabel={formatMenuVariantLabel}
              getMenuItemVariantById={getMenuItemVariantById}
              getOrderFlowLabel={getOrderFlowLabel}
              onSubmit={handleSubmit}
              onStartStaffOrder={startStaffOrder}
              onOrderSourceChange={handleOrderSourceChange}
              onFulfillmentTypeChange={(nextFulfillmentType) => {
                setFulfillmentType(nextFulfillmentType);
                clearOrderFormErrors();
              }}
              onTableSelect={handleTableSelect}
              onTableCleaned={handleTableCleaned}
              onOpenTablePicker={() => setIsTablePickerOpen(true)}
              onPartySizeChange={(value) => {
                setPartySize(value);
                clearOrderFormError('partySize');
              }}
              onPhoneNumberChange={(value) => {
                setPhoneNumber(value);
                clearOrderFormError('phoneNumber');
              }}
              onServerNameChange={(value) => {
                setServerName(value);
                clearOrderFormError('serverName');
              }}
              onNotesChange={setNotes}
              onSelectedCategoryChange={setSelectedCategory}
              onStaffOrderStepChange={setStaffOrderStep}
              onResetOrderDraft={resetOrderDraft}
              onGoToStaffPartyStep={goToStaffPartyStep}
              onGoToStaffMenuStep={goToStaffMenuStep}
              onMenuQuantityChange={handleMenuQuantityChange}
              onBundleQuantityChange={handleBundleQuantityChange}
              onCancelEdit={handleCancelEdit}
            />
          )}

          <OrderBoard
            role={user.role}
            orders={orders}
            filteredOrders={filteredOrders}
            filters={orderFilters}
            pagination={orderPagination}
            isLoading={isLoading}
            processingOrderActionId={processingOrderActionId}
            processingItemActionId={processingItemActionId}
            formatMoney={formatMoney}
            formatOrderItemName={formatOrderItemName}
            getOrderTitle={getOrderTitle}
            onFiltersChange={setOrderFilters}
            onFilterSubmit={handleOrderFilterSubmit}
            onFilterReset={handleOrderFilterReset}
            onPageChange={handlePageChange}
            onReceipt={setReceiptOrder}
            onHistory={handleViewHistory}
            onEdit={handleEditOrder}
            onOrderStatusChange={handleStatusChange}
            onItemStatusChange={handleItemStatusChange}
            onCheckout={handleOpenCheckout}
          />
        </div>

        {user.role === 'admin' && (
          <MenuManagementPanel
            menuCategories={menuCategories}
            menuItems={adminMenuItems}
            menuBundles={adminMenuBundles}
            menuVariantOptions={adminMenuVariantOptions}
            newMenuName={newMenuName}
            newMenuCategory={newMenuCategory}
            newMenuPrice={newMenuPrice}
            newMenuAvailable={newMenuAvailable}
            newBundleName={newBundleName}
            newBundlePrice={newBundlePrice}
            newBundleAvailable={newBundleAvailable}
            newBundleItems={newBundleItems}
            menuItemErrors={adminFormErrors.menuItem ?? {}}
            menuBundleErrors={adminFormErrors.menuBundle ?? {}}
            isCreatingMenuItem={isCreatingMenuItem}
            isCreatingMenuBundle={isCreatingMenuBundle}
            formatMoney={formatMoney}
            dollarsToCents={dollarsToCents}
            formatMenuBundleItemLabel={formatMenuBundleItemLabel}
            getBundleComponentQuantity={getBundleComponentQuantity}
            isAlwaysAvailableMenuItem={isAlwaysAvailableMenuItem}
            onCreateMenuItem={handleCreateMenuItem}
            onCreateMenuBundle={handleCreateMenuBundle}
            onNewMenuNameChange={(value) => {
              setNewMenuName(value);
              clearAdminFormError('menuItem', 'name');
            }}
            onNewMenuCategoryChange={setNewMenuCategory}
            onNewMenuPriceChange={(value) => {
              setNewMenuPrice(value);
              clearAdminFormError('menuItem', 'price');
            }}
            onNewMenuAvailableChange={setNewMenuAvailable}
            onNewBundleNameChange={(value) => {
              setNewBundleName(value);
              clearAdminFormError('menuBundle', 'name');
            }}
            onNewBundlePriceChange={(value) => {
              setNewBundlePrice(value);
              clearAdminFormError('menuBundle', 'price');
            }}
            onNewBundleAvailableChange={setNewBundleAvailable}
            onNewBundleItemQuantityChange={handleNewBundleItemQuantityChange}
            onMenuItemUpdate={handleMenuItemUpdate}
            onMenuItemSoldOutChange={handleSoldOutChange}
            onMenuBundleUpdate={handleMenuBundleUpdate}
            onMenuBundleSoldOutChange={handleBundleSoldOutChange}
            onBundleComponentChange={handleBundleComponentChange}
          />
        )}

        {user.role === 'admin' && (
          <TableManagementPanel
            tables={restaurantTables}
            newTableName={newTableName}
            newTableCapacity={newTableCapacity}
            errors={adminFormErrors.table ?? {}}
            isCreatingTable={isCreatingTable}
            isProtectedDefaultTable={isProtectedDefaultTable}
            onCreateTable={handleCreateTable}
            onNewTableNameChange={(value) => {
              setNewTableName(value);
              clearAdminFormError('table', 'name');
            }}
            onNewTableCapacityChange={(value) => {
              setNewTableCapacity(value);
              clearAdminFormError('table', 'capacity');
            }}
            onTableUpdate={handleTableUpdate}
            onDeleteTable={handleDeleteTable}
          />
        )}

        {user.role === 'admin' && (
          <StaffManagementPanel
            currentUser={user}
            staffUsers={staffUsers}
            newStaffName={newStaffName}
            newStaffEmail={newStaffEmail}
            newStaffPassword={newStaffPassword}
            newStaffRole={newStaffRole}
            errors={adminFormErrors.staff ?? {}}
            isCreatingStaff={isCreatingStaff}
            isProtectedDefaultUser={isProtectedDefaultUser}
            onCreateStaff={handleCreateStaff}
            onNewStaffNameChange={(value) => {
              setNewStaffName(value);
              clearAdminFormError('staff', 'name');
            }}
            onNewStaffEmailChange={(value) => {
              setNewStaffEmail(value);
              clearAdminFormError('staff', 'email');
            }}
            onNewStaffPasswordChange={(value) => {
              setNewStaffPassword(value);
              clearAdminFormError('staff', 'password');
            }}
            onNewStaffRoleChange={setNewStaffRole}
            onStaffRoleChange={handleStaffRoleChange}
            onStaffActiveChange={handleStaffActiveChange}
            onDeleteStaff={handleDeleteStaff}
          />
        )}
      </section>

      {historyOrder && (
        <OrderHistoryModal
          order={historyOrder}
          events={orderEvents}
          isLoading={isLoadingEvents}
          getOrderTitle={getOrderTitle}
          formatOrderEvent={formatOrderEvent}
          formatDateTime={formatDateTime}
          onClose={() => setHistoryOrder(null)}
        />
      )}

      {isTablePickerOpen && (
        <TablePickerModal
          tables={restaurantTables}
          tableNumber={tableNumber}
          selectedTable={selectedTable}
          tableStatusLabels={tableStatusLabels}
          onSelect={handleTableSelect}
          onClose={() => setIsTablePickerOpen(false)}
        />
      )}

      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          orderSourceLabels={orderSourceLabels}
          fulfillmentLabels={fulfillmentLabels}
          formatMoney={formatMoney}
          formatOrderItemName={formatOrderItemName}
          formatDateTime={formatDateTime}
          getOrderTitle={getOrderTitle}
          onPrint={handlePrintReceipt}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {checkoutTarget && (
        <CheckoutModal
          order={checkoutTarget}
          isSplitBillOpen={isSplitBillOpen}
          splitBills={splitBills}
          activeSplitBill={activeSplitBill}
          activeSplitBillId={activeSplitBillId}
          activeSplitLabel={activeSplitLabel}
          isActiveAmountSplit={isActiveAmountSplit}
          selectedItemIds={checkoutSelectedItemIds}
          unpaidItems={checkoutUnpaidItems}
          paymentMethod={checkoutPaymentMethod}
          tip={checkoutTip}
          tipPreset={checkoutTipPreset}
          tipPresetOptions={tipPresetOptions}
          subtotalCents={checkoutSubtotalCents}
          taxCents={checkoutTaxCents}
          tipCents={checkoutTipCents}
          totalCents={checkoutTotalCents}
          isCheckingOut={isCheckingOut}
          formatMoney={formatMoney}
          formatOrderItemName={formatOrderItemName}
          getOrderTitle={getOrderTitle}
          getSplitBillSubtotal={getSplitBillSubtotal}
          isPayableSplitBill={isPayableSplitBill}
          onCloseCheckout={closeCheckout}
          onSubmitCheckout={handleCheckoutSubmit}
          onOpenSplitBill={handleOpenSplitBill}
          onCloseSplitBill={() => setIsSplitBillOpen(false)}
          onTipPreset={handleTipPreset}
          onTipChange={handleTipChange}
          onPaymentMethodChange={setCheckoutPaymentMethod}
          onActiveSplitBillChange={setActiveSplitBillId}
          onAddSplitBill={handleAddSplitBill}
          onSplitItemClick={handleSplitItemClick}
          onDistributeSplitBills={handleDistributeSplitBills}
          onSelectAllForActiveSplit={handleSelectAllForActiveSplit}
          onClearActiveSplit={handleClearActiveSplit}
          onMergeSplitBills={handleMergeSplitBills}
          onRemoveActiveSplitBill={handleRemoveActiveSplitBill}
          onApplyActiveSplitBill={handleApplyActiveSplitBill}
        />
      )}
    </main>
  );
}

export default App;

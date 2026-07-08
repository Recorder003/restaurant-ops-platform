import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { createOrder, updateOrder } from '../api';
import type { StaffOrderStep } from '../components/OrderEntryPanel';
import type {
  DraftItem,
  FulfillmentType,
  MenuBundle,
  MenuItem,
  Order,
  OrderSource,
  RestaurantTable,
  User
} from '../types';
import {
  getSelectedBundlesFromOrder,
  getSelectedItemsFromOrder
} from '../utils/orderDraftUtils';
import {
  getMenuItemByVariantId,
  getMenuItemVariantById
} from '../utils/menuUtils';
import { useOrderFormValidation } from './useOrderFormValidation';

type UseOrderDraftOptions = {
  user: User | null;
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  restaurantTables: RestaurantTable[];
  extraChairsAllowed: number;
  onSaved: () => Promise<void>;
  onError: (message: string | null) => void;
};

export function useOrderDraft({
  user,
  menuItems,
  menuBundles,
  restaurantTables,
  extraChairsAllowed,
  onSaved,
  onError
}: UseOrderDraftOptions) {
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [isTablePickerOpen, setIsTablePickerOpen] = useState(false);
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
  const [selectedCategory, setSelectedCategory] = useState('Combos');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    orderFormErrors,
    clearOrderFormError,
    clearOrderFormErrors,
    validateOrderDraft
  } = useOrderFormValidation();

  const categories = useMemo(() => Array.from(new Set([
    ...(menuBundles.length > 0 ? ['Combos'] : []),
    ...menuItems.map((item) => item.category)
  ])), [menuBundles, menuItems]);

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const draftItems: DraftItem[] = useMemo(() => {
    const itemDrafts = Object.entries(selectedItems)
      .filter(([, quantity]) => quantity > 0)
      .map(([menuItemVariantId, quantity]) => ({
        menuItemId: getMenuItemByVariantId(menuItems, menuItemVariantId)?.id ?? '',
        menuItemVariantId,
        quantity
      }))
      .filter((item) => item.menuItemId);
    const bundleDrafts = Object.entries(selectedBundles)
      .filter(([, quantity]) => quantity > 0)
      .map(([bundleId, quantity]) => ({ bundleId, quantity }));

    return [...itemDrafts, ...bundleDrafts];
  }, [selectedBundles, selectedItems, menuItems]);

  const draftTotal = useMemo(() => draftItems.reduce((total, item) => {
    if (item.bundleId) {
      const bundle = menuBundles.find((candidate) => candidate.id === item.bundleId);
      return total + (bundle?.priceCents ?? 0) * item.quantity;
    }

    const variant = item.menuItemVariantId
      ? getMenuItemVariantById(menuItems, item.menuItemVariantId)
      : undefined;
    return total + (variant?.priceCents ?? 0) * item.quantity;
  }, 0), [draftItems, menuBundles, menuItems]);

  const selectedTable = useMemo(
    () => restaurantTables.find((table) => table.name === tableNumber),
    [restaurantTables, tableNumber]
  );
  const maxPartySize = selectedTable ? selectedTable.capacity + extraChairsAllowed : 99;

  function initializeForUser(nextUser: User) {
    setServerName(nextUser.name);
  }

  function handleOrderSourceChange(source: OrderSource) {
    setOrderSource(source);
    setFulfillmentType(source === 'in_person' ? 'dine_in' : 'pickup');
    clearOrderFormErrors();
  }

  function handleFulfillmentTypeChange(value: FulfillmentType) {
    setFulfillmentType(value);
    clearOrderFormErrors();
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
    setIsTablePickerOpen(false);
    clearOrderFormErrors();
  }

  function startStaffOrder(source: OrderSource, fulfillment: FulfillmentType) {
    resetOrderDraft();
    setOrderSource(source);
    setFulfillmentType(fulfillment);
    setStaffOrderStep(fulfillment === 'dine_in' ? 'table' : source === 'phone' ? 'phone' : 'menu');
  }

  function goToStaffPartyStep() {
    if (!validateCurrentOrderDraft(false)) {
      return;
    }

    setPartySize((current) => Math.min(Number(current), maxPartySize).toString());
    onError(null);
    setStaffOrderStep('party');
  }

  function goToStaffMenuStep() {
    if (!validateCurrentOrderDraft(false)) {
      return;
    }

    onError(null);
    setStaffOrderStep('menu');
  }

  function handleMenuQuantityChange(menuItemVariantId: string, quantity: number) {
    clearOrderFormError('items');
    setSelectedItems((current) => updateQuantity(current, menuItemVariantId, quantity));
  }

  function handleBundleQuantityChange(bundleId: string, quantity: number) {
    clearOrderFormError('items');
    setSelectedBundles((current) => updateQuantity(current, bundleId, quantity));
  }

  function removeSelectedBundle(bundleId: string) {
    setSelectedBundles((current) => updateQuantity(current, bundleId, 0));
  }

  function removeSelectedItemVariants(variantIds: string[]) {
    setSelectedItems((current) => {
      const next = { ...current };
      variantIds.forEach((variantId) => delete next[variantId]);
      return next;
    });
  }

  function retainSelectedBundles(availableBundleIds: string[]) {
    const availableIds = new Set(availableBundleIds);
    setSelectedBundles((current) => Object.fromEntries(
      Object.entries(current).filter(([bundleId]) => availableIds.has(bundleId))
    ));
  }

  function handleTableSelect(table: RestaurantTable) {
    setTableNumber(table.name);
    setPartySize((current) => Math.min(Number(current), table.capacity + extraChairsAllowed).toString());
    setIsTablePickerOpen(false);
    clearOrderFormError('tableNumber');
    clearOrderFormError('partySize');
  }

  function handlePartySizeChange(value: string) {
    setPartySize(value);
    clearOrderFormError('partySize');
  }

  function handlePhoneNumberChange(value: string) {
    setPhoneNumber(value);
    clearOrderFormError('phoneNumber');
  }

  function handleServerNameChange(value: string) {
    setServerName(value);
    clearOrderFormError('serverName');
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
      await onSaved();
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to save order');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditOrder(order: Order) {
    if (order.status !== 'pending') {
      onError('Only pending orders can be edited');
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
    onError(null);
  }

  function handleCancelEdit() {
    resetOrderDraft();
    onError(null);
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

  return {
    editingOrderId,
    isTablePickerOpen,
    selectedItems,
    selectedBundles,
    orderSource,
    fulfillmentType,
    tableNumber,
    partySize,
    phoneNumber,
    serverName,
    notes,
    staffOrderStep,
    selectedCategory,
    categories,
    draftItems,
    draftTotal,
    selectedTable,
    maxPartySize,
    orderFormErrors,
    isSubmitting,
    setNotes,
    setSelectedCategory,
    setStaffOrderStep,
    initializeForUser,
    openTablePicker: () => setIsTablePickerOpen(true),
    closeTablePicker: () => setIsTablePickerOpen(false),
    handleOrderSourceChange,
    handleFulfillmentTypeChange,
    resetOrderDraft,
    startStaffOrder,
    goToStaffPartyStep,
    goToStaffMenuStep,
    handleMenuQuantityChange,
    handleBundleQuantityChange,
    removeSelectedBundle,
    removeSelectedItemVariants,
    retainSelectedBundles,
    handleTableSelect,
    handlePartySizeChange,
    handlePhoneNumberChange,
    handleServerNameChange,
    handleSubmit,
    handleEditOrder,
    handleCancelEdit
  };
}

function updateQuantity(current: Record<string, number>, id: string, quantity: number) {
  const next = { ...current };

  if (quantity > 0) {
    next[id] = quantity;
  } else {
    delete next[id];
  }

  return next;
}

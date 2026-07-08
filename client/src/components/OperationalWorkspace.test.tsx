import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OperationalWorkspace } from './OperationalWorkspace';
import type { useAdminManagement } from '../hooks/useAdminManagement';
import type { useCheckoutFlow } from '../hooks/useCheckoutFlow';
import type { useOrderBoard } from '../hooks/useOrderBoard';
import type { useOrderDocuments } from '../hooks/useOrderDocuments';
import type { useOrderDraft } from '../hooks/useOrderDraft';
import {
  createAdminUser,
  createMenuItem,
  createOrder,
  createRestaurantTable,
  createStaffUser
} from '../test/factories';
import { renderWithAppProviders } from '../test/render';
import type { MenuBundle, User } from '../types';

const staffUser = createStaffUser();
const adminUser = createAdminUser();
const menuItem = createMenuItem();
const table = createRestaurantTable();

describe('OperationalWorkspace', () => {
  it('renders staff ordering and order board actions from composed state', async () => {
    const onRefresh = vi.fn();
    const openCheckout = vi.fn();
    const orderBoard = mockOrderBoard({ filteredOrders: [mockOrder()], orders: [mockOrder()] });
    const checkout = mockCheckout({ openCheckout });

    renderWorkspace({ user: staffUser, orderBoard, checkout, onRefresh });

    expect(screen.getByRole('heading', { name: 'New Order' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Order Board' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Checkout' }));
    expect(openCheckout).toHaveBeenCalledWith(orderBoard.filteredOrders[0]);
  });

  it('renders admin management sections for admins', () => {
    renderWorkspace({ user: adminUser });

    expect(screen.getByRole('heading', { name: 'Menu Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Table Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Staff Management' })).toBeInTheDocument();
  });
});

function renderWorkspace(overrides: Partial<RenderWorkspaceOptions> = {}) {
  const user = overrides.user ?? staffUser;
  return renderWithAppProviders(
    <OperationalWorkspace
      user={user}
      error={overrides.error ?? null}
      isLoading={false}
      isSessionLoading={false}
      menuItems={[menuItem]}
      menuBundles={[]}
      adminMenuItems={[menuItem]}
      adminMenuBundles={[]}
      restaurantTables={[table]}
      staffUsers={[adminUser, staffUser]}
      orderBoard={overrides.orderBoard ?? mockOrderBoard()}
      orderDraft={overrides.orderDraft ?? mockOrderDraft()}
      documents={overrides.documents ?? mockDocuments()}
      checkout={overrides.checkout ?? mockCheckout()}
      adminManagement={overrides.adminManagement ?? mockAdminManagement()}
      onRefresh={overrides.onRefresh ?? vi.fn()}
    />,
    { authSession: { user, email: user.email, isIntroOpen: false, visitorCount: 1 } }
  );
}

function mockOrder() {
  return createOrder() as ReturnType<typeof useOrderBoard>['filteredOrders'][number];
}

function mockOrderBoard(overrides: Partial<ReturnType<typeof useOrderBoard>> = {}) {
  const noop = vi.fn();
  return {
    orders: [],
    filteredOrders: [],
    filters: { status: 'active', tableNumber: '', serverName: '', fromDate: '', toDate: '' },
    pagination: { page: 1, limit: 8, total: 0, totalPages: 0 },
    isLoadingOrders: false,
    processingOrderActionId: null,
    processingItemActionId: null,
    setFilters: noop,
    applyOrderList: noop,
    clearOrders: noop,
    prepareFiltersForRole: vi.fn(),
    updateOrderInList: noop,
    handleStatusChange: noop,
    handleItemStatusChange: noop,
    handleFilterSubmit: noop,
    handleFilterReset: noop,
    handlePageChange: noop,
    ...overrides
  } as unknown as ReturnType<typeof useOrderBoard>;
}

function mockOrderDraft(overrides: Partial<ReturnType<typeof useOrderDraft>> = {}) {
  const noop = vi.fn();
  return {
    editingOrderId: null,
    isTablePickerOpen: false,
    selectedItems: {},
    selectedBundles: {},
    orderSource: 'in_person',
    fulfillmentType: 'dine_in',
    tableNumber: '',
    partySize: '2',
    phoneNumber: '',
    serverName: 'Kent',
    notes: '',
    staffOrderStep: 'service',
    selectedCategory: 'Entrees',
    categories: ['Entrees'],
    draftItems: [],
    draftTotal: 0,
    selectedTable: undefined,
    maxPartySize: undefined,
    orderFormErrors: {},
    isSubmitting: false,
    setNotes: noop,
    setSelectedCategory: noop,
    setStaffOrderStep: noop,
    initializeForUser: noop,
    openTablePicker: noop,
    closeTablePicker: noop,
    handleOrderSourceChange: noop,
    handleFulfillmentTypeChange: noop,
    resetOrderDraft: noop,
    startStaffOrder: noop,
    goToStaffPartyStep: noop,
    goToStaffMenuStep: noop,
    handleMenuQuantityChange: noop,
    handleBundleQuantityChange: noop,
    removeSelectedBundle: noop,
    removeSelectedItemVariants: noop,
    retainSelectedBundles: noop,
    handleTableSelect: noop,
    handlePartySizeChange: noop,
    handlePhoneNumberChange: noop,
    handleServerNameChange: noop,
    handleSubmit: noop,
    handleEditOrder: noop,
    handleCancelEdit: noop,
    ...overrides
  } as unknown as ReturnType<typeof useOrderDraft>;
}

function mockDocuments(overrides: Partial<ReturnType<typeof useOrderDocuments>> = {}) {
  const noop = vi.fn();
  return {
    historyOrder: null,
    receiptOrder: null,
    orderEvents: [],
    isLoadingEvents: false,
    openHistory: noop,
    closeHistory: noop,
    openReceipt: noop,
    closeReceipt: noop,
    printReceipt: noop,
    resetDocuments: noop,
    ...overrides
  } as unknown as ReturnType<typeof useOrderDocuments>;
}

function mockCheckout(overrides: Partial<ReturnType<typeof useCheckoutFlow>> = {}) {
  const noop = vi.fn();
  return {
    openCheckout: noop,
    ...overrides
  } as unknown as ReturnType<typeof useCheckoutFlow>;
}

function mockAdminManagement(overrides: Partial<ReturnType<typeof useAdminManagement>> = {}) {
  const noop = vi.fn();
  return {
    adminForms: {
      newStaffName: '', newStaffEmail: 'test@example.com', newStaffPassword: '', newStaffRole: 'staff',
      newMenuName: '', newMenuCategory: 'Entrees', newMenuPrice: '12.00', newMenuAvailable: true,
      newBundleName: '', newBundlePrice: '23.80', newBundleAvailable: true, newBundleItems: {},
      newTableName: 'T13', newTableCapacity: '4',
      setNewStaffName: noop, setNewStaffEmail: noop, setNewStaffPassword: noop, setNewStaffRole: noop,
      setNewMenuName: noop, setNewMenuCategory: noop, setNewMenuPrice: noop, setNewMenuAvailable: noop,
      setNewBundleName: noop, setNewBundlePrice: noop, setNewBundleAvailable: noop,
      setNewTableName: noop, setNewTableCapacity: noop,
      resetStaffForm: noop, resetMenuItemForm: noop, resetMenuBundleForm: noop,
      resetTableForm: noop, updateNewBundleItemQuantity: noop
    },
    adminValidation: {
      adminFormErrors: {}, clearAdminFormError: noop, clearAdminFormSection: noop,
      validateStaffForm: vi.fn(), validateMenuItemForm: vi.fn(), validateMenuBundleForm: vi.fn(), validateTableForm: vi.fn()
    },
    staffManagement: { isCreatingStaff: false, handleCreateStaff: noop, handleStaffRoleChange: noop, handleStaffActiveChange: noop, handleDeleteStaff: noop },
    tableManagement: { isCreatingTable: false, handleCreateTable: noop, handleTableUpdate: noop, handleDeleteTable: noop, handleTableCleaned: noop },
    menuManagement: {
      isCreatingMenuItem: false, isCreatingMenuBundle: false, handleCreateMenuItem: noop,
      handleNewBundleItemQuantityChange: noop, handleCreateMenuBundle: noop, handleMenuBundleUpdate: noop,
      handleBundleSoldOutChange: noop, handleBundleComponentChange: noop,
      handleMenuItemUpdate: noop, handleSoldOutChange: noop
    },
    handleTableCleaned: noop,
    handleSoldOutChange: noop,
    ...overrides
  } as unknown as ReturnType<typeof useAdminManagement>;
}

type RenderWorkspaceOptions = {
  user: User;
  error: string | null;
  orderBoard: ReturnType<typeof useOrderBoard>;
  orderDraft: ReturnType<typeof useOrderDraft>;
  documents: ReturnType<typeof useOrderDocuments>;
  checkout: ReturnType<typeof useCheckoutFlow>;
  adminManagement: ReturnType<typeof useAdminManagement>;
  onRefresh: () => void;
};

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminWorkspaceSection } from './AdminWorkspaceSection';
import { ChefToolsSection } from './ChefToolsSection';
import { OrderBoardSection } from './OrderBoardSection';
import { getWorkspaceLayoutClassName } from './workspaceLayout';
import type { useAdminManagement } from '../../hooks/useAdminManagement';
import type { useCheckoutFlow } from '../../hooks/useCheckoutFlow';
import type { useOrderBoard } from '../../hooks/useOrderBoard';
import type { useOrderDocuments } from '../../hooks/useOrderDocuments';
import type { useOrderDraft } from '../../hooks/useOrderDraft';
import {
  createAdminUser,
  createMenuItem,
  createOrder,
  createOrderItem,
  createRestaurantTable,
  createStaffUser
} from '../../test/factories';

const adminUser = createAdminUser();
const staffUser = createStaffUser();
const table = createRestaurantTable();
const menuItem = createMenuItem({ name: 'Fried Rice', category: 'Entrees', isSoldOut: false });

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api');

  return {
    ...actual,
    fetchAdminManagerDashboard: vi.fn(async () => ({
      generatedAt: '2026-07-19T16:30:00.000Z',
      metrics: {
        orderCount: 0,
        activeOrderCount: 0,
        cancelledCount: 0,
        paidOrderCount: 0,
        unpaidOrderCount: 0,
        paidRevenueCents: 0,
        averagePaidOrderCents: 0,
        dineInCount: 0,
        toGoCount: 0,
        phoneOrderCount: 0,
        activeOver20MinCount: 0
      },
      topItems: [],
      statusCounts: [],
      kitchenQueue: []
    }))
  };
});

describe('workspace sections', () => {
  it('wires chef sold-out toggles to admin management', async () => {
    const user = userEvent.setup();
    const handleSoldOutChange = vi.fn();

    render(
      <ChefToolsSection
        menuItems={[menuItem]}
        adminManagement={mockAdminManagement({ handleSoldOutChange })}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: /Fried Rice/ }));

    expect(handleSoldOutChange).toHaveBeenCalledWith(menuItem, true);
  });

  it('renders admin management from the admin workspace section', () => {
    render(
      <AdminWorkspaceSection
        currentUser={adminUser}
        menuItems={[menuItem]}
        menuBundles={[]}
        restaurantTables={[table]}
        staffUsers={[adminUser, staffUser]}
        adminManagement={mockAdminManagement()}
        dataRefreshVersion={0}
      />
    );

    expect(screen.getByRole('heading', { name: 'Menu Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Table Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Staff Management' })).toBeInTheDocument();
  });

  it('wires order board actions to composed controllers', async () => {
    const user = userEvent.setup();
    const handleFilterSubmit = vi.fn((event) => event.preventDefault());
    const handlePageChange = vi.fn();
    const openReceipt = vi.fn();
    const openCheckout = vi.fn();
    const servedOrder = createOrder({
      status: 'served',
      paymentStatus: 'unpaid',
      totalCents: 1200,
      items: [createOrderItem({ status: 'served' })]
    });

    render(
      <OrderBoardSection
        role="staff"
        isLoading={false}
        orderBoard={mockOrderBoard({
          orders: [servedOrder],
          filteredOrders: [servedOrder],
          pagination: { page: 1, limit: 8, total: 1, totalPages: 2 },
          handleFilterSubmit,
          handlePageChange
        })}
        orderDraft={mockOrderDraft()}
        documents={mockDocuments({ openReceipt })}
        checkout={mockCheckout({ openCheckout })}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    await user.click(screen.getByRole('button', { name: 'Receipt' }));
    await user.click(screen.getByRole('button', { name: 'Checkout' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(handleFilterSubmit).toHaveBeenCalledOnce();
    expect(openReceipt).toHaveBeenCalledWith(servedOrder);
    expect(openCheckout).toHaveBeenCalledWith(servedOrder);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('returns role-specific workspace layout classes', () => {
    expect(getWorkspaceLayoutClassName('chef')).toBe('layout kitchen-layout');
    expect(getWorkspaceLayoutClassName('staff')).toBe('layout staff-layout');
    expect(getWorkspaceLayoutClassName('admin')).toBe('layout');
  });
});

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
  return {
    handleEditOrder: vi.fn(),
    ...overrides
  } as unknown as ReturnType<typeof useOrderDraft>;
}

function mockDocuments(overrides: Partial<ReturnType<typeof useOrderDocuments>> = {}) {
  return {
    openReceipt: vi.fn(),
    openHistory: vi.fn(),
    ...overrides
  } as unknown as ReturnType<typeof useOrderDocuments>;
}

function mockCheckout(overrides: Partial<ReturnType<typeof useCheckoutFlow>> = {}) {
  return {
    openCheckout: vi.fn(),
    ...overrides
  } as unknown as ReturnType<typeof useCheckoutFlow>;
}

function mockAdminManagement(overrides: Partial<ReturnType<typeof useAdminManagement>> = {}) {
  const noop = vi.fn();

  return {
    adminForms: {
      newStaffName: '',
      newStaffEmail: 'test@example.com',
      newStaffPassword: '',
      newStaffRole: 'staff',
      newMenuName: '',
      newMenuCategory: 'Entrees',
      newMenuPrice: '12.00',
      newMenuAvailable: true,
      newBundleName: '',
      newBundlePrice: '23.80',
      newBundleAvailable: true,
      newBundleItems: {},
      newTableName: 'T13',
      newTableCapacity: '4',
      setNewStaffName: noop,
      setNewStaffEmail: noop,
      setNewStaffPassword: noop,
      setNewStaffRole: noop,
      setNewMenuName: noop,
      setNewMenuCategory: noop,
      setNewMenuPrice: noop,
      setNewMenuAvailable: noop,
      setNewBundleName: noop,
      setNewBundlePrice: noop,
      setNewBundleAvailable: noop,
      setNewTableName: noop,
      setNewTableCapacity: noop,
      resetStaffForm: noop,
      resetMenuItemForm: noop,
      resetMenuBundleForm: noop,
      resetTableForm: noop,
      updateNewBundleItemQuantity: noop
    },
    adminValidation: {
      adminFormErrors: {},
      clearAdminFormError: noop,
      clearAdminFormSection: noop,
      validateStaffForm: vi.fn(() => true),
      validateMenuItemForm: vi.fn(() => true),
      validateMenuBundleForm: vi.fn(() => true),
      validateTableForm: vi.fn(() => true)
    },
    menuManagement: {
      isCreatingMenuItem: false,
      isCreatingMenuBundle: false,
      handleCreateMenuItem: noop,
      handleNewBundleItemQuantityChange: noop,
      handleCreateMenuBundle: noop,
      handleMenuBundleUpdate: noop,
      handleBundleSoldOutChange: noop,
      handleBundleComponentChange: noop,
      handleMenuItemUpdate: noop,
      handleSoldOutChange: noop
    },
    tableManagement: {
      isCreatingTable: false,
      handleCreateTable: noop,
      handleTableUpdate: noop,
      handleDeleteTable: noop,
      handleTableCleaned: noop
    },
    staffManagement: {
      isCreatingStaff: false,
      handleCreateStaff: noop,
      handleStaffRoleChange: noop,
      handleStaffActiveChange: noop,
      handleDeleteStaff: noop
    },
    handleTableCleaned: noop,
    handleSoldOutChange: noop,
    ...overrides
  } as unknown as ReturnType<typeof useAdminManagement>;
}

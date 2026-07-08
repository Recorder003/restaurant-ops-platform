import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminManagementSections } from './AdminManagementSections';
import type { useAdminCreateForms } from '../hooks/useAdminCreateForms';
import type { useAdminFormValidation } from '../hooks/useAdminFormValidation';
import type { useMenuManagement } from '../hooks/useMenuManagement';
import type { useStaffManagement } from '../hooks/useStaffManagement';
import type { useTableManagement } from '../hooks/useTableManagement';
import { createAdminUser, createMenuItem } from '../test/factories';

const adminUser = createAdminUser();
const menuItem = createMenuItem();

describe('AdminManagementSections', () => {
  it('renders all admin management panels and wires form field changes', () => {
    const setNewMenuName = vi.fn();
    const setNewTableName = vi.fn();
    const setNewStaffName = vi.fn();
    const clearAdminFormError = vi.fn();

    render(<AdminManagementSections
      currentUser={adminUser}
      adminForms={mockAdminForms({ setNewMenuName, setNewTableName, setNewStaffName })}
      adminValidation={mockAdminValidation({ clearAdminFormError })}
      menuManagement={mockMenuManagement()}
      tableManagement={mockTableManagement()}
      staffManagement={mockStaffManagement()}
      menuItems={[menuItem]}
      menuBundles={[]}
      tables={[]}
      staffUsers={[adminUser]}
    />);

    expect(screen.getByRole('heading', { name: 'Menu Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Table Management' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Staff Management' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Item/), { target: { value: 'Soup' } });
    expect(setNewMenuName).toHaveBeenCalledWith('Soup');
    expect(clearAdminFormError).toHaveBeenCalledWith('menuItem', 'name');

    fireEvent.change(screen.getByLabelText(/Table/), { target: { value: 'T14' } });
    expect(setNewTableName).toHaveBeenCalledWith('T14');
    expect(clearAdminFormError).toHaveBeenCalledWith('table', 'name');

    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Sam' } });
    expect(setNewStaffName).toHaveBeenCalledWith('Sam');
    expect(clearAdminFormError).toHaveBeenCalledWith('staff', 'name');
  });
});

function mockAdminForms(overrides: Partial<ReturnType<typeof useAdminCreateForms>> = {}) {
  const noop = vi.fn();
  return {
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
    updateNewBundleItemQuantity: noop,
    ...overrides
  } as unknown as ReturnType<typeof useAdminCreateForms>;
}

function mockAdminValidation(overrides: Partial<ReturnType<typeof useAdminFormValidation>> = {}) {
  const noop = vi.fn();
  return {
    adminFormErrors: {},
    clearAdminFormError: noop,
    clearAdminFormSection: noop,
    validateStaffForm: vi.fn(() => true),
    validateMenuItemForm: vi.fn(() => true),
    validateMenuBundleForm: vi.fn(() => true),
    validateTableForm: vi.fn(() => true),
    ...overrides
  } as unknown as ReturnType<typeof useAdminFormValidation>;
}

function mockMenuManagement(overrides: Partial<ReturnType<typeof useMenuManagement>> = {}) {
  const noop = vi.fn();
  return {
    isCreatingMenuItem: false,
    isCreatingMenuBundle: false,
    handleCreateMenuItem: noop,
    handleNewBundleItemQuantityChange: noop,
    handleCreateMenuBundle: noop,
    handleMenuBundleUpdate: noop,
    handleBundleSoldOutChange: noop,
    handleBundleComponentChange: noop,
    handleMenuItemUpdate: noop,
    handleSoldOutChange: noop,
    ...overrides
  } as unknown as ReturnType<typeof useMenuManagement>;
}

function mockTableManagement(overrides: Partial<ReturnType<typeof useTableManagement>> = {}) {
  const noop = vi.fn();
  return {
    isCreatingTable: false,
    handleCreateTable: noop,
    handleTableUpdate: noop,
    handleDeleteTable: noop,
    handleTableCleaned: noop,
    ...overrides
  } as unknown as ReturnType<typeof useTableManagement>;
}

function mockStaffManagement(overrides: Partial<ReturnType<typeof useStaffManagement>> = {}) {
  const noop = vi.fn();
  return {
    isCreatingStaff: false,
    handleCreateStaff: noop,
    handleStaffRoleChange: noop,
    handleStaffActiveChange: noop,
    handleDeleteStaff: noop,
    ...overrides
  } as unknown as ReturnType<typeof useStaffManagement>;
}

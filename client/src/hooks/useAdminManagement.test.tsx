import { act, renderHook } from '@testing-library/react';
import type { FormEvent, SetStateAction } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminManagement } from './useAdminManagement';
import { useStaffManagement } from './useStaffManagement';
import { useTableManagement } from './useTableManagement';
import { createAdminUser, createRestaurantTable, createStaffUser } from '../test/factories';
import { applyLastMockStateUpdate, applyMockStateUpdate } from '../test/state';

const api = vi.hoisted(() => ({
  createStaffUser: vi.fn(), deleteStaffUser: vi.fn(), updateStaffUser: vi.fn(),
  createTable: vi.fn(), deleteTable: vi.fn(), updateTable: vi.fn(),
  createMenuBundle: vi.fn(), createMenuItem: vi.fn(), fetchMenuBundles: vi.fn(),
  updateMenuBundle: vi.fn(), updateMenuBundleSoldOut: vi.fn(),
  updateMenuItem: vi.fn(), updateMenuItemSoldOut: vi.fn()
}));
vi.mock('../api', () => api);

const admin = createAdminUser({ id: 'u1' });
const defaultTable = createRestaurantTable({ id: 't1' });
const staff = createStaffUser({ id: 'u4', name: 'Taylor', email: 'taylor@example.com' });
const customTable = createRestaurantTable({ id: 't13', name: 'T13' });
const submitEvent = () => ({ preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin management guards', () => {
  it('composes admin form state, validation, and resource management hooks', async () => {
    const setStaffUsers = vi.fn();
    const setTables = vi.fn();
    const clearError = vi.fn();
    api.createStaffUser.mockResolvedValue(staff);
    api.createTable.mockResolvedValue(customTable);

    const { result } = renderHook(() => useAdminManagement({
      user: admin,
      staffUsers: [admin],
      setStaffUsers,
      tables: [defaultTable],
      setTables,
      setMenuItems: vi.fn(),
      setMenuBundles: vi.fn(),
      setAdminMenuItems: vi.fn(),
      setAdminMenuBundles: vi.fn(),
      removeSelectedBundle: vi.fn(),
      removeSelectedItemVariants: vi.fn(),
      retainSelectedBundles: vi.fn(),
      onError: clearError
    }));

    act(() => {
      result.current.adminForms.setNewStaffName('Taylor');
      result.current.adminForms.setNewStaffEmail('taylor@example.com');
      result.current.adminForms.setNewStaffPassword('Password1!');
      result.current.adminForms.setNewTableName('T13');
      result.current.adminForms.setNewTableCapacity('6');
    });

    await act(async () => result.current.staffManagement.handleCreateStaff(submitEvent()));
    await act(async () => result.current.tableManagement.handleCreateTable(submitEvent()));

    expect(api.createStaffUser).toHaveBeenCalledWith({
      name: 'Taylor',
      email: 'taylor@example.com',
      password: 'Password1!',
      role: 'staff'
    });
    expect(api.createTable).toHaveBeenCalledWith({ name: 'T13', capacity: 6 });
    expect(result.current.handleTableCleaned).toBe(result.current.tableManagement.handleTableCleaned);
    expect(result.current.handleSoldOutChange).toBe(result.current.menuManagement.handleSoldOutChange);
  });

  it('prevents role changes for protected demo users', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useStaffManagement({
      staffUsers: [admin], setStaffUsers: vi.fn(), newStaffName: '', newStaffEmail: '',
      newStaffPassword: '', newStaffRole: 'staff', validateStaffForm: vi.fn(),
      resetStaffForm: vi.fn(), clearStaffErrors: vi.fn(), onError
    }));

    await act(async () => result.current.handleStaffRoleChange(admin, 'staff'));
    expect(api.updateStaffUser).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Default demo account roles cannot be changed');
  });

  it('creates staff after validation and prepends it to local state', async () => {
    const setStaffUsers = vi.fn();
    const resetStaffForm = vi.fn();
    const clearStaffErrors = vi.fn();
    const onError = vi.fn();
    api.createStaffUser.mockResolvedValue(staff);
    const { result } = renderHook(() => useStaffManagement({
      staffUsers: [admin], setStaffUsers, newStaffName: 'Taylor', newStaffEmail: 'taylor@example.com',
      newStaffPassword: 'Password1!', newStaffRole: 'staff', validateStaffForm: vi.fn(() => true),
      resetStaffForm, clearStaffErrors, onError
    }));

    await act(async () => result.current.handleCreateStaff(submitEvent()));

    expect(api.createStaffUser).toHaveBeenCalledWith({
      name: 'Taylor', email: 'taylor@example.com', password: 'Password1!', role: 'staff'
    });
    expect(applyMockStateUpdate(setStaffUsers, [admin])).toEqual([staff, admin]);
    expect(resetStaffForm).toHaveBeenCalledOnce();
    expect(clearStaffErrors).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('does not create staff when validation fails', async () => {
    const { result } = renderHook(() => useStaffManagement({
      staffUsers: [], setStaffUsers: vi.fn(), newStaffName: '', newStaffEmail: '', newStaffPassword: '',
      newStaffRole: 'staff', validateStaffForm: vi.fn(() => false), resetStaffForm: vi.fn(),
      clearStaffErrors: vi.fn(), onError: vi.fn()
    }));

    await act(async () => result.current.handleCreateStaff(submitEvent()));
    expect(api.createStaffUser).not.toHaveBeenCalled();
  });

  it('updates and deletes regular staff while respecting delete confirmation', async () => {
    const setStaffUsers = vi.fn();
    const onError = vi.fn();
    api.updateStaffUser.mockResolvedValue({ ...staff, isActive: false });
    api.deleteStaffUser.mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { result } = renderHook(() => useStaffManagement({
      staffUsers: [staff], setStaffUsers, newStaffName: '', newStaffEmail: '', newStaffPassword: '',
      newStaffRole: 'staff', validateStaffForm: vi.fn(), resetStaffForm: vi.fn(),
      clearStaffErrors: vi.fn(), onError
    }));

    await act(async () => result.current.handleStaffActiveChange(staff, false));
    expect(applyMockStateUpdate(setStaffUsers, [staff])).toEqual([{ ...staff, isActive: false }]);

    await act(async () => result.current.handleDeleteStaff(staff));
    expect(api.deleteStaffUser).not.toHaveBeenCalled();
    await act(async () => result.current.handleDeleteStaff(staff));
    expect(api.deleteStaffUser).toHaveBeenCalledWith(staff.id);
    expect(applyLastMockStateUpdate(setStaffUsers, [staff])).toEqual([]);
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('prevents deletion of protected default tables', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useTableManagement({
      tables: [defaultTable], setTables: vi.fn(), newTableName: '', newTableCapacity: '4',
      validateTableForm: vi.fn(), resetTableForm: vi.fn(), clearTableErrors: vi.fn(), onError
    }));

    await act(async () => result.current.handleDeleteTable(defaultTable));
    expect(api.deleteTable).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Default restaurant tables cannot be deleted');
  });

  it('creates a table, sorts the list, and resets to the next table name', async () => {
    const setTables = vi.fn();
    const resetTableForm = vi.fn();
    api.createTable.mockResolvedValue(customTable);
    const { result } = renderHook(() => useTableManagement({
      tables: [defaultTable], setTables, newTableName: 'T13', newTableCapacity: '6',
      validateTableForm: vi.fn(() => true), resetTableForm, clearTableErrors: vi.fn(), onError: vi.fn()
    }));

    await act(async () => result.current.handleCreateTable(submitEvent()));

    expect(api.createTable).toHaveBeenCalledWith({ name: 'T13', capacity: 6 });
    expect(applyMockStateUpdate(setTables, [defaultTable])).toEqual([defaultTable, customTable]);
    expect(resetTableForm).toHaveBeenCalledWith('T14');
  });

  it('updates, cleans, and deletes a custom table', async () => {
    const setTables = vi.fn();
    const onError = vi.fn();
    const renamed = { ...customTable, name: 'Patio' };
    const cleaned = { ...customTable, status: 'available' as const };
    api.updateTable.mockResolvedValueOnce(renamed).mockResolvedValueOnce(cleaned);
    api.deleteTable.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => useTableManagement({
      tables: [customTable], setTables, newTableName: '', newTableCapacity: '4',
      validateTableForm: vi.fn(), resetTableForm: vi.fn(), clearTableErrors: vi.fn(), onError
    }));

    await act(async () => result.current.handleTableUpdate(customTable, { name: 'Patio' }));
    expect(applyMockStateUpdate(setTables, [customTable])).toEqual([renamed]);
    await act(async () => result.current.handleTableCleaned(customTable));
    expect(api.updateTable).toHaveBeenLastCalledWith(customTable.id, { status: 'available' });
    await act(async () => result.current.handleDeleteTable(customTable));
    expect(api.deleteTable).toHaveBeenCalledWith(customTable.id);
    expect(applyLastMockStateUpdate(setTables, [customTable])).toEqual([]);
    expect(onError).toHaveBeenLastCalledWith(null);
  });

  it('reports API failures without mutating staff state', async () => {
    const setStaffUsers = vi.fn();
    const onError = vi.fn();
    api.updateStaffUser.mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useStaffManagement({
      staffUsers: [staff], setStaffUsers, newStaffName: '', newStaffEmail: '', newStaffPassword: '',
      newStaffRole: 'staff', validateStaffForm: vi.fn(), resetStaffForm: vi.fn(),
      clearStaffErrors: vi.fn(), onError
    }));

    await act(async () => result.current.handleStaffRoleChange(staff, 'chef'));
    expect(setStaffUsers).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Network unavailable');
  });
});

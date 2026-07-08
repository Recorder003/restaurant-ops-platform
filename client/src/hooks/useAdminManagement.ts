import type { Dispatch, SetStateAction } from 'react';
import { useAdminCreateForms } from './useAdminCreateForms';
import { useAdminFormValidation } from './useAdminFormValidation';
import { useMenuManagement } from './useMenuManagement';
import { useStaffManagement } from './useStaffManagement';
import { useTableManagement } from './useTableManagement';
import type { MenuBundle, MenuItem, RestaurantTable, User } from '../types';

type UseAdminManagementOptions = {
  user: User | null;
  staffUsers: User[];
  setStaffUsers: Dispatch<SetStateAction<User[]>>;
  tables: RestaurantTable[];
  setTables: Dispatch<SetStateAction<RestaurantTable[]>>;
  setMenuItems: Dispatch<SetStateAction<MenuItem[]>>;
  setMenuBundles: Dispatch<SetStateAction<MenuBundle[]>>;
  setAdminMenuItems: Dispatch<SetStateAction<MenuItem[]>>;
  setAdminMenuBundles: Dispatch<SetStateAction<MenuBundle[]>>;
  removeSelectedBundle: (id: string) => void;
  removeSelectedItemVariants: (ids: string[]) => void;
  retainSelectedBundles: (ids: string[]) => void;
  onError: (message: string | null) => void;
};

export function useAdminManagement({
  user,
  staffUsers,
  setStaffUsers,
  tables,
  setTables,
  setMenuItems,
  setMenuBundles,
  setAdminMenuItems,
  setAdminMenuBundles,
  removeSelectedBundle,
  removeSelectedItemVariants,
  retainSelectedBundles,
  onError
}: UseAdminManagementOptions) {
  const adminValidation = useAdminFormValidation();
  const adminForms = useAdminCreateForms();

  const staffManagement = useStaffManagement({
    staffUsers,
    setStaffUsers,
    newStaffName: adminForms.newStaffName,
    newStaffEmail: adminForms.newStaffEmail,
    newStaffPassword: adminForms.newStaffPassword,
    newStaffRole: adminForms.newStaffRole,
    validateStaffForm: adminValidation.validateStaffForm,
    resetStaffForm: adminForms.resetStaffForm,
    clearStaffErrors: () => adminValidation.clearAdminFormSection('staff'),
    onError
  });

  const tableManagement = useTableManagement({
    tables,
    setTables,
    newTableName: adminForms.newTableName,
    newTableCapacity: adminForms.newTableCapacity,
    validateTableForm: adminValidation.validateTableForm,
    resetTableForm: adminForms.resetTableForm,
    clearTableErrors: () => adminValidation.clearAdminFormSection('table'),
    onError
  });

  const menuManagement = useMenuManagement({
    user,
    setMenuItems,
    setMenuBundles,
    setAdminMenuItems,
    setAdminMenuBundles,
    form: {
      name: adminForms.newMenuName,
      category: adminForms.newMenuCategory,
      price: adminForms.newMenuPrice,
      available: adminForms.newMenuAvailable,
      bundleName: adminForms.newBundleName,
      bundlePrice: adminForms.newBundlePrice,
      bundleAvailable: adminForms.newBundleAvailable,
      bundleItems: adminForms.newBundleItems
    },
    validateItem: adminValidation.validateMenuItemForm,
    validateBundle: adminValidation.validateMenuBundleForm,
    resetItem: adminForms.resetMenuItemForm,
    resetBundle: adminForms.resetMenuBundleForm,
    clearSection: adminValidation.clearAdminFormSection,
    clearBundleItemsError: () => adminValidation.clearAdminFormError('menuBundle', 'items'),
    updateNewBundleQuantity: adminForms.updateNewBundleItemQuantity,
    removeSelectedBundle,
    removeSelectedItemVariants,
    retainSelectedBundles,
    onError
  });

  return {
    adminForms,
    adminValidation,
    staffManagement,
    tableManagement,
    menuManagement,
    handleTableCleaned: tableManagement.handleTableCleaned,
    handleSoldOutChange: menuManagement.handleSoldOutChange
  };
}

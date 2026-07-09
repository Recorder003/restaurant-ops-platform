import { useMemo } from 'react';
import { menuCategories } from '../config/appConfig';
import type { useAdminCreateForms } from '../hooks/useAdminCreateForms';
import type { useAdminFormValidation } from '../hooks/useAdminFormValidation';
import type { useMenuManagement } from '../hooks/useMenuManagement';
import type { useStaffManagement } from '../hooks/useStaffManagement';
import type { useTableManagement } from '../hooks/useTableManagement';
import { useAdminDailySummary } from '../hooks/useAdminDailySummary';
import type { MenuBundle, MenuItem, RestaurantTable, User } from '../types';
import { dollarsToCents, formatMoney } from '../utils/formatters';
import {
  formatMenuBundleItemLabel,
  getBundleComponentQuantity,
  getMenuVariantOptions,
  isAlwaysAvailableMenuItem
} from '../utils/menuUtils';
import { isProtectedDefaultTable } from '../utils/tableUtils';
import { isProtectedDefaultUser } from '../utils/userUtils';
import { AdminDailySummaryPanel } from './AdminDailySummaryPanel';
import { MenuManagementPanel } from './MenuManagementPanel';
import { StaffManagementPanel } from './StaffManagementPanel';
import { TableManagementPanel } from './TableManagementPanel';

type AdminManagementSectionsProps = {
  currentUser: User;
  adminForms: ReturnType<typeof useAdminCreateForms>;
  adminValidation: ReturnType<typeof useAdminFormValidation>;
  menuManagement: ReturnType<typeof useMenuManagement>;
  tableManagement: ReturnType<typeof useTableManagement>;
  staffManagement: ReturnType<typeof useStaffManagement>;
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  tables: RestaurantTable[];
  staffUsers: User[];
};

export function AdminManagementSections({
  currentUser,
  adminForms,
  adminValidation,
  menuManagement,
  tableManagement,
  staffManagement,
  menuItems,
  menuBundles,
  tables,
  staffUsers
}: AdminManagementSectionsProps) {
  const menuVariantOptions = useMemo(() => getMenuVariantOptions(menuItems), [menuItems]);
  const adminDailySummary = useAdminDailySummary();

  return (
    <>
      <AdminDailySummaryPanel
        dailySummary={adminDailySummary.dailySummary}
        error={adminDailySummary.dailySummaryError}
        isLoading={adminDailySummary.isLoadingDailySummary}
        onGenerate={adminDailySummary.loadDailySummary}
      />

      <MenuManagementPanel
        menuCategories={menuCategories}
        menuItems={menuItems}
        menuBundles={menuBundles}
        menuVariantOptions={menuVariantOptions}
        newMenuName={adminForms.newMenuName}
        newMenuCategory={adminForms.newMenuCategory}
        newMenuPrice={adminForms.newMenuPrice}
        newMenuAvailable={adminForms.newMenuAvailable}
        newBundleName={adminForms.newBundleName}
        newBundlePrice={adminForms.newBundlePrice}
        newBundleAvailable={adminForms.newBundleAvailable}
        newBundleItems={adminForms.newBundleItems}
        menuItemErrors={adminValidation.adminFormErrors.menuItem ?? {}}
        menuBundleErrors={adminValidation.adminFormErrors.menuBundle ?? {}}
        isCreatingMenuItem={menuManagement.isCreatingMenuItem}
        isCreatingMenuBundle={menuManagement.isCreatingMenuBundle}
        formatMoney={formatMoney}
        dollarsToCents={dollarsToCents}
        formatMenuBundleItemLabel={formatMenuBundleItemLabel}
        getBundleComponentQuantity={getBundleComponentQuantity}
        isAlwaysAvailableMenuItem={isAlwaysAvailableMenuItem}
        onCreateMenuItem={menuManagement.handleCreateMenuItem}
        onCreateMenuBundle={menuManagement.handleCreateMenuBundle}
        onNewMenuNameChange={(value) => {
          adminForms.setNewMenuName(value);
          adminValidation.clearAdminFormError('menuItem', 'name');
        }}
        onNewMenuCategoryChange={adminForms.setNewMenuCategory}
        onNewMenuPriceChange={(value) => {
          adminForms.setNewMenuPrice(value);
          adminValidation.clearAdminFormError('menuItem', 'price');
        }}
        onNewMenuAvailableChange={adminForms.setNewMenuAvailable}
        onNewBundleNameChange={(value) => {
          adminForms.setNewBundleName(value);
          adminValidation.clearAdminFormError('menuBundle', 'name');
        }}
        onNewBundlePriceChange={(value) => {
          adminForms.setNewBundlePrice(value);
          adminValidation.clearAdminFormError('menuBundle', 'price');
        }}
        onNewBundleAvailableChange={adminForms.setNewBundleAvailable}
        onNewBundleItemQuantityChange={menuManagement.handleNewBundleItemQuantityChange}
        onMenuItemUpdate={menuManagement.handleMenuItemUpdate}
        onMenuItemSoldOutChange={menuManagement.handleSoldOutChange}
        onMenuBundleUpdate={menuManagement.handleMenuBundleUpdate}
        onMenuBundleSoldOutChange={menuManagement.handleBundleSoldOutChange}
        onBundleComponentChange={menuManagement.handleBundleComponentChange}
      />

      <TableManagementPanel
        tables={tables}
        newTableName={adminForms.newTableName}
        newTableCapacity={adminForms.newTableCapacity}
        errors={adminValidation.adminFormErrors.table ?? {}}
        isCreatingTable={tableManagement.isCreatingTable}
        isProtectedDefaultTable={isProtectedDefaultTable}
        onCreateTable={tableManagement.handleCreateTable}
        onNewTableNameChange={(value) => {
          adminForms.setNewTableName(value);
          adminValidation.clearAdminFormError('table', 'name');
        }}
        onNewTableCapacityChange={(value) => {
          adminForms.setNewTableCapacity(value);
          adminValidation.clearAdminFormError('table', 'capacity');
        }}
        onTableUpdate={tableManagement.handleTableUpdate}
        onDeleteTable={tableManagement.handleDeleteTable}
      />

      <StaffManagementPanel
        currentUser={currentUser}
        staffUsers={staffUsers}
        newStaffName={adminForms.newStaffName}
        newStaffEmail={adminForms.newStaffEmail}
        newStaffPassword={adminForms.newStaffPassword}
        newStaffRole={adminForms.newStaffRole}
        errors={adminValidation.adminFormErrors.staff ?? {}}
        isCreatingStaff={staffManagement.isCreatingStaff}
        isProtectedDefaultUser={isProtectedDefaultUser}
        onCreateStaff={staffManagement.handleCreateStaff}
        onNewStaffNameChange={(value) => {
          adminForms.setNewStaffName(value);
          adminValidation.clearAdminFormError('staff', 'name');
        }}
        onNewStaffEmailChange={(value) => {
          adminForms.setNewStaffEmail(value);
          adminValidation.clearAdminFormError('staff', 'email');
        }}
        onNewStaffPasswordChange={(value) => {
          adminForms.setNewStaffPassword(value);
          adminValidation.clearAdminFormError('staff', 'password');
        }}
        onNewStaffRoleChange={adminForms.setNewStaffRole}
        onStaffRoleChange={staffManagement.handleStaffRoleChange}
        onStaffActiveChange={staffManagement.handleStaffActiveChange}
        onDeleteStaff={staffManagement.handleDeleteStaff}
      />
    </>
  );
}

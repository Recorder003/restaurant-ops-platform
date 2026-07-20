import { AdminManagementSections } from '../AdminManagementSections';
import type { useAdminManagement } from '../../hooks/useAdminManagement';
import type { MenuBundle, MenuItem, RestaurantTable, User } from '../../types';

type AdminWorkspaceSectionProps = {
  currentUser: User;
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  restaurantTables: RestaurantTable[];
  staffUsers: User[];
  adminManagement: ReturnType<typeof useAdminManagement>;
  dataRefreshVersion: number;
};

export function AdminWorkspaceSection({
  currentUser,
  menuItems,
  menuBundles,
  restaurantTables,
  staffUsers,
  adminManagement,
  dataRefreshVersion
}: AdminWorkspaceSectionProps) {
  return (
    <AdminManagementSections
      currentUser={currentUser}
      adminForms={adminManagement.adminForms}
      adminValidation={adminManagement.adminValidation}
      menuManagement={adminManagement.menuManagement}
      tableManagement={adminManagement.tableManagement}
      staffManagement={adminManagement.staffManagement}
      menuItems={menuItems}
      menuBundles={menuBundles}
      tables={restaurantTables}
      staffUsers={staffUsers}
      dataRefreshVersion={dataRefreshVersion}
    />
  );
}

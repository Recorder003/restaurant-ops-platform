import { AuthenticatedHeader } from './AuthenticatedHeader';
import {
  AdminWorkspaceSection,
  ChefToolsSection,
  getWorkspaceLayoutClassName,
  OrderBoardSection,
  OrderEntrySection
} from './workspace';
import type { useAdminManagement } from '../hooks/useAdminManagement';
import type { useCheckoutFlow } from '../hooks/useCheckoutFlow';
import type { useOrderBoard } from '../hooks/useOrderBoard';
import type { useOrderDocuments } from '../hooks/useOrderDocuments';
import type { useOrderDraft } from '../hooks/useOrderDraft';
import type { MenuBundle, MenuItem, RestaurantTable, User } from '../types';

type OperationalWorkspaceProps = {
  user: User;
  error: string | null;
  isLoading: boolean;
  isSessionLoading: boolean;
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  adminMenuItems: MenuItem[];
  adminMenuBundles: MenuBundle[];
  restaurantTables: RestaurantTable[];
  staffUsers: User[];
  orderBoard: ReturnType<typeof useOrderBoard>;
  orderDraft: ReturnType<typeof useOrderDraft>;
  documents: ReturnType<typeof useOrderDocuments>;
  checkout: ReturnType<typeof useCheckoutFlow>;
  adminManagement: ReturnType<typeof useAdminManagement>;
  onRefresh: () => void;
};

export function OperationalWorkspace({
  user,
  error,
  isLoading,
  isSessionLoading,
  menuItems,
  menuBundles,
  adminMenuItems,
  adminMenuBundles,
  restaurantTables,
  staffUsers,
  orderBoard,
  orderDraft,
  documents,
  checkout,
  adminManagement,
  onRefresh
}: OperationalWorkspaceProps) {
  const isBusy = isLoading || isSessionLoading;

  return (
    <section className="workspace">
      <AuthenticatedHeader isLoading={isBusy} onRefresh={onRefresh} />

      {error && <div className="alert">{error}</div>}

      {user.role === 'chef' && (
        <ChefToolsSection
          menuItems={adminMenuItems}
          adminManagement={adminManagement}
        />
      )}

      <div className={getWorkspaceLayoutClassName(user.role)}>
        {user.role !== 'chef' && (
          <OrderEntrySection
            role={user.role}
            menuItems={menuItems}
            menuBundles={menuBundles}
            restaurantTables={restaurantTables}
            orderDraft={orderDraft}
            adminManagement={adminManagement}
          />
        )}

        <OrderBoardSection
          role={user.role}
          isLoading={isLoading}
          orderBoard={orderBoard}
          orderDraft={orderDraft}
          documents={documents}
          checkout={checkout}
        />
      </div>

      {user.role === 'admin' && (
        <AdminWorkspaceSection
          currentUser={user}
          menuItems={adminMenuItems}
          menuBundles={adminMenuBundles}
          restaurantTables={restaurantTables}
          staffUsers={staffUsers}
          adminManagement={adminManagement}
        />
      )}
    </section>
  );
}

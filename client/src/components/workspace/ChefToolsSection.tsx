import { SoldOutPanel } from '../SoldOutPanel';
import type { useAdminManagement } from '../../hooks/useAdminManagement';
import type { MenuItem } from '../../types';
import { isAlwaysAvailableMenuItem } from '../../utils/menuUtils';

type ChefToolsSectionProps = {
  menuItems: MenuItem[];
  adminManagement: ReturnType<typeof useAdminManagement>;
};

export function ChefToolsSection({ menuItems, adminManagement }: ChefToolsSectionProps) {
  return (
    <SoldOutPanel
      menuItems={menuItems}
      isAlwaysAvailableMenuItem={isAlwaysAvailableMenuItem}
      onSoldOutChange={adminManagement.handleSoldOutChange}
    />
  );
}

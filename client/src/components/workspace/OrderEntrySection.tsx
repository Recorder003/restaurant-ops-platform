import { OrderEntryPanel } from '../OrderEntryPanel';
import { tableStatusLabels } from '../../config/appConfig';
import type { useAdminManagement } from '../../hooks/useAdminManagement';
import type { useOrderDraft } from '../../hooks/useOrderDraft';
import type { MenuBundle, MenuItem, RestaurantTable, User } from '../../types';
import { formatMoney } from '../../utils/formatters';
import { formatMenuVariantLabel, getMenuItemVariantById } from '../../utils/menuUtils';
import { getOrderFlowLabel } from '../../utils/orderDraftUtils';

type OrderEntrySectionProps = {
  role: User['role'];
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  restaurantTables: RestaurantTable[];
  orderDraft: ReturnType<typeof useOrderDraft>;
  adminManagement: ReturnType<typeof useAdminManagement>;
};

export function OrderEntrySection({
  role,
  menuItems,
  menuBundles,
  restaurantTables,
  orderDraft,
  adminManagement
}: OrderEntrySectionProps) {
  return (
    <OrderEntryPanel
      role={role}
      editingOrderId={orderDraft.editingOrderId}
      staffOrderStep={orderDraft.staffOrderStep}
      orderSource={orderDraft.orderSource}
      fulfillmentType={orderDraft.fulfillmentType}
      tableNumber={orderDraft.tableNumber}
      partySize={orderDraft.partySize}
      phoneNumber={orderDraft.phoneNumber}
      serverName={orderDraft.serverName}
      notes={orderDraft.notes}
      selectedCategory={orderDraft.selectedCategory}
      selectedItems={orderDraft.selectedItems}
      selectedBundles={orderDraft.selectedBundles}
      categories={orderDraft.categories}
      menuItems={menuItems}
      menuBundles={menuBundles}
      restaurantTables={restaurantTables}
      selectedTable={orderDraft.selectedTable}
      tableStatusLabels={tableStatusLabels}
      draftItems={orderDraft.draftItems}
      draftTotal={orderDraft.draftTotal}
      maxPartySize={orderDraft.maxPartySize}
      formErrors={orderDraft.orderFormErrors}
      isSubmitting={orderDraft.isSubmitting}
      formatMoney={formatMoney}
      formatMenuVariantLabel={formatMenuVariantLabel}
      getMenuItemVariantById={getMenuItemVariantById}
      getOrderFlowLabel={getOrderFlowLabel}
      onSubmit={orderDraft.handleSubmit}
      onStartStaffOrder={orderDraft.startStaffOrder}
      onOrderSourceChange={orderDraft.handleOrderSourceChange}
      onFulfillmentTypeChange={orderDraft.handleFulfillmentTypeChange}
      onTableSelect={orderDraft.handleTableSelect}
      onTableCleaned={adminManagement.handleTableCleaned}
      onOpenTablePicker={orderDraft.openTablePicker}
      onPartySizeChange={orderDraft.handlePartySizeChange}
      onPhoneNumberChange={orderDraft.handlePhoneNumberChange}
      onServerNameChange={orderDraft.handleServerNameChange}
      onNotesChange={orderDraft.setNotes}
      onSelectedCategoryChange={orderDraft.setSelectedCategory}
      onStaffOrderStepChange={orderDraft.setStaffOrderStep}
      onResetOrderDraft={orderDraft.resetOrderDraft}
      onGoToStaffPartyStep={orderDraft.goToStaffPartyStep}
      onGoToStaffMenuStep={orderDraft.goToStaffMenuStep}
      onMenuQuantityChange={orderDraft.handleMenuQuantityChange}
      onBundleQuantityChange={orderDraft.handleBundleQuantityChange}
      onCancelEdit={orderDraft.handleCancelEdit}
    />
  );
}

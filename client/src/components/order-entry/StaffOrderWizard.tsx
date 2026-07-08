import type { RefObject } from 'react';
import { OrderMenuPicker } from './OrderMenuPicker';
import { PartyStep, PhoneStep, ServiceStep, TableStep } from './StaffOrderSteps';
import type { OrderEntryPanelProps } from './types';

type StaffOrderWizardProps = OrderEntryPanelProps & {
  tableErrorRef: RefObject<HTMLDivElement | null>;
  partySizeRef: RefObject<HTMLInputElement | null>;
  phoneRef: RefObject<HTMLInputElement | null>;
};

export function StaffOrderWizard({
  editingOrderId,
  staffOrderStep,
  orderSource,
  fulfillmentType,
  tableNumber,
  partySize,
  phoneNumber,
  notes,
  selectedCategory,
  selectedItems,
  selectedBundles,
  categories,
  menuItems,
  menuBundles,
  restaurantTables,
  selectedTable,
  tableStatusLabels,
  draftItems,
  draftTotal,
  maxPartySize,
  formErrors,
  isSubmitting,
  formatMoney,
  formatMenuVariantLabel,
  getMenuItemVariantById,
  getOrderFlowLabel,
  onSubmit,
  onStartStaffOrder,
  onTableSelect,
  onTableCleaned,
  onPartySizeChange,
  onPhoneNumberChange,
  onNotesChange,
  onSelectedCategoryChange,
  onStaffOrderStepChange,
  onResetOrderDraft,
  onGoToStaffPartyStep,
  onGoToStaffMenuStep,
  onMenuQuantityChange,
  onBundleQuantityChange,
  onCancelEdit,
  tableErrorRef,
  partySizeRef,
  phoneRef
}: StaffOrderWizardProps) {
  return (
    <form className="panel order-wizard" onSubmit={onSubmit} noValidate>
      <div className="panel-heading">
        <div>
          <h2>{editingOrderId ? 'Edit Order' : 'New Order'}</h2>
          <span className="wizard-context">{getOrderFlowLabel(orderSource, fulfillmentType, tableNumber, partySize, phoneNumber)}</span>
        </div>
        <strong>{formatMoney(draftTotal)}</strong>
      </div>

      {staffOrderStep === 'service' && (
        <ServiceStep onStartStaffOrder={onStartStaffOrder} />
      )}

      {staffOrderStep === 'table' && (
        <TableStep
          tableNumber={tableNumber}
          restaurantTables={restaurantTables}
          tableStatusLabels={tableStatusLabels}
          formErrors={formErrors}
          tableErrorRef={tableErrorRef}
          onTableSelect={onTableSelect}
          onTableCleaned={onTableCleaned}
          onResetOrderDraft={onResetOrderDraft}
          onGoToStaffPartyStep={onGoToStaffPartyStep}
        />
      )}

      {staffOrderStep === 'party' && (
        <PartyStep
          partySize={partySize}
          selectedTable={selectedTable}
          maxPartySize={maxPartySize}
          formErrors={formErrors}
          partySizeRef={partySizeRef}
          onPartySizeChange={onPartySizeChange}
          onStaffOrderStepChange={onStaffOrderStepChange}
          onGoToStaffMenuStep={onGoToStaffMenuStep}
        />
      )}

      {staffOrderStep === 'phone' && (
        <PhoneStep
          phoneNumber={phoneNumber}
          formErrors={formErrors}
          phoneRef={phoneRef}
          onPhoneNumberChange={onPhoneNumberChange}
          onResetOrderDraft={onResetOrderDraft}
          onGoToStaffMenuStep={onGoToStaffMenuStep}
        />
      )}

      {staffOrderStep === 'menu' && (
        <OrderMenuPicker
          categories={categories}
          selectedCategory={selectedCategory}
          selectedItems={selectedItems}
          selectedBundles={selectedBundles}
          menuItems={menuItems}
          menuBundles={menuBundles}
          draftItems={draftItems}
          formErrors={formErrors}
          notes={notes}
          isSubmitting={isSubmitting}
          editingOrderId={editingOrderId}
          formatMoney={formatMoney}
          formatMenuVariantLabel={formatMenuVariantLabel}
          getMenuItemVariantById={getMenuItemVariantById}
          onSelectedCategoryChange={onSelectedCategoryChange}
          onMenuQuantityChange={onMenuQuantityChange}
          onBundleQuantityChange={onBundleQuantityChange}
          onNotesChange={onNotesChange}
          onCancel={editingOrderId ? onCancelEdit : onResetOrderDraft}
        />
      )}
    </form>
  );
}

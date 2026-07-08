import type { RefObject } from 'react';
import { AdminMenuQuantityList, AdminOrderSourceFields, ServerNotesFields } from './AdminOrderFormSections';
import type { OrderEntryPanelProps } from './types';

type AdminOrderFormProps = OrderEntryPanelProps & {
  tableErrorRef: RefObject<HTMLDivElement | null>;
  partySizeRef: RefObject<HTMLInputElement | null>;
  phoneRef: RefObject<HTMLInputElement | null>;
  serverRef: RefObject<HTMLInputElement | null>;
};

export function AdminOrderForm({
  editingOrderId,
  orderSource,
  fulfillmentType,
  partySize,
  phoneNumber,
  serverName,
  notes,
  selectedItems,
  selectedBundles,
  categories,
  menuItems,
  menuBundles,
  selectedTable,
  draftTotal,
  maxPartySize,
  formErrors,
  isSubmitting,
  formatMoney,
  formatMenuVariantLabel,
  onSubmit,
  onOrderSourceChange,
  onFulfillmentTypeChange,
  onOpenTablePicker,
  onPartySizeChange,
  onPhoneNumberChange,
  onServerNameChange,
  onNotesChange,
  onMenuQuantityChange,
  onBundleQuantityChange,
  onCancelEdit,
  tableErrorRef,
  partySizeRef,
  phoneRef,
  serverRef
}: AdminOrderFormProps) {
  return (
    <form className="panel order-form" onSubmit={onSubmit} noValidate>
      <div className="panel-heading">
        <h2>{editingOrderId ? 'Edit Order' : 'New Order'}</h2>
        <strong>{formatMoney(draftTotal)}</strong>
      </div>

      <AdminOrderSourceFields
        orderSource={orderSource}
        fulfillmentType={fulfillmentType}
        partySize={partySize}
        phoneNumber={phoneNumber}
        selectedTable={selectedTable}
        maxPartySize={maxPartySize}
        formErrors={formErrors}
        tableErrorRef={tableErrorRef}
        partySizeRef={partySizeRef}
        phoneRef={phoneRef}
        onOrderSourceChange={onOrderSourceChange}
        onFulfillmentTypeChange={onFulfillmentTypeChange}
        onOpenTablePicker={onOpenTablePicker}
        onPartySizeChange={onPartySizeChange}
        onPhoneNumberChange={onPhoneNumberChange}
      />

      <ServerNotesFields
        serverName={serverName}
        notes={notes}
        formErrors={formErrors}
        serverRef={serverRef}
        onServerNameChange={onServerNameChange}
        onNotesChange={onNotesChange}
      />

      <AdminMenuQuantityList
        categories={categories}
        menuItems={menuItems}
        menuBundles={menuBundles}
        selectedItems={selectedItems}
        selectedBundles={selectedBundles}
        formatMoney={formatMoney}
        formatMenuVariantLabel={formatMenuVariantLabel}
        onMenuQuantityChange={onMenuQuantityChange}
        onBundleQuantityChange={onBundleQuantityChange}
      />

      <div className="form-actions">
        <button className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : editingOrderId ? 'Save Changes' : 'Submit Order'}
        </button>
        {editingOrderId && (
          <button className="ghost-button" type="button" onClick={onCancelEdit}>
            Cancel Edit
          </button>
        )}
      </div>
    </form>
  );
}

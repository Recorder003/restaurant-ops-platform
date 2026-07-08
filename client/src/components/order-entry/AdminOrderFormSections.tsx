import type { RefObject } from 'react';
import type { FulfillmentType, MenuBundle, MenuItem, OrderSource, RestaurantTable } from '../../types';
import type { OrderFormErrors } from '../../utils/orderFormValidation';

type AdminOrderSourceFieldsProps = {
  orderSource: OrderSource;
  fulfillmentType: FulfillmentType;
  partySize: string;
  phoneNumber: string;
  selectedTable: RestaurantTable | undefined;
  maxPartySize: number;
  formErrors: OrderFormErrors;
  tableErrorRef: RefObject<HTMLDivElement | null>;
  partySizeRef: RefObject<HTMLInputElement | null>;
  phoneRef: RefObject<HTMLInputElement | null>;
  onOrderSourceChange: (source: OrderSource) => void;
  onFulfillmentTypeChange: (fulfillmentType: FulfillmentType) => void;
  onOpenTablePicker: () => void;
  onPartySizeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
};

export function AdminOrderSourceFields({
  orderSource,
  fulfillmentType,
  partySize,
  phoneNumber,
  selectedTable,
  maxPartySize,
  formErrors,
  tableErrorRef,
  partySizeRef,
  phoneRef,
  onOrderSourceChange,
  onFulfillmentTypeChange,
  onOpenTablePicker,
  onPartySizeChange,
  onPhoneNumberChange
}: AdminOrderSourceFieldsProps) {
  return (
    <>
      <div className="segmented-control" aria-label="Order source">
        <button className={orderSource === 'in_person' ? 'selected' : ''} type="button" onClick={() => onOrderSourceChange('in_person')}>
          In-person
        </button>
        <button className={orderSource === 'phone' ? 'selected' : ''} type="button" onClick={() => onOrderSourceChange('phone')}>
          Phone
        </button>
      </div>

      {orderSource === 'in_person' ? (
        <InPersonFields
          fulfillmentType={fulfillmentType}
          partySize={partySize}
          selectedTable={selectedTable}
          maxPartySize={maxPartySize}
          formErrors={formErrors}
          tableErrorRef={tableErrorRef}
          partySizeRef={partySizeRef}
          onFulfillmentTypeChange={onFulfillmentTypeChange}
          onOpenTablePicker={onOpenTablePicker}
          onPartySizeChange={onPartySizeChange}
        />
      ) : (
        <PhoneOrderFields
          fulfillmentType={fulfillmentType}
          phoneNumber={phoneNumber}
          formErrors={formErrors}
          phoneRef={phoneRef}
          onFulfillmentTypeChange={onFulfillmentTypeChange}
          onPhoneNumberChange={onPhoneNumberChange}
        />
      )}
    </>
  );
}

type InPersonFieldsProps = {
  fulfillmentType: FulfillmentType;
  partySize: string;
  selectedTable: RestaurantTable | undefined;
  maxPartySize: number;
  formErrors: OrderFormErrors;
  tableErrorRef: RefObject<HTMLDivElement | null>;
  partySizeRef: RefObject<HTMLInputElement | null>;
  onFulfillmentTypeChange: (fulfillmentType: FulfillmentType) => void;
  onOpenTablePicker: () => void;
  onPartySizeChange: (value: string) => void;
};

function InPersonFields({
  fulfillmentType,
  partySize,
  selectedTable,
  maxPartySize,
  formErrors,
  tableErrorRef,
  partySizeRef,
  onFulfillmentTypeChange,
  onOpenTablePicker,
  onPartySizeChange
}: InPersonFieldsProps) {
  return (
    <>
      <label>
        Service
        <select value={fulfillmentType} onChange={(event) => onFulfillmentTypeChange(event.target.value as FulfillmentType)}>
          <option value="dine_in">Dine-in</option>
          <option value="to_go">To-go</option>
        </select>
      </label>

      {fulfillmentType === 'dine_in' && (
        <>
          <div className="admin-table-picker">
            <div className="field-heading">
              <strong>Table <span className="required-mark">*</span></strong>
              {selectedTable && (
                <span>
                  Selected: {selectedTable.name} / {selectedTable.capacity} seats / max {maxPartySize} guests
                </span>
              )}
            </div>
            <button className="ghost-button" type="button" onClick={onOpenTablePicker}>
              {selectedTable ? `Change ${selectedTable.name}` : 'Choose Table'}
            </button>
            {formErrors.tableNumber && (
              <div className="field-error" ref={tableErrorRef} tabIndex={-1}>
                {formErrors.tableNumber}
              </div>
            )}
          </div>

          <label className={formErrors.partySize ? 'has-error' : ''}>
            <span>Party Size <span className="required-mark">*</span></span>
            <input
              max={maxPartySize}
              min="1"
              ref={partySizeRef}
              type="number"
              value={partySize}
              onChange={(event) => onPartySizeChange(event.target.value)}
            />
            {formErrors.partySize && <span className="field-error">{formErrors.partySize}</span>}
          </label>
        </>
      )}
    </>
  );
}

type PhoneOrderFieldsProps = {
  fulfillmentType: FulfillmentType;
  phoneNumber: string;
  formErrors: OrderFormErrors;
  phoneRef: RefObject<HTMLInputElement | null>;
  onFulfillmentTypeChange: (fulfillmentType: FulfillmentType) => void;
  onPhoneNumberChange: (value: string) => void;
};

function PhoneOrderFields({
  fulfillmentType,
  phoneNumber,
  formErrors,
  phoneRef,
  onFulfillmentTypeChange,
  onPhoneNumberChange
}: PhoneOrderFieldsProps) {
  return (
    <>
      <label className={formErrors.phoneNumber ? 'has-error' : ''}>
        <span>Phone <span className="required-mark">*</span></span>
        <input ref={phoneRef} value={phoneNumber} onChange={(event) => onPhoneNumberChange(event.target.value)} />
        {formErrors.phoneNumber && <span className="field-error">{formErrors.phoneNumber}</span>}
      </label>

      <label>
        Service
        <select value={fulfillmentType} onChange={(event) => onFulfillmentTypeChange(event.target.value as FulfillmentType)}>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
        </select>
      </label>
    </>
  );
}

type ServerNotesFieldsProps = {
  serverName: string;
  notes: string;
  formErrors: OrderFormErrors;
  serverRef: RefObject<HTMLInputElement | null>;
  onServerNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

export function ServerNotesFields({
  serverName,
  notes,
  formErrors,
  serverRef,
  onServerNameChange,
  onNotesChange
}: ServerNotesFieldsProps) {
  return (
    <>
      <label className={formErrors.serverName ? 'has-error' : ''}>
        <span>Server <span className="required-mark">*</span></span>
        <input ref={serverRef} value={serverName} onChange={(event) => onServerNameChange(event.target.value)} />
        {formErrors.serverName && <span className="field-error">{formErrors.serverName}</span>}
      </label>

      <label>
        Notes
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} rows={3} />
      </label>
    </>
  );
}

type AdminMenuQuantityListProps = {
  categories: string[];
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  selectedItems: Record<string, number>;
  selectedBundles: Record<string, number>;
  formatMoney: (cents: number) => string;
  formatMenuVariantLabel: (menuItem: MenuItem, variant: MenuItem['variants'][number]) => string;
  onMenuQuantityChange: (menuItemVariantId: string, quantity: number) => void;
  onBundleQuantityChange: (bundleId: string, quantity: number) => void;
};

export function AdminMenuQuantityList({
  categories,
  menuItems,
  menuBundles,
  selectedItems,
  selectedBundles,
  formatMoney,
  formatMenuVariantLabel,
  onMenuQuantityChange,
  onBundleQuantityChange
}: AdminMenuQuantityListProps) {
  return (
    <div className="menu-list">
      {categories.map((category) => (
        <div key={category} className="menu-category">
          <h3>{category}</h3>
          {category === 'Combos' && menuBundles.map((bundle) => (
            <div key={bundle.id} className="menu-row">
              <div>
                <strong>{bundle.name}</strong>
                <span>{formatMoney(bundle.priceCents)} / {bundle.items.map((item) => item.menuItemName).join(' + ')}</span>
              </div>
              <input
                aria-label={`${bundle.name} quantity`}
                min="0"
                type="number"
                value={selectedBundles[bundle.id] ?? 0}
                onChange={(event) => onBundleQuantityChange(bundle.id, Number(event.target.value))}
              />
            </div>
          ))}
          {menuItems
            .filter((item) => item.category === category)
            .map((item) => (
              item.variants.map((variant) => (
                <div key={variant.id} className="menu-row">
                  <div>
                    <strong>{formatMenuVariantLabel(item, variant)}</strong>
                    <span>{formatMoney(variant.priceCents)}</span>
                  </div>
                  <input
                    aria-label={`${formatMenuVariantLabel(item, variant)} quantity`}
                    min="0"
                    type="number"
                    value={selectedItems[variant.id] ?? 0}
                    onChange={(event) => onMenuQuantityChange(variant.id, Number(event.target.value))}
                  />
                </div>
              ))
            ))}
        </div>
      ))}
    </div>
  );
}

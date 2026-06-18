import { useEffect, useRef, type FormEvent } from 'react';
import type {
  DraftItem,
  FulfillmentType,
  MenuBundle,
  MenuItem,
  OrderSource,
  RestaurantTable,
  UserRole
} from '../types';
import type { OrderFormErrors } from '../utils/orderFormValidation';

export type StaffOrderStep = 'service' | 'table' | 'party' | 'phone' | 'menu';

type OrderEntryPanelProps = {
  role: UserRole;
  editingOrderId: string | null;
  staffOrderStep: StaffOrderStep;
  orderSource: OrderSource;
  fulfillmentType: FulfillmentType;
  tableNumber: string;
  partySize: string;
  phoneNumber: string;
  serverName: string;
  notes: string;
  selectedCategory: string;
  selectedItems: Record<string, number>;
  selectedBundles: Record<string, number>;
  categories: string[];
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  restaurantTables: RestaurantTable[];
  selectedTable: RestaurantTable | undefined;
  tableStatusLabels: Record<RestaurantTable['status'], string>;
  draftItems: DraftItem[];
  draftTotal: number;
  maxPartySize: number;
  formErrors: OrderFormErrors;
  isSubmitting: boolean;
  formatMoney: (cents: number) => string;
  formatMenuVariantLabel: (menuItem: MenuItem, variant: MenuItem['variants'][number]) => string;
  getMenuItemVariantById: (menuItems: MenuItem[], variantId: string) => MenuItem['variants'][number] | undefined;
  getOrderFlowLabel: (
    orderSource: OrderSource,
    fulfillmentType: FulfillmentType,
    tableNumber: string,
    partySize: string,
    phoneNumber: string
  ) => string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onStartStaffOrder: (source: OrderSource, fulfillment: FulfillmentType) => void;
  onOrderSourceChange: (source: OrderSource) => void;
  onFulfillmentTypeChange: (fulfillmentType: FulfillmentType) => void;
  onTableSelect: (table: RestaurantTable) => void;
  onTableCleaned: (table: RestaurantTable) => void;
  onOpenTablePicker: () => void;
  onPartySizeChange: (value: string) => void;
  onPhoneNumberChange: (value: string) => void;
  onServerNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSelectedCategoryChange: (category: string) => void;
  onStaffOrderStepChange: (step: StaffOrderStep) => void;
  onResetOrderDraft: () => void;
  onGoToStaffPartyStep: () => void;
  onGoToStaffMenuStep: () => void;
  onMenuQuantityChange: (menuItemVariantId: string, quantity: number) => void;
  onBundleQuantityChange: (bundleId: string, quantity: number) => void;
  onCancelEdit: () => void;
};

export function OrderEntryPanel({
  role,
  editingOrderId,
  staffOrderStep,
  orderSource,
  fulfillmentType,
  tableNumber,
  partySize,
  phoneNumber,
  serverName,
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
  onOrderSourceChange,
  onFulfillmentTypeChange,
  onTableSelect,
  onTableCleaned,
  onOpenTablePicker,
  onPartySizeChange,
  onPhoneNumberChange,
  onServerNameChange,
  onNotesChange,
  onSelectedCategoryChange,
  onStaffOrderStepChange,
  onResetOrderDraft,
  onGoToStaffPartyStep,
  onGoToStaffMenuStep,
  onMenuQuantityChange,
  onBundleQuantityChange,
  onCancelEdit
}: OrderEntryPanelProps) {
  const tableErrorRef = useRef<HTMLDivElement>(null);
  const partySizeRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const serverRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const firstErrorTarget =
      formErrors.tableNumber ? tableErrorRef.current :
      formErrors.partySize ? partySizeRef.current :
      formErrors.phoneNumber ? phoneRef.current :
      formErrors.serverName ? serverRef.current :
      null;

    firstErrorTarget?.focus();
  }, [formErrors]);

  if (role === 'staff') {
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
          <div className="wizard-step">
            <div className="wizard-title">
              <span>Step 1</span>
              <h3>Choose service type</h3>
            </div>
            <div className="service-choice-grid">
              <button type="button" onClick={() => onStartStaffOrder('in_person', 'dine_in')}>
                <strong>Dine-in</strong>
                <span>Table order</span>
              </button>
              <button type="button" onClick={() => onStartStaffOrder('in_person', 'to_go')}>
                <strong>To-go</strong>
                <span>Walk-in takeout</span>
              </button>
              <button type="button" onClick={() => onStartStaffOrder('phone', 'pickup')}>
                <strong>Phone pickup</strong>
                <span>Customer picks up</span>
              </button>
              <button type="button" onClick={() => onStartStaffOrder('phone', 'delivery')}>
                <strong>Phone delivery</strong>
                <span>Delivery order</span>
              </button>
            </div>
          </div>
        )}

        {staffOrderStep === 'table' && (
          <div className="wizard-step">
            <div className="wizard-title">
              <span>Step 2</span>
              <h3>Choose table <span className="required-mark">*</span></h3>
            </div>
            <div className="table-grid">
              {restaurantTables.map((table) => (
                <button
                  key={table.id}
                  className={`${tableNumber === table.name ? 'selected' : ''} ${table.status}`}
                  disabled={table.status !== 'available' && tableNumber !== table.name}
                  type="button"
                  onClick={() => (table.status === 'available' || tableNumber === table.name) && onTableSelect(table)}
                >
                  <strong>{table.name}</strong>
                  <span>{tableStatusLabels[table.status]}</span>
                  <small>{table.capacity} seats</small>
                </button>
              ))}
            </div>
            {formErrors.tableNumber && (
              <div className="field-error" ref={tableErrorRef} tabIndex={-1}>
                {formErrors.tableNumber}
              </div>
            )}
            {restaurantTables.some((table) => table.status === 'needs_cleaning') && (
              <div className="cleaning-list">
                {restaurantTables
                  .filter((table) => table.status === 'needs_cleaning')
                  .map((table) => (
                    <button key={table.id} className="ghost-button" type="button" onClick={() => onTableCleaned(table)}>
                      {table.name} Cleaned
                    </button>
                  ))}
              </div>
            )}
            <div className="wizard-nav">
              <button className="ghost-button" type="button" onClick={onResetOrderDraft}>Back</button>
              <button className="primary-button" type="button" onClick={onGoToStaffPartyStep}>Next</button>
            </div>
          </div>
        )}

        {staffOrderStep === 'party' && (
          <div className="wizard-step">
            <div className="wizard-title">
              <span>Step 3</span>
              <h3>How many guests?</h3>
              {selectedTable && (
                <p className="wizard-hint">
                  {selectedTable.name} seats {selectedTable.capacity}. Max {maxPartySize} with extra chairs.
                </p>
              )}
            </div>
            <div className={`party-picker ${formErrors.partySize ? 'has-error' : ''}`}>
              <button type="button" onClick={() => onPartySizeChange(Math.max(1, Number(partySize) - 1).toString())}>-</button>
              <input
                aria-label="Party size"
                max={maxPartySize}
                min="1"
                ref={partySizeRef}
                type="number"
                value={partySize}
                onChange={(event) => onPartySizeChange(event.target.value)}
              />
              <button
                disabled={Number(partySize) >= maxPartySize}
                type="button"
                onClick={() => onPartySizeChange(Math.min(maxPartySize, Number(partySize) + 1).toString())}
              >
                +
              </button>
            </div>
            {formErrors.partySize && <div className="field-error">{formErrors.partySize}</div>}
            <div className="wizard-nav">
              <button className="ghost-button" type="button" onClick={() => onStaffOrderStepChange('table')}>Back</button>
              <button className="primary-button" type="button" onClick={onGoToStaffMenuStep}>Next</button>
            </div>
          </div>
        )}

        {staffOrderStep === 'phone' && (
          <div className="wizard-step">
            <div className="wizard-title">
              <span>Step 2</span>
              <h3>Enter phone number</h3>
            </div>
            <label className={formErrors.phoneNumber ? 'has-error' : ''}>
              <span>Phone <span className="required-mark">*</span></span>
              <input ref={phoneRef} value={phoneNumber} onChange={(event) => onPhoneNumberChange(event.target.value)} />
              {formErrors.phoneNumber && <span className="field-error">{formErrors.phoneNumber}</span>}
            </label>
            <div className="wizard-nav">
              <button className="ghost-button" type="button" onClick={onResetOrderDraft}>Back</button>
              <button className="primary-button" type="button" onClick={onGoToStaffMenuStep}>Next</button>
            </div>
          </div>
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

  return (
    <form className="panel order-form" onSubmit={onSubmit} noValidate>
      <div className="panel-heading">
        <h2>{editingOrderId ? 'Edit Order' : 'New Order'}</h2>
        <strong>{formatMoney(draftTotal)}</strong>
      </div>

      <div className="segmented-control" aria-label="Order source">
        <button className={orderSource === 'in_person' ? 'selected' : ''} type="button" onClick={() => onOrderSourceChange('in_person')}>
          In-person
        </button>
        <button className={orderSource === 'phone' ? 'selected' : ''} type="button" onClick={() => onOrderSourceChange('phone')}>
          Phone
        </button>
      </div>

      {orderSource === 'in_person' ? (
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
      ) : (
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
      )}

      <label className={formErrors.serverName ? 'has-error' : ''}>
        <span>Server <span className="required-mark">*</span></span>
        <input ref={serverRef} value={serverName} onChange={(event) => onServerNameChange(event.target.value)} />
        {formErrors.serverName && <span className="field-error">{formErrors.serverName}</span>}
      </label>

      <label>
        Notes
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} rows={3} />
      </label>

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

type OrderMenuPickerProps = Pick<OrderEntryPanelProps,
  | 'categories'
  | 'selectedCategory'
  | 'selectedItems'
  | 'selectedBundles'
  | 'menuItems'
  | 'menuBundles'
  | 'draftItems'
  | 'formErrors'
  | 'notes'
  | 'isSubmitting'
  | 'editingOrderId'
  | 'formatMoney'
  | 'formatMenuVariantLabel'
  | 'getMenuItemVariantById'
  | 'onSelectedCategoryChange'
  | 'onMenuQuantityChange'
  | 'onBundleQuantityChange'
  | 'onNotesChange'
> & {
  onCancel: () => void;
};

function OrderMenuPicker({
  categories,
  selectedCategory,
  selectedItems,
  selectedBundles,
  menuItems,
  menuBundles,
  draftItems,
  formErrors,
  notes,
  isSubmitting,
  editingOrderId,
  formatMoney,
  formatMenuVariantLabel,
  getMenuItemVariantById,
  onSelectedCategoryChange,
  onMenuQuantityChange,
  onBundleQuantityChange,
  onNotesChange,
  onCancel
}: OrderMenuPickerProps) {
  const menuErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formErrors.items) {
      menuErrorRef.current?.focus();
    }
  }, [formErrors.items]);

  return (
    <div className="wizard-menu">
      <aside className="category-rail">
        {categories.map((category) => (
          <button
            key={category}
            className={selectedCategory === category ? 'selected' : ''}
            type="button"
            onClick={() => onSelectedCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </aside>

      <div className="wizard-menu-items">
        {selectedCategory === 'Combos' && menuBundles.map((bundle) => (
          <button
            key={bundle.id}
            className="menu-tile combo-tile"
            type="button"
            onClick={() => onBundleQuantityChange(bundle.id, (selectedBundles[bundle.id] ?? 0) + 1)}
          >
            <strong>{bundle.name}</strong>
            <span>{formatMoney(bundle.priceCents)}</span>
            <small>{bundle.items.map((item) => item.menuItemName).join(' + ')}</small>
            {(selectedBundles[bundle.id] ?? 0) > 0 && <em>x{selectedBundles[bundle.id]}</em>}
          </button>
        ))}
        {menuItems
          .filter((item) => item.category === selectedCategory)
          .map((item) => (
            item.variants.map((variant) => (
              <button
                key={variant.id}
                className="menu-tile"
                type="button"
                onClick={() => onMenuQuantityChange(variant.id, (selectedItems[variant.id] ?? 0) + 1)}
              >
                <strong>{formatMenuVariantLabel(item, variant)}</strong>
                <span>{formatMoney(variant.priceCents)}</span>
                {(selectedItems[variant.id] ?? 0) > 0 && <em>x{selectedItems[variant.id]}</em>}
              </button>
            ))
          ))}
      </div>

      <aside className="order-summary">
        <h3>Order</h3>
        {formErrors.items && (
          <div className="field-error menu-error" ref={menuErrorRef} tabIndex={-1}>
            {formErrors.items}
          </div>
        )}
        {draftItems.length === 0 ? (
          <p>No items selected</p>
        ) : (
          <ul>
            {draftItems.map((item) => {
              if (item.bundleId) {
                const bundle = menuBundles.find((candidate) => candidate.id === item.bundleId);

                return (
                  <li key={item.bundleId}>
                    <span>{bundle?.name} x {item.quantity}</span>
                    <div>
                      <button type="button" onClick={() => onBundleQuantityChange(item.bundleId!, item.quantity - 1)}>-</button>
                      <button type="button" onClick={() => onBundleQuantityChange(item.bundleId!, item.quantity + 1)}>+</button>
                    </div>
                  </li>
                );
              }

              const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
              const variant = item.menuItemVariantId ? getMenuItemVariantById(menuItems, item.menuItemVariantId) : undefined;

              return (
                <li key={item.menuItemVariantId}>
                  <span>{menuItem && variant ? formatMenuVariantLabel(menuItem, variant) : menuItem?.name} x {item.quantity}</span>
                  <div>
                    <button type="button" onClick={() => onMenuQuantityChange(item.menuItemVariantId!, item.quantity - 1)}>-</button>
                    <button type="button" onClick={() => onMenuQuantityChange(item.menuItemVariantId!, item.quantity + 1)}>+</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <label>
          Notes
          <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} rows={3} />
        </label>
        <div className="wizard-nav">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : editingOrderId ? 'Save Changes' : 'Submit Order'}
          </button>
        </div>
      </aside>
    </div>
  );
}

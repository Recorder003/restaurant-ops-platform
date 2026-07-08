import type { RefObject } from 'react';
import type { FulfillmentType, OrderSource, RestaurantTable } from '../../types';
import type { OrderFormErrors } from '../../utils/orderFormValidation';
import type { StaffOrderStep } from './types';

type ServiceStepProps = {
  onStartStaffOrder: (source: OrderSource, fulfillment: FulfillmentType) => void;
};

export function ServiceStep({ onStartStaffOrder }: ServiceStepProps) {
  return (
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
  );
}

type TableStepProps = {
  tableNumber: string;
  restaurantTables: RestaurantTable[];
  tableStatusLabels: Record<RestaurantTable['status'], string>;
  formErrors: OrderFormErrors;
  tableErrorRef: RefObject<HTMLDivElement | null>;
  onTableSelect: (table: RestaurantTable) => void;
  onTableCleaned: (table: RestaurantTable) => void;
  onResetOrderDraft: () => void;
  onGoToStaffPartyStep: () => void;
};

export function TableStep({
  tableNumber,
  restaurantTables,
  tableStatusLabels,
  formErrors,
  tableErrorRef,
  onTableSelect,
  onTableCleaned,
  onResetOrderDraft,
  onGoToStaffPartyStep
}: TableStepProps) {
  const cleaningTables = restaurantTables.filter((table) => table.status === 'needs_cleaning');

  return (
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
      {cleaningTables.length > 0 && (
        <div className="cleaning-list">
          {cleaningTables.map((table) => (
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
  );
}

type PartyStepProps = {
  partySize: string;
  selectedTable: RestaurantTable | undefined;
  maxPartySize: number;
  formErrors: OrderFormErrors;
  partySizeRef: RefObject<HTMLInputElement | null>;
  onPartySizeChange: (value: string) => void;
  onStaffOrderStepChange: (step: StaffOrderStep) => void;
  onGoToStaffMenuStep: () => void;
};

export function PartyStep({
  partySize,
  selectedTable,
  maxPartySize,
  formErrors,
  partySizeRef,
  onPartySizeChange,
  onStaffOrderStepChange,
  onGoToStaffMenuStep
}: PartyStepProps) {
  return (
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
  );
}

type PhoneStepProps = {
  phoneNumber: string;
  formErrors: OrderFormErrors;
  phoneRef: RefObject<HTMLInputElement | null>;
  onPhoneNumberChange: (value: string) => void;
  onResetOrderDraft: () => void;
  onGoToStaffMenuStep: () => void;
};

export function PhoneStep({
  phoneNumber,
  formErrors,
  phoneRef,
  onPhoneNumberChange,
  onResetOrderDraft,
  onGoToStaffMenuStep
}: PhoneStepProps) {
  return (
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
  );
}

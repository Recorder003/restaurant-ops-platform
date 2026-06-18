import type { FulfillmentType, OrderSource } from '../types';

export type OrderFormErrorKey = 'tableNumber' | 'partySize' | 'phoneNumber' | 'serverName' | 'items';
export type OrderFormErrors = Partial<Record<OrderFormErrorKey, string>>;

export type OrderDraftValidationInput = {
  fulfillmentType: FulfillmentType;
  orderSource: OrderSource;
  tableNumber: string;
  partySize: string;
  phoneNumber: string;
  serverName: string;
  itemCount: number;
  maxPartySize: number;
  selectedTableCapacity?: number;
  requireItems: boolean;
};

export function validateOrderDraftInput(input: OrderDraftValidationInput) {
  const errors: OrderFormErrors = {};
  const parsedPartySize = Number(input.partySize);

  if (input.fulfillmentType === 'dine_in' && !input.tableNumber.trim()) {
    errors.tableNumber = 'Choose an available table before continuing.';
  }

  if (input.fulfillmentType === 'dine_in' && (!Number.isFinite(parsedPartySize) || parsedPartySize < 1)) {
    errors.partySize = 'Enter at least 1 guest.';
  } else if (input.fulfillmentType === 'dine_in' && parsedPartySize > input.maxPartySize) {
    errors.partySize = `This table seats ${input.selectedTableCapacity ?? input.maxPartySize}. Maximum party size is ${input.maxPartySize} with extra chairs.`;
  }

  if (input.orderSource === 'phone' && !input.phoneNumber.trim()) {
    errors.phoneNumber = 'Enter the customer phone number.';
  }

  if (!input.serverName.trim()) {
    errors.serverName = 'Enter the server name.';
  }

  if (input.requireItems && input.itemCount === 0) {
    errors.items = 'Select at least one menu item before submitting.';
  }

  return errors;
}

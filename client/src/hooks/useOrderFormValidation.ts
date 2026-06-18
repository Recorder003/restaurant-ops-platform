import { useState } from 'react';
import {
  type OrderDraftValidationInput,
  type OrderFormErrorKey,
  type OrderFormErrors,
  validateOrderDraftInput
} from '../utils/orderFormValidation';

export function useOrderFormValidation() {
  const [orderFormErrors, setOrderFormErrors] = useState<OrderFormErrors>({});

  function clearOrderFormError(field: OrderFormErrorKey) {
    setOrderFormErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function clearOrderFormErrors() {
    setOrderFormErrors({});
  }

  function validateOrderDraft(input: OrderDraftValidationInput) {
    const nextErrors = validateOrderDraftInput(input);
    setOrderFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  return {
    orderFormErrors,
    clearOrderFormError,
    clearOrderFormErrors,
    validateOrderDraft
  };
}

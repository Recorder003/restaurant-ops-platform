import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAdminCreateForms } from './useAdminCreateForms';
import { useAdminFormValidation } from './useAdminFormValidation';
import { useOrderFormValidation } from './useOrderFormValidation';

describe('useAdminCreateForms', () => {
  it('provides useful defaults and resets changed values', () => {
    const { result } = renderHook(() => useAdminCreateForms());

    expect(result.current.newStaffEmail).toBe('test@example.com');
    expect(result.current.newMenuPrice).toBe('12.00');
    expect(result.current.newTableName).toBe('T13');

    act(() => {
      result.current.setNewStaffName('Morgan');
      result.current.setNewStaffEmail('morgan@example.com');
      result.current.setNewMenuName('Soup');
      result.current.setNewTableCapacity('8');
    });
    act(() => {
      result.current.resetStaffForm();
      result.current.resetMenuItemForm();
      result.current.resetTableForm('T14');
    });

    expect(result.current.newStaffName).toBe('');
    expect(result.current.newStaffEmail).toBe('test@example.com');
    expect(result.current.newMenuName).toBe('');
    expect(result.current.newTableName).toBe('T14');
    expect(result.current.newTableCapacity).toBe('4');
  });

  it('updates and removes quantities in a new combo', () => {
    const { result } = renderHook(() => useAdminCreateForms());

    act(() => result.current.updateNewBundleItemQuantity('variant-1', 2));
    expect(result.current.newBundleItems).toEqual({ 'variant-1': 2 });

    act(() => result.current.updateNewBundleItemQuantity('variant-1', 0));
    expect(result.current.newBundleItems).toEqual({});
  });
});

describe('form validation hooks', () => {
  it('stores and clears errors for an admin form section', () => {
    const { result } = renderHook(() => useAdminFormValidation());

    act(() => {
      expect(result.current.validateStaffForm({ name: '', email: 'bad', password: 'short' })).toBe(false);
    });
    expect(result.current.adminFormErrors.staff).toEqual({
      name: 'Enter the employee name.',
      email: 'Enter a valid email address.',
      password: 'Password must be at least 8 characters.'
    });

    act(() => result.current.clearAdminFormError('staff', 'email'));
    expect(result.current.adminFormErrors.staff?.email).toBeUndefined();

    act(() => result.current.clearAdminFormSection('staff'));
    expect(result.current.adminFormErrors.staff).toEqual({});
  });

  it('validates each admin resource and accepts valid values', () => {
    const { result } = renderHook(() => useAdminFormValidation());

    act(() => {
      expect(result.current.validateMenuItemForm({ name: 'Soup', price: '4.50' })).toBe(true);
      expect(result.current.validateMenuBundleForm({ name: 'Lunch', price: '12.00', items: { '1': 1 } })).toBe(true);
      expect(result.current.validateTableForm({ name: 'T14', capacity: '4' })).toBe(true);
    });
  });

  it('stores and clears order draft errors', () => {
    const { result } = renderHook(() => useOrderFormValidation());

    act(() => {
      expect(result.current.validateOrderDraft({
        orderSource: 'phone',
        fulfillmentType: 'delivery',
        tableNumber: '',
        partySize: '',
        phoneNumber: '',
        serverName: '',
        itemCount: 0,
        maxPartySize: 6,
        requireItems: true
      })).toBe(false);
    });
    expect(result.current.orderFormErrors.phoneNumber).toBeTruthy();
    expect(result.current.orderFormErrors.serverName).toBeTruthy();
    expect(result.current.orderFormErrors.items).toBeTruthy();

    act(() => result.current.clearOrderFormError('phoneNumber'));
    expect(result.current.orderFormErrors.phoneNumber).toBeUndefined();

    act(() => result.current.clearOrderFormErrors());
    expect(result.current.orderFormErrors).toEqual({});
  });
});

import { dollarsToCents } from './formatters';
import { getBundleItemsInput } from './menuUtils';

export type AdminFormErrors = {
  staff?: Partial<Record<'name' | 'email' | 'password', string>>;
  menuItem?: Partial<Record<'name' | 'price', string>>;
  menuBundle?: Partial<Record<'name' | 'price' | 'items', string>>;
  table?: Partial<Record<'name' | 'capacity', string>>;
};

export type StaffFormInput = {
  name: string;
  email: string;
  password: string;
};

export type MenuItemFormInput = {
  name: string;
  price: string;
};

export type MenuBundleFormInput = {
  name: string;
  price: string;
  items: Record<string, number>;
};

export type TableFormInput = {
  name: string;
  capacity: string;
};

export function validateStaffInput(input: StaffFormInput) {
  const errors: NonNullable<AdminFormErrors['staff']> = {};

  if (!input.name.trim()) {
    errors.name = 'Enter the employee name.';
  }

  if (!input.email.trim()) {
    errors.email = 'Enter the employee email.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (input.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  return errors;
}

export function validateMenuItemInput(input: MenuItemFormInput) {
  const errors: NonNullable<AdminFormErrors['menuItem']> = {};

  if (!input.name.trim()) {
    errors.name = 'Enter the menu item name.';
  }

  if (dollarsToCents(input.price) <= 0) {
    errors.price = 'Enter a price greater than $0.00.';
  }

  return errors;
}

export function validateMenuBundleInput(input: MenuBundleFormInput) {
  const errors: NonNullable<AdminFormErrors['menuBundle']> = {};

  if (!input.name.trim()) {
    errors.name = 'Enter the combo name.';
  }

  if (dollarsToCents(input.price) <= 0) {
    errors.price = 'Enter a combo price greater than $0.00.';
  }

  if (getBundleItemsInput(input.items).length === 0) {
    errors.items = 'Choose at least one item for this combo.';
  }

  return errors;
}

export function validateTableInput(input: TableFormInput) {
  const errors: NonNullable<AdminFormErrors['table']> = {};
  const capacity = Number(input.capacity);

  if (!input.name.trim()) {
    errors.name = 'Enter the table name.';
  }

  if (!Number.isFinite(capacity) || capacity < 1) {
    errors.capacity = 'Seats must be at least 1.';
  }

  return errors;
}

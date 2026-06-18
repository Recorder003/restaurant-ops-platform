import { useState } from 'react';
import {
  type AdminFormErrors,
  type MenuBundleFormInput,
  type MenuItemFormInput,
  type StaffFormInput,
  type TableFormInput,
  validateMenuBundleInput,
  validateMenuItemInput,
  validateStaffInput,
  validateTableInput
} from '../utils/adminFormValidation';

type AdminFormSection = keyof AdminFormErrors;

export function useAdminFormValidation() {
  const [adminFormErrors, setAdminFormErrors] = useState<AdminFormErrors>({});

  function clearAdminFormError(section: AdminFormSection, field: string) {
    setAdminFormErrors((current) => {
      const sectionErrors = current[section];
      if (!sectionErrors?.[field as keyof typeof sectionErrors]) {
        return current;
      }

      const nextSection = { ...sectionErrors };
      delete nextSection[field as keyof typeof nextSection];
      return { ...current, [section]: nextSection };
    });
  }

  function clearAdminFormSection(section: AdminFormSection) {
    setAdminFormErrors((current) => ({ ...current, [section]: {} }));
  }

  function validateStaffForm(input: StaffFormInput) {
    const nextErrors = validateStaffInput(input);
    setAdminFormErrors((current) => ({ ...current, staff: nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }

  function validateMenuItemForm(input: MenuItemFormInput) {
    const nextErrors = validateMenuItemInput(input);
    setAdminFormErrors((current) => ({ ...current, menuItem: nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }

  function validateMenuBundleForm(input: MenuBundleFormInput) {
    const nextErrors = validateMenuBundleInput(input);
    setAdminFormErrors((current) => ({ ...current, menuBundle: nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }

  function validateTableForm(input: TableFormInput) {
    const nextErrors = validateTableInput(input);
    setAdminFormErrors((current) => ({ ...current, table: nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }

  return {
    adminFormErrors,
    clearAdminFormError,
    clearAdminFormSection,
    validateStaffForm,
    validateMenuItemForm,
    validateMenuBundleForm,
    validateTableForm
  };
}

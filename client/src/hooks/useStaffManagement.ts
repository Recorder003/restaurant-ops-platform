import { useState, type FormEvent } from 'react';
import { createStaffUser, deleteStaffUser, updateStaffUser } from '../api';
import type { User, UserRole } from '../types';
import { isProtectedDefaultUser } from '../utils/userUtils';

type Options = {
  staffUsers: User[];
  setStaffUsers: React.Dispatch<React.SetStateAction<User[]>>;
  newStaffName: string;
  newStaffEmail: string;
  newStaffPassword: string;
  newStaffRole: UserRole;
  validateStaffForm: (input: { name: string; email: string; password: string }) => boolean;
  resetStaffForm: () => void;
  clearStaffErrors: () => void;
  onError: (message: string | null) => void;
};

export function useStaffManagement(options: Options) {
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { newStaffName: name, newStaffEmail: email, newStaffPassword: password } = options;
    if (!options.validateStaffForm({ name, email, password })) return;

    try {
      setIsCreatingStaff(true);
      const created = await createStaffUser({ name, email, password, role: options.newStaffRole });
      options.setStaffUsers((current) => [created, ...current]);
      options.resetStaffForm();
      options.clearStaffErrors();
      options.onError(null);
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'Failed to create staff user');
    } finally {
      setIsCreatingStaff(false);
    }
  }

  async function updateStaff(staffUser: User, input: { role?: UserRole; isActive?: boolean }, protectedMessage: string) {
    if (isProtectedDefaultUser(staffUser)) {
      options.onError(protectedMessage);
      return;
    }
    try {
      const updated = await updateStaffUser(staffUser.id, input);
      options.setStaffUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
      options.onError(null);
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'Failed to update staff user');
    }
  }

  function handleStaffRoleChange(staffUser: User, role: UserRole) {
    return updateStaff(staffUser, { role }, 'Default demo account roles cannot be changed');
  }

  function handleStaffActiveChange(staffUser: User, isActive: boolean) {
    return updateStaff(staffUser, { isActive }, 'Default demo accounts cannot be deactivated');
  }

  async function handleDeleteStaff(staffUser: User) {
    if (isProtectedDefaultUser(staffUser)) {
      options.onError('Default demo accounts cannot be deleted');
      return;
    }
    if (!window.confirm(`Delete ${staffUser.name}? This action cannot be undone.`)) return;
    try {
      await deleteStaffUser(staffUser.id);
      options.setStaffUsers((current) => current.filter((item) => item.id !== staffUser.id));
      options.onError(null);
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'Failed to delete staff user');
    }
  }

  return { isCreatingStaff, handleCreateStaff, handleStaffRoleChange, handleStaffActiveChange, handleDeleteStaff };
}


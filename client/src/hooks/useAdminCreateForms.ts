import { useState } from 'react';
import { setBundleItemQuantity } from '../utils/menuUtils';
import type { UserRole } from '../types';

export function useAdminCreateForms() {
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('test@example.com');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<UserRole>('staff');
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('Entrees');
  const [newMenuPrice, setNewMenuPrice] = useState('12.00');
  const [newMenuAvailable, setNewMenuAvailable] = useState(true);
  const [newBundleName, setNewBundleName] = useState('');
  const [newBundlePrice, setNewBundlePrice] = useState('23.80');
  const [newBundleAvailable, setNewBundleAvailable] = useState(true);
  const [newBundleItems, setNewBundleItems] = useState<Record<string, number>>({});
  const [newTableName, setNewTableName] = useState('T13');
  const [newTableCapacity, setNewTableCapacity] = useState('4');

  function resetStaffForm() {
    setNewStaffName('');
    setNewStaffEmail('test@example.com');
    setNewStaffPassword('');
    setNewStaffRole('staff');
  }

  function resetMenuItemForm() {
    setNewMenuName('');
    setNewMenuCategory('Entrees');
    setNewMenuPrice('12.00');
    setNewMenuAvailable(true);
  }

  function resetMenuBundleForm() {
    setNewBundleName('');
    setNewBundlePrice('23.80');
    setNewBundleAvailable(true);
    setNewBundleItems({});
  }

  function resetTableForm(nextTableName: string) {
    setNewTableName(nextTableName);
    setNewTableCapacity('4');
  }

  function updateNewBundleItemQuantity(menuItemVariantId: string, quantity: number) {
    setNewBundleItems((current) => setBundleItemQuantity(current, menuItemVariantId, quantity));
  }

  return {
    newStaffName,
    newStaffEmail,
    newStaffPassword,
    newStaffRole,
    newMenuName,
    newMenuCategory,
    newMenuPrice,
    newMenuAvailable,
    newBundleName,
    newBundlePrice,
    newBundleAvailable,
    newBundleItems,
    newTableName,
    newTableCapacity,
    setNewStaffName,
    setNewStaffEmail,
    setNewStaffPassword,
    setNewStaffRole,
    setNewMenuName,
    setNewMenuCategory,
    setNewMenuPrice,
    setNewMenuAvailable,
    setNewBundleName,
    setNewBundlePrice,
    setNewBundleAvailable,
    setNewTableName,
    setNewTableCapacity,
    resetStaffForm,
    resetMenuItemForm,
    resetMenuBundleForm,
    resetTableForm,
    updateNewBundleItemQuantity
  };
}

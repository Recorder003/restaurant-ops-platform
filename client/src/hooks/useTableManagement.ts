import { useState, type FormEvent } from 'react';
import { createTable, deleteTable, updateTable } from '../api';
import type { RestaurantTable } from '../types';
import { compareTables, getNextTableName, isProtectedDefaultTable } from '../utils/tableUtils';

type Options = {
  tables: RestaurantTable[];
  setTables: React.Dispatch<React.SetStateAction<RestaurantTable[]>>;
  newTableName: string;
  newTableCapacity: string;
  validateTableForm: (input: { name: string; capacity: string }) => boolean;
  resetTableForm: (nextName: string) => void;
  clearTableErrors: () => void;
  onError: (message: string | null) => void;
};

export function useTableManagement(options: Options) {
  const [isCreatingTable, setIsCreatingTable] = useState(false);

  async function handleCreateTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!options.validateTableForm({ name: options.newTableName, capacity: options.newTableCapacity })) return;
    try {
      setIsCreatingTable(true);
      const created = await createTable({ name: options.newTableName, capacity: Number(options.newTableCapacity) });
      options.setTables((current) => [...current, created].sort(compareTables));
      options.resetTableForm(getNextTableName([...options.tables, created]));
      options.clearTableErrors();
      options.onError(null);
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'Failed to create table');
    } finally {
      setIsCreatingTable(false);
    }
  }

  async function handleTableUpdate(table: RestaurantTable, input: Partial<RestaurantTable>) {
    try {
      const updated = await updateTable(table.id, input);
      options.setTables((current) => current.map((item) => item.id === updated.id ? updated : item).sort(compareTables));
      options.onError(null);
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'Failed to update table');
    }
  }

  async function handleDeleteTable(table: RestaurantTable) {
    if (isProtectedDefaultTable(table)) {
      options.onError('Default restaurant tables cannot be deleted');
      return;
    }
    if (!window.confirm(`Delete ${table.name}? This action cannot be undone.`)) return;
    try {
      await deleteTable(table.id);
      options.setTables((current) => current.filter((item) => item.id !== table.id));
      options.onError(null);
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'Failed to delete table');
    }
  }

  async function handleTableCleaned(table: RestaurantTable) {
    try {
      const updated = await updateTable(table.id, { status: 'available' });
      options.setTables((current) => current.map((item) => item.id === updated.id ? updated : item));
      options.onError(null);
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'Failed to update table');
    }
  }

  return { isCreatingTable, handleCreateTable, handleTableUpdate, handleDeleteTable, handleTableCleaned };
}

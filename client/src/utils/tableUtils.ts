import type { RestaurantTable } from '../types';

const protectedDefaultTableNames = new Set(Array.from({ length: 12 }, (_, index) => `T${index + 1}`));

export function compareTables(left: RestaurantTable, right: RestaurantTable) {
  return getTableSortNumber(left.name) - getTableSortNumber(right.name) || left.name.localeCompare(right.name);
}

export function getNextTableName(tables: RestaurantTable[]) {
  const nextNumber = tables.reduce((max, table) => {
    const tableNumber = getTableNumber(table.name);
    return tableNumber === null ? max : Math.max(max, tableNumber);
  }, 0) + 1;

  return `T${nextNumber}`;
}

export function isProtectedDefaultTable(table: RestaurantTable) {
  return protectedDefaultTableNames.has(table.name);
}

function getTableSortNumber(name: string) {
  return getTableNumber(name) ?? Number.MAX_SAFE_INTEGER;
}

function getTableNumber(name: string) {
  const match = name.match(/\d+/);
  return match ? Number(match[0]) : null;
}

import type { FormEvent } from 'react';
import type { RestaurantTable } from '../types';

type TableManagementPanelProps = {
  tables: RestaurantTable[];
  newTableName: string;
  newTableCapacity: string;
  errors: Partial<Record<'name' | 'capacity', string>>;
  isCreatingTable: boolean;
  isProtectedDefaultTable: (table: RestaurantTable) => boolean;
  onCreateTable: (event: FormEvent<HTMLFormElement>) => void;
  onNewTableNameChange: (value: string) => void;
  onNewTableCapacityChange: (value: string) => void;
  onTableUpdate: (table: RestaurantTable, input: Partial<RestaurantTable>) => void;
  onDeleteTable: (table: RestaurantTable) => void;
};

export function TableManagementPanel({
  tables,
  newTableName,
  newTableCapacity,
  errors,
  isCreatingTable,
  isProtectedDefaultTable,
  onCreateTable,
  onNewTableNameChange,
  onNewTableCapacityChange,
  onTableUpdate,
  onDeleteTable
}: TableManagementPanelProps) {
  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <h2>Table Management</h2>
        <span>{tables.length} tables</span>
      </div>

      <form className="table-admin-form" onSubmit={onCreateTable} noValidate>
        <label className={errors.name ? 'has-error' : ''}>
          <span>Table <span className="required-mark">*</span></span>
          <input value={newTableName} onChange={(event) => onNewTableNameChange(event.target.value)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <label className={errors.capacity ? 'has-error' : ''}>
          <span>Seats <span className="required-mark">*</span></span>
          <input
            min="1"
            type="number"
            value={newTableCapacity}
            onChange={(event) => onNewTableCapacityChange(event.target.value)}
          />
          {errors.capacity && <span className="field-error">{errors.capacity}</span>}
        </label>
        <button className="primary-button" disabled={isCreatingTable}>
          {isCreatingTable ? 'Creating...' : 'Create Table'}
        </button>
      </form>

      <div className="table-admin-list">
        {tables.map((table) => (
          <article key={table.id} className="table-admin-row">
            <input
              aria-label={`${table.name} name`}
              defaultValue={table.name}
              onBlur={(event) => {
                if (event.target.value !== table.name) {
                  onTableUpdate(table, { name: event.target.value });
                }
              }}
            />
            <input
              aria-label={`${table.name} capacity`}
              defaultValue={table.capacity}
              min="1"
              type="number"
              onBlur={(event) => {
                const capacity = Number(event.target.value);
                if (capacity !== table.capacity) {
                  onTableUpdate(table, { capacity });
                }
              }}
            />
            <select
              aria-label={`${table.name} status`}
              value={table.status}
              onChange={(event) => onTableUpdate(table, { status: event.target.value as RestaurantTable['status'] })}
            >
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="needs_cleaning">Needs cleaning</option>
            </select>
            {isProtectedDefaultTable(table) ? (
              <span className="protected-label">Protected</span>
            ) : (
              <button
                className="danger-button subtle-button"
                disabled={table.status === 'occupied'}
                onClick={() => onDeleteTable(table)}
              >
                Delete
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

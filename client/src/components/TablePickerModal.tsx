import type { RestaurantTable } from '../types';

type TablePickerModalProps = {
  tables: RestaurantTable[];
  tableNumber: string;
  selectedTable: RestaurantTable | undefined;
  tableStatusLabels: Record<RestaurantTable['status'], string>;
  onSelect: (table: RestaurantTable) => void;
  onClose: () => void;
};

export function TablePickerModal({
  tables,
  tableNumber,
  selectedTable,
  tableStatusLabels,
  onSelect,
  onClose
}: TablePickerModalProps) {
  return (
    <div className="modal-backdrop">
      <section className="history-modal table-picker-modal" role="dialog" aria-modal="true" aria-label="Choose table">
        <div className="panel-heading">
          <div>
            <h2>Choose Table</h2>
            <span>{selectedTable ? `Selected: ${selectedTable.name}` : 'Select an available table'}</span>
          </div>
          <button className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="table-grid modal-table-grid">
          {tables.map((table) => (
            <button
              key={table.id}
              className={`${tableNumber === table.name ? 'selected' : ''} ${table.status}`}
              disabled={table.status !== 'available' && tableNumber !== table.name}
              type="button"
              onClick={() => (table.status === 'available' || tableNumber === table.name) && onSelect(table)}
            >
              <strong>{table.name}</strong>
              <span>{tableStatusLabels[table.status]}</span>
              <small>{table.capacity} seats</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

import type { MenuItem } from '../types';

type SoldOutPanelProps = {
  menuItems: MenuItem[];
  isAlwaysAvailableMenuItem: (menuItem: MenuItem) => boolean;
  onSoldOutChange: (menuItem: MenuItem, isSoldOut: boolean) => void;
};

export function SoldOutPanel({ menuItems, isAlwaysAvailableMenuItem, onSoldOutChange }: SoldOutPanelProps) {
  return (
    <section className="admin-panel sold-out-panel">
      <div className="panel-heading">
        <h2>Sold Out</h2>
        <span>{menuItems.filter((item) => item.isSoldOut).length} unavailable today</span>
      </div>

      <div className="sold-out-grid">
        {menuItems.filter((item) => item.isAvailable).map((menuItem) => (
          <label key={menuItem.id} className="sold-out-item">
            <input
              type="checkbox"
              checked={menuItem.isSoldOut}
              disabled={isAlwaysAvailableMenuItem(menuItem)}
              onChange={(event) => onSoldOutChange(menuItem, event.target.checked)}
            />
            <span>
              <strong>{menuItem.name}</strong>
              <small>{menuItem.category}{isAlwaysAvailableMenuItem(menuItem) ? ' / Protected' : ''}</small>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

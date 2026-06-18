import type { FormEvent } from 'react';
import type { MenuBundle, MenuItem } from '../types';

type MenuVariantOption = {
  menuItemVariantId: string;
  label: string;
  category: string;
  priceCents: number;
};

type MenuBundleUpdateInput = Partial<{
  name: string;
  priceCents: number;
  isAvailable: boolean;
  isSoldOut: boolean;
  items: Array<{ menuItemVariantId: string; quantity: number }>;
}>;

type MenuManagementPanelProps = {
  menuCategories: string[];
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  menuVariantOptions: MenuVariantOption[];
  newMenuName: string;
  newMenuCategory: string;
  newMenuPrice: string;
  newMenuAvailable: boolean;
  newBundleName: string;
  newBundlePrice: string;
  newBundleAvailable: boolean;
  newBundleItems: Record<string, number>;
  menuItemErrors: Partial<Record<'name' | 'price', string>>;
  menuBundleErrors: Partial<Record<'name' | 'price' | 'items', string>>;
  isCreatingMenuItem: boolean;
  isCreatingMenuBundle: boolean;
  formatMoney: (cents: number) => string;
  dollarsToCents: (value: string) => number;
  formatMenuBundleItemLabel: (item: MenuBundle['items'][number]) => string;
  getBundleComponentQuantity: (menuBundle: MenuBundle, menuItemVariantId: string) => number;
  isAlwaysAvailableMenuItem: (menuItem: MenuItem) => boolean;
  onCreateMenuItem: (event: FormEvent<HTMLFormElement>) => void;
  onCreateMenuBundle: (event: FormEvent<HTMLFormElement>) => void;
  onNewMenuNameChange: (value: string) => void;
  onNewMenuCategoryChange: (value: string) => void;
  onNewMenuPriceChange: (value: string) => void;
  onNewMenuAvailableChange: (isAvailable: boolean) => void;
  onNewBundleNameChange: (value: string) => void;
  onNewBundlePriceChange: (value: string) => void;
  onNewBundleAvailableChange: (isAvailable: boolean) => void;
  onNewBundleItemQuantityChange: (menuItemVariantId: string, quantity: number) => void;
  onMenuItemUpdate: (menuItem: MenuItem, input: Partial<MenuItem>) => void;
  onMenuItemSoldOutChange: (menuItem: MenuItem, isSoldOut: boolean) => void;
  onMenuBundleUpdate: (menuBundle: MenuBundle, input: MenuBundleUpdateInput) => void;
  onMenuBundleSoldOutChange: (menuBundle: MenuBundle, isSoldOut: boolean) => void;
  onBundleComponentChange: (menuBundle: MenuBundle, menuItemVariantId: string, quantity: number) => void;
};

export function MenuManagementPanel({
  menuCategories,
  menuItems,
  menuBundles,
  menuVariantOptions,
  newMenuName,
  newMenuCategory,
  newMenuPrice,
  newMenuAvailable,
  newBundleName,
  newBundlePrice,
  newBundleAvailable,
  newBundleItems,
  menuItemErrors,
  menuBundleErrors,
  isCreatingMenuItem,
  isCreatingMenuBundle,
  formatMoney,
  dollarsToCents,
  formatMenuBundleItemLabel,
  getBundleComponentQuantity,
  isAlwaysAvailableMenuItem,
  onCreateMenuItem,
  onCreateMenuBundle,
  onNewMenuNameChange,
  onNewMenuCategoryChange,
  onNewMenuPriceChange,
  onNewMenuAvailableChange,
  onNewBundleNameChange,
  onNewBundlePriceChange,
  onNewBundleAvailableChange,
  onNewBundleItemQuantityChange,
  onMenuItemUpdate,
  onMenuItemSoldOutChange,
  onMenuBundleUpdate,
  onMenuBundleSoldOutChange,
  onBundleComponentChange
}: MenuManagementPanelProps) {
  const itemCategories = menuCategories.filter((category) => category !== 'Combos');

  return (
    <section className="admin-panel">
      <div className="panel-heading">
        <h2>Menu Management</h2>
        <span>{menuItems.length} items / {menuBundles.length} combos</span>
      </div>

      <form className="menu-admin-form" onSubmit={onCreateMenuItem} noValidate>
        <label className={menuItemErrors.name ? 'has-error' : ''}>
          <span>Item <span className="required-mark">*</span></span>
          <input value={newMenuName} onChange={(event) => onNewMenuNameChange(event.target.value)} />
          {menuItemErrors.name && <span className="field-error">{menuItemErrors.name}</span>}
        </label>
        <label>
          Category
          <select value={newMenuCategory} onChange={(event) => onNewMenuCategoryChange(event.target.value)}>
            {itemCategories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className={menuItemErrors.price ? 'has-error' : ''}>
          <span>Price <span className="required-mark">*</span></span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={newMenuPrice}
            onChange={(event) => onNewMenuPriceChange(event.target.value)}
          />
          {menuItemErrors.price && <span className="field-error">{menuItemErrors.price}</span>}
        </label>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={newMenuAvailable}
            onChange={(event) => onNewMenuAvailableChange(event.target.checked)}
          />
          Available
        </label>
        <button className="primary-button" disabled={isCreatingMenuItem}>
          {isCreatingMenuItem ? 'Creating...' : 'Create Item'}
        </button>
      </form>

      <div className="menu-admin-list">
        {menuItems.map((menuItem) => (
          <article key={menuItem.id} className="menu-admin-row">
            <div className="menu-admin-name">
              <strong>{menuItem.name}</strong>
              {isAlwaysAvailableMenuItem(menuItem) && <span className="protected-label">Protected availability</span>}
              {menuItem.variants.length > 1 && (
                <span>{menuItem.variants.map((variant) => `${variant.name} ${formatMoney(variant.priceCents)}`).join(' / ')}</span>
              )}
            </div>
            <input
              aria-label={`${menuItem.name} name`}
              defaultValue={menuItem.name}
              onBlur={(event) => {
                if (event.target.value !== menuItem.name) {
                  onMenuItemUpdate(menuItem, { name: event.target.value });
                }
              }}
            />
            <select
              aria-label={`${menuItem.name} category`}
              value={menuItem.category}
              onChange={(event) => {
                if (event.target.value !== menuItem.category) {
                  onMenuItemUpdate(menuItem, { category: event.target.value });
                }
              }}
            >
              {itemCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <input
              aria-label={`${menuItem.name} price`}
              defaultValue={(menuItem.priceCents / 100).toFixed(2)}
              min="0"
              step="0.01"
              type="number"
              onBlur={(event) => {
                const priceCents = dollarsToCents(event.target.value);
                if (priceCents !== menuItem.priceCents) {
                  onMenuItemUpdate(menuItem, { priceCents });
                }
              }}
            />
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={menuItem.isAvailable}
                disabled={isAlwaysAvailableMenuItem(menuItem)}
                onChange={(event) => onMenuItemUpdate(menuItem, { isAvailable: event.target.checked })}
              />
              Available
            </label>
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={menuItem.isSoldOut}
                disabled={isAlwaysAvailableMenuItem(menuItem)}
                onChange={(event) => onMenuItemSoldOutChange(menuItem, event.target.checked)}
              />
              Sold Out
            </label>
          </article>
        ))}
      </div>

      <div className="combo-management">
        <div className="panel-heading compact-heading">
          <h3>Combos</h3>
          <span>{menuBundles.filter((bundle) => bundle.isAvailable && !bundle.isSoldOut).length} active</span>
        </div>

        <form className="bundle-admin-form" onSubmit={onCreateMenuBundle} noValidate>
          <label className={menuBundleErrors.name ? 'has-error' : ''}>
            <span>Combo <span className="required-mark">*</span></span>
            <input value={newBundleName} onChange={(event) => onNewBundleNameChange(event.target.value)} />
            {menuBundleErrors.name && <span className="field-error">{menuBundleErrors.name}</span>}
          </label>
          <label className={menuBundleErrors.price ? 'has-error' : ''}>
            <span>Price <span className="required-mark">*</span></span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={newBundlePrice}
              onChange={(event) => onNewBundlePriceChange(event.target.value)}
            />
            {menuBundleErrors.price && <span className="field-error">{menuBundleErrors.price}</span>}
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={newBundleAvailable}
              onChange={(event) => onNewBundleAvailableChange(event.target.checked)}
            />
            Available
          </label>
          <button className="primary-button" disabled={isCreatingMenuBundle}>
            {isCreatingMenuBundle ? 'Creating...' : 'Create Combo'}
          </button>

          <div className="bundle-component-picker">
            {menuBundleErrors.items && <div className="field-error bundle-error">{menuBundleErrors.items}</div>}
            {menuVariantOptions.map((option) => (
              <label key={option.menuItemVariantId}>
                <span>{option.label}</span>
                <input
                  aria-label={`${option.label} combo quantity`}
                  min="0"
                  type="number"
                  value={newBundleItems[option.menuItemVariantId] ?? 0}
                  onChange={(event) => onNewBundleItemQuantityChange(option.menuItemVariantId, Number(event.target.value))}
                />
              </label>
            ))}
          </div>
        </form>

        <div className="bundle-admin-list">
          {menuBundles.map((bundle) => (
            <article key={bundle.id} className="bundle-admin-row">
              <div className="bundle-admin-main">
                <div className="menu-admin-name">
                  <strong>{bundle.name}</strong>
                  <div className="bundle-component-summary">
                    {bundle.items.map((item) => (
                      <span
                        key={item.menuItemVariantId}
                        className={!item.isAvailable || item.isSoldOut ? 'component-unavailable' : ''}
                      >
                        {formatMenuBundleItemLabel(item)} x {item.quantity}
                        {!item.isAvailable ? ' / Unavailable' : item.isSoldOut ? ' / Sold out' : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <input
                  aria-label={`${bundle.name} name`}
                  defaultValue={bundle.name}
                  onBlur={(event) => {
                    if (event.target.value !== bundle.name) {
                      onMenuBundleUpdate(bundle, { name: event.target.value });
                    }
                  }}
                />
                <input
                  aria-label={`${bundle.name} price`}
                  defaultValue={(bundle.priceCents / 100).toFixed(2)}
                  min="0"
                  step="0.01"
                  type="number"
                  onBlur={(event) => {
                    const priceCents = dollarsToCents(event.target.value);
                    if (priceCents !== bundle.priceCents) {
                      onMenuBundleUpdate(bundle, { priceCents });
                    }
                  }}
                />
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={bundle.isAvailable}
                    onChange={(event) => onMenuBundleUpdate(bundle, { isAvailable: event.target.checked })}
                  />
                  Available
                </label>
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={bundle.isSoldOut}
                    onChange={(event) => onMenuBundleSoldOutChange(bundle, event.target.checked)}
                  />
                  Sold Out
                </label>
              </div>
              <div className="bundle-component-grid">
                {menuVariantOptions.map((option) => (
                  <label key={option.menuItemVariantId}>
                    <span>{option.label}</span>
                    <input
                      aria-label={`${bundle.name} ${option.label} quantity`}
                      defaultValue={getBundleComponentQuantity(bundle, option.menuItemVariantId)}
                      min="0"
                      type="number"
                      onBlur={(event) => {
                        const quantity = Number(event.target.value);
                        if (quantity !== getBundleComponentQuantity(bundle, option.menuItemVariantId)) {
                          onBundleComponentChange(bundle, option.menuItemVariantId, quantity);
                        }
                      }}
                    />
                  </label>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

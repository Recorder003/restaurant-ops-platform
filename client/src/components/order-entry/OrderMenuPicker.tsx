import { useEffect, useRef } from 'react';
import type { DraftItem, MenuBundle, MenuItem } from '../../types';
import type { OrderFormErrors } from '../../utils/orderFormValidation';

type OrderMenuPickerProps = {
  categories: string[];
  selectedCategory: string;
  selectedItems: Record<string, number>;
  selectedBundles: Record<string, number>;
  menuItems: MenuItem[];
  menuBundles: MenuBundle[];
  draftItems: DraftItem[];
  formErrors: OrderFormErrors;
  notes: string;
  isSubmitting: boolean;
  editingOrderId: string | null;
  formatMoney: (cents: number) => string;
  formatMenuVariantLabel: (menuItem: MenuItem, variant: MenuItem['variants'][number]) => string;
  getMenuItemVariantById: (menuItems: MenuItem[], variantId: string) => MenuItem['variants'][number] | undefined;
  onSelectedCategoryChange: (category: string) => void;
  onMenuQuantityChange: (menuItemVariantId: string, quantity: number) => void;
  onBundleQuantityChange: (bundleId: string, quantity: number) => void;
  onNotesChange: (value: string) => void;
  onCancel: () => void;
};

export function OrderMenuPicker({
  categories,
  selectedCategory,
  selectedItems,
  selectedBundles,
  menuItems,
  menuBundles,
  draftItems,
  formErrors,
  notes,
  isSubmitting,
  editingOrderId,
  formatMoney,
  formatMenuVariantLabel,
  getMenuItemVariantById,
  onSelectedCategoryChange,
  onMenuQuantityChange,
  onBundleQuantityChange,
  onNotesChange,
  onCancel
}: OrderMenuPickerProps) {
  const menuErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formErrors.items) {
      menuErrorRef.current?.focus();
    }
  }, [formErrors.items]);

  return (
    <div className="wizard-menu">
      <aside className="category-rail">
        {categories.map((category) => (
          <button
            key={category}
            className={selectedCategory === category ? 'selected' : ''}
            type="button"
            onClick={() => onSelectedCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </aside>

      <div className="wizard-menu-items">
        {selectedCategory === 'Combos' && menuBundles.map((bundle) => (
          <button
            key={bundle.id}
            className="menu-tile combo-tile"
            type="button"
            onClick={() => onBundleQuantityChange(bundle.id, (selectedBundles[bundle.id] ?? 0) + 1)}
          >
            <strong>{bundle.name}</strong>
            <span>{formatMoney(bundle.priceCents)}</span>
            <small>{bundle.items.map((item) => item.menuItemName).join(' + ')}</small>
            {(selectedBundles[bundle.id] ?? 0) > 0 && <em>x{selectedBundles[bundle.id]}</em>}
          </button>
        ))}
        {menuItems
          .filter((item) => item.category === selectedCategory)
          .map((item) => (
            item.variants.map((variant) => (
              <button
                key={variant.id}
                className="menu-tile"
                type="button"
                onClick={() => onMenuQuantityChange(variant.id, (selectedItems[variant.id] ?? 0) + 1)}
              >
                <strong>{formatMenuVariantLabel(item, variant)}</strong>
                <span>{formatMoney(variant.priceCents)}</span>
                {(selectedItems[variant.id] ?? 0) > 0 && <em>x{selectedItems[variant.id]}</em>}
              </button>
            ))
          ))}
      </div>

      <aside className="order-summary">
        <h3>Order</h3>
        {formErrors.items && (
          <div className="field-error menu-error" ref={menuErrorRef} tabIndex={-1}>
            {formErrors.items}
          </div>
        )}
        {draftItems.length === 0 ? (
          <p>No items selected</p>
        ) : (
          <ul>
            {draftItems.map((item) => {
              if (item.bundleId) {
                const bundle = menuBundles.find((candidate) => candidate.id === item.bundleId);

                return (
                  <li key={item.bundleId}>
                    <span>{bundle?.name} x {item.quantity}</span>
                    <div>
                      <button type="button" onClick={() => onBundleQuantityChange(item.bundleId!, item.quantity - 1)}>-</button>
                      <button type="button" onClick={() => onBundleQuantityChange(item.bundleId!, item.quantity + 1)}>+</button>
                    </div>
                  </li>
                );
              }

              const menuItem = menuItems.find((candidate) => candidate.id === item.menuItemId);
              const variant = item.menuItemVariantId ? getMenuItemVariantById(menuItems, item.menuItemVariantId) : undefined;

              return (
                <li key={item.menuItemVariantId}>
                  <span>{menuItem && variant ? formatMenuVariantLabel(menuItem, variant) : menuItem?.name} x {item.quantity}</span>
                  <div>
                    <button type="button" onClick={() => onMenuQuantityChange(item.menuItemVariantId!, item.quantity - 1)}>-</button>
                    <button type="button" onClick={() => onMenuQuantityChange(item.menuItemVariantId!, item.quantity + 1)}>+</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <label>
          Notes
          <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} rows={3} />
        </label>
        <div className="wizard-nav">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : editingOrderId ? 'Save Changes' : 'Submit Order'}
          </button>
        </div>
      </aside>
    </div>
  );
}

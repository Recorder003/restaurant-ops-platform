import type { FormEvent } from 'react';
import type { Order, OrderItem, PaymentMethod, SplitBill } from '../types';

type CheckoutModalProps = {
  order: Order;
  isSplitBillOpen: boolean;
  splitBills: SplitBill[];
  activeSplitBill: SplitBill | undefined;
  activeSplitBillId: string | null;
  activeSplitLabel: string;
  isActiveAmountSplit: boolean;
  selectedItemIds: string[];
  unpaidItems: OrderItem[];
  paymentMethod: PaymentMethod;
  tip: string;
  tipPreset: number | 'custom';
  tipPresetOptions: number[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  isCheckingOut: boolean;
  formatMoney: (cents: number) => string;
  formatOrderItemName: (item: OrderItem) => string;
  getOrderTitle: (order: Order) => string;
  getSplitBillSubtotal: (splitBill: SplitBill, items: OrderItem[]) => number;
  isPayableSplitBill: (splitBill: SplitBill) => boolean;
  onCloseCheckout: () => void;
  onSubmitCheckout: (event: FormEvent<HTMLFormElement>) => void;
  onOpenSplitBill: () => void;
  onCloseSplitBill: () => void;
  onTipPreset: (percent: number) => void;
  onTipChange: (value: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onActiveSplitBillChange: (splitBillId: string) => void;
  onAddSplitBill: () => void;
  onSplitItemClick: (itemId: string) => void;
  onDistributeSplitBills: (mode: 'items' | 'amount' | 'seats') => void;
  onSelectAllForActiveSplit: () => void;
  onClearActiveSplit: () => void;
  onMergeSplitBills: () => void;
  onRemoveActiveSplitBill: () => void;
  onApplyActiveSplitBill: () => void;
};

export function CheckoutModal({
  order,
  isSplitBillOpen,
  splitBills,
  activeSplitBill,
  activeSplitBillId,
  activeSplitLabel,
  isActiveAmountSplit,
  selectedItemIds,
  unpaidItems,
  paymentMethod,
  tip,
  tipPreset,
  tipPresetOptions,
  subtotalCents,
  taxCents,
  tipCents,
  totalCents,
  isCheckingOut,
  formatMoney,
  formatOrderItemName,
  getOrderTitle,
  getSplitBillSubtotal,
  isPayableSplitBill,
  onCloseCheckout,
  onSubmitCheckout,
  onOpenSplitBill,
  onCloseSplitBill,
  onTipPreset,
  onTipChange,
  onPaymentMethodChange,
  onActiveSplitBillChange,
  onAddSplitBill,
  onSplitItemClick,
  onDistributeSplitBills,
  onSelectAllForActiveSplit,
  onClearActiveSplit,
  onMergeSplitBills,
  onRemoveActiveSplitBill,
  onApplyActiveSplitBill
}: CheckoutModalProps) {
  return (
    <>
      <div className="modal-backdrop">
        <section className="history-modal checkout-modal" role="dialog" aria-modal="true" aria-label="Checkout order">
          <div className="panel-heading">
            <div>
              <h2>Checkout</h2>
              <span>{getOrderTitle(order)}</span>
            </div>
            <button className="ghost-button" onClick={onCloseCheckout}>
              Close
            </button>
          </div>

          <form className="checkout-form" onSubmit={onSubmitCheckout}>
            <div className="checkout-selection-summary">
              <div>
                <strong>{activeSplitLabel}</strong>
                <span>{isActiveAmountSplit ? 'Amount split' : `${selectedItemIds.length} of ${unpaidItems.length} unpaid items selected`} / {splitBills.filter(isPayableSplitBill).length} split left</span>
              </div>
              <button className="ghost-button" type="button" onClick={onOpenSplitBill}>
                Split Bill
              </button>
            </div>

            <ul className="checkout-lines">
              <li><span>Subtotal</span><strong>{formatMoney(subtotalCents)}</strong></li>
              <li><span>Tax</span><strong>{formatMoney(taxCents)}</strong></li>
              <li>
                <div className="tip-picker">
                  <span>Tip</span>
                  <div className="tip-presets">
                    {tipPresetOptions.map((percent) => (
                      <button
                        key={percent}
                        className={tipPreset === percent ? 'selected' : ''}
                        type="button"
                        onClick={() => onTipPreset(percent)}
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                  <label>
                    Custom
                    <input
                      min="0"
                      step="0.01"
                      type="number"
                      value={tip}
                      onChange={(event) => onTipChange(event.target.value)}
                    />
                  </label>
                </div>
                <strong>{formatMoney(tipCents)}</strong>
              </li>
              <li className="checkout-total"><span>Total</span><strong>{formatMoney(totalCents)}</strong></li>
            </ul>

            <label>
              Payment Method
              <select value={paymentMethod} onChange={(event) => onPaymentMethodChange(event.target.value as PaymentMethod)}>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
              </select>
            </label>

            <button className="primary-button" disabled={isCheckingOut}>
              {isCheckingOut ? 'Processing...' : 'Confirm Payment'}
            </button>
          </form>
        </section>
      </div>

      {isSplitBillOpen && (
        <div className="modal-backdrop split-bill-backdrop">
          <section className="history-modal split-bill-modal" role="dialog" aria-modal="true" aria-label="Split bill">
            <div className="panel-heading">
              <div>
                <h2>Split Bill</h2>
                <span>{getOrderTitle(order)}</span>
              </div>
              <button className="ghost-button" onClick={onCloseSplitBill}>
                Close
              </button>
            </div>

            <div className="split-bill-workspace">
              <section className="split-bill-groups" aria-label="Current split bills">
                {splitBills.map((splitBill, index) => (
                  <button
                    key={splitBill.id}
                    className={`split-card split-color-${index % 5} ${splitBill.id === activeSplitBillId ? 'selected' : ''}`}
                    type="button"
                    onClick={() => onActiveSplitBillChange(splitBill.id)}
                  >
                    <strong>{splitBill.label}</strong>
                    <span>{splitBill.amountCents !== undefined ? 'Amount split' : `${splitBill.itemIds.length} items`}</span>
                    <em>{formatMoney(getSplitBillSubtotal(splitBill, unpaidItems))}</em>
                  </button>
                ))}
                <button className="split-add-card" type="button" onClick={onAddSplitBill}>
                  <span>Add Split</span>
                  <strong>+</strong>
                </button>
              </section>

              <section className="split-item-list" aria-label="Order items">
                <div className="split-order-meta">
                  <span>Selected</span>
                  <strong>{activeSplitBill ? `${activeSplitBill.label} / ${formatMoney(getSplitBillSubtotal(activeSplitBill, unpaidItems))}` : '-'}</strong>
                </div>
                {unpaidItems.map((item) => {
                  const assignedIndex = splitBills.findIndex((splitBill) => splitBill.amountCents === undefined && splitBill.itemIds.includes(item.id));
                  const isActive = activeSplitBill?.itemIds.includes(item.id) ?? false;

                  return (
                    <button
                      key={item.id}
                      className={`split-item ${assignedIndex >= 0 ? `split-color-${assignedIndex % 5}` : ''} ${isActive ? 'selected' : ''}`}
                      type="button"
                      onClick={() => onSplitItemClick(item.id)}
                    >
                      <span>{formatOrderItemName(item)}</span>
                      <small>{assignedIndex >= 0 ? splitBills[assignedIndex].label : 'Unassigned'}</small>
                      <strong>{formatMoney(item.priceCents * item.quantity)}</strong>
                    </button>
                  );
                })}
              </section>

              <aside className="split-tools" aria-label="Split tools">
                <button type="button" onClick={() => onDistributeSplitBills('items')}>Even Items</button>
                <button type="button" onClick={() => onDistributeSplitBills('amount')}>By Amount</button>
                <button type="button" onClick={() => onDistributeSplitBills('seats')}>By Seats</button>
                <button type="button" onClick={onSelectAllForActiveSplit}>Select All</button>
                <button type="button" onClick={onClearActiveSplit}>Clear</button>
                <button type="button" onClick={onMergeSplitBills}>Merge</button>
                <button type="button" onClick={onRemoveActiveSplitBill}>Remove</button>
              </aside>
            </div>

            <div className="split-bill-footer">
              <div>
                <span>Total unpaid</span>
                <strong>{formatMoney(unpaidItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0))}</strong>
              </div>
              <div className="modal-actions">
                <button className="ghost-button" onClick={onCloseSplitBill}>
                  Cancel
                </button>
                <button className="primary-button" onClick={onApplyActiveSplitBill}>
                  Use Selected Split
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

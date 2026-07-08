import {
  fulfillmentLabels,
  orderSourceLabels,
  tableStatusLabels,
  tipPresetOptions
} from '../config/appConfig';
import type { useCheckoutFlow } from '../hooks/useCheckoutFlow';
import type { useOrderDocuments } from '../hooks/useOrderDocuments';
import type { Order, RestaurantTable } from '../types';
import { formatDateTime, formatMoney } from '../utils/formatters';
import { formatOrderItemName, getOrderTitle } from '../utils/orderDraftUtils';
import { formatOrderEvent } from '../utils/orderFilterUtils';
import { getSplitBillSubtotal, isPayableSplitBill } from '../utils/splitBillUtils';
import { CheckoutModal } from './CheckoutModal';
import { OrderHistoryModal } from './OrderHistoryModal';
import { ReceiptModal } from './ReceiptModal';
import { TablePickerModal } from './TablePickerModal';

type AppModalsProps = {
  documents: ReturnType<typeof useOrderDocuments>;
  checkout: ReturnType<typeof useCheckoutFlow>;
  isTablePickerOpen: boolean;
  tables: RestaurantTable[];
  tableNumber: string;
  selectedTable: RestaurantTable | undefined;
  onTableSelect: (table: RestaurantTable) => void;
  onCloseTablePicker: () => void;
};

export function AppModals({
  documents,
  checkout,
  isTablePickerOpen,
  tables,
  tableNumber,
  selectedTable,
  onTableSelect,
  onCloseTablePicker
}: AppModalsProps) {
  return (
    <>
      {documents.historyOrder && (
        <OrderHistoryModal
          order={documents.historyOrder}
          events={documents.orderEvents}
          isLoading={documents.isLoadingEvents}
          getOrderTitle={getOrderTitle}
          formatOrderEvent={formatOrderEvent}
          formatDateTime={formatDateTime}
          onClose={documents.closeHistory}
        />
      )}

      {isTablePickerOpen && (
        <TablePickerModal
          tables={tables}
          tableNumber={tableNumber}
          selectedTable={selectedTable}
          tableStatusLabels={tableStatusLabels}
          onSelect={onTableSelect}
          onClose={onCloseTablePicker}
        />
      )}

      {documents.receiptOrder && (
        <ReceiptModal
          order={documents.receiptOrder}
          orderSourceLabels={orderSourceLabels}
          fulfillmentLabels={fulfillmentLabels}
          formatMoney={formatMoney}
          formatOrderItemName={formatOrderItemName}
          formatDateTime={formatDateTime}
          getOrderTitle={getOrderTitle}
          onPrint={documents.printReceipt}
          onClose={documents.closeReceipt}
        />
      )}

      {checkout.checkoutTarget && (
        <CheckoutModal
          order={checkout.checkoutTarget}
          isSplitBillOpen={checkout.isSplitBillOpen}
          splitBills={checkout.splitBills}
          activeSplitBill={checkout.activeSplitBill}
          activeSplitBillId={checkout.activeSplitBillId}
          activeSplitLabel={checkout.activeSplitLabel}
          isActiveAmountSplit={checkout.isActiveAmountSplit}
          selectedItemIds={checkout.checkoutSelectedItemIds}
          unpaidItems={checkout.checkoutUnpaidItems}
          paymentMethod={checkout.checkoutPaymentMethod}
          tip={checkout.checkoutTip}
          tipPreset={checkout.checkoutTipPreset}
          tipPresetOptions={tipPresetOptions}
          subtotalCents={checkout.checkoutSubtotalCents}
          taxCents={checkout.checkoutTaxCents}
          tipCents={checkout.checkoutTipCents}
          totalCents={checkout.checkoutTotalCents}
          isCheckingOut={checkout.isCheckingOut}
          formatMoney={formatMoney}
          formatOrderItemName={formatOrderItemName}
          getOrderTitle={getOrderTitle}
          getSplitBillSubtotal={getSplitBillSubtotal}
          isPayableSplitBill={isPayableSplitBill}
          onCloseCheckout={checkout.closeCheckout}
          onSubmitCheckout={checkout.handleCheckoutSubmit}
          onOpenSplitBill={checkout.handleOpenSplitBill}
          onCloseSplitBill={() => checkout.setIsSplitBillOpen(false)}
          onTipPreset={checkout.handleTipPreset}
          onTipChange={checkout.handleTipChange}
          onPaymentMethodChange={checkout.setCheckoutPaymentMethod}
          onActiveSplitBillChange={checkout.setActiveSplitBillId}
          onAddSplitBill={checkout.handleAddSplitBill}
          onSplitItemClick={checkout.handleSplitItemClick}
          onDistributeSplitBills={checkout.handleDistributeSplitBills}
          onSelectAllForActiveSplit={checkout.handleSelectAllForActiveSplit}
          onClearActiveSplit={checkout.handleClearActiveSplit}
          onMergeSplitBills={checkout.handleMergeSplitBills}
          onRemoveActiveSplitBill={checkout.handleRemoveActiveSplitBill}
          onApplyActiveSplitBill={checkout.handleApplyActiveSplitBill}
        />
      )}
    </>
  );
}

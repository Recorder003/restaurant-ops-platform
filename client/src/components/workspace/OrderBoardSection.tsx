import { OrderBoard } from '../OrderBoard';
import type { useCheckoutFlow } from '../../hooks/useCheckoutFlow';
import type { useOrderBoard } from '../../hooks/useOrderBoard';
import type { useOrderDocuments } from '../../hooks/useOrderDocuments';
import type { useOrderDraft } from '../../hooks/useOrderDraft';
import type { User } from '../../types';
import { formatMoney } from '../../utils/formatters';
import { formatOrderItemName, getOrderTitle } from '../../utils/orderDraftUtils';

type OrderBoardSectionProps = {
  role: User['role'];
  isLoading: boolean;
  orderBoard: ReturnType<typeof useOrderBoard>;
  orderDraft: ReturnType<typeof useOrderDraft>;
  documents: ReturnType<typeof useOrderDocuments>;
  checkout: ReturnType<typeof useCheckoutFlow>;
};

export function OrderBoardSection({
  role,
  isLoading,
  orderBoard,
  orderDraft,
  documents,
  checkout
}: OrderBoardSectionProps) {
  return (
    <OrderBoard
      role={role}
      orders={orderBoard.orders}
      filteredOrders={orderBoard.filteredOrders}
      filters={orderBoard.filters}
      pagination={orderBoard.pagination}
      isLoading={isLoading || orderBoard.isLoadingOrders}
      processingOrderActionId={orderBoard.processingOrderActionId}
      processingItemActionId={orderBoard.processingItemActionId}
      formatMoney={formatMoney}
      formatOrderItemName={formatOrderItemName}
      getOrderTitle={getOrderTitle}
      onFiltersChange={orderBoard.setFilters}
      onFilterSubmit={orderBoard.handleFilterSubmit}
      onFilterReset={orderBoard.handleFilterReset}
      onPageChange={orderBoard.handlePageChange}
      onReceipt={documents.openReceipt}
      onHistory={documents.openHistory}
      onEdit={orderDraft.handleEditOrder}
      onOrderStatusChange={orderBoard.handleStatusChange}
      onItemStatusChange={orderBoard.handleItemStatusChange}
      onCheckout={checkout.openCheckout}
    />
  );
}

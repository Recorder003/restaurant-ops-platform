import type { FormEvent } from 'react';
import { OrderCard } from './OrderCard';
import { statusLabels } from '../utils/orderRules';
import type { Order, OrderFilters, OrderItem, OrderItemStatus, OrderStatus, UserRole } from '../types';

export type OrderFilterState = Omit<OrderFilters, 'status'> & {
  status: OrderStatus | 'all' | 'active';
};

type OrderPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type OrderBoardProps = {
  role: UserRole;
  orders: Order[];
  filteredOrders: Order[];
  filters: OrderFilterState;
  pagination: OrderPagination;
  isLoading: boolean;
  processingOrderActionId: string | null;
  processingItemActionId: string | null;
  formatMoney: (cents: number) => string;
  formatOrderItemName: (item: OrderItem) => string;
  getOrderTitle: (order: Order) => string;
  onFiltersChange: (filters: OrderFilterState | ((current: OrderFilterState) => OrderFilterState)) => void;
  onFilterSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFilterReset: () => void;
  onPageChange: (page: number) => void;
  onReceipt: (order: Order) => void;
  onHistory: (order: Order) => void;
  onEdit: (order: Order) => void;
  onOrderStatusChange: (order: Order, status: OrderStatus) => void;
  onItemStatusChange: (order: Order, item: OrderItem, status: OrderItemStatus) => void;
  onCheckout: (order: Order) => void;
};

export function OrderBoard({
  role,
  orders,
  filteredOrders,
  filters,
  pagination,
  isLoading,
  processingOrderActionId,
  processingItemActionId,
  formatMoney,
  formatOrderItemName,
  getOrderTitle,
  onFiltersChange,
  onFilterSubmit,
  onFilterReset,
  onPageChange,
  onReceipt,
  onHistory,
  onEdit,
  onOrderStatusChange,
  onItemStatusChange,
  onCheckout
}: OrderBoardProps) {
  return (
    <section className="orders-panel">
      <div className="panel-heading">
        <h2>{role === 'chef' ? 'Kitchen Board' : 'Order Board'}</h2>
        <span>{pagination.total} matching orders</span>
      </div>

      <form className="order-filters" onSubmit={onFilterSubmit}>
        <div className="filter-fields">
          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => onFiltersChange((current) => ({
                ...current,
                status: event.target.value as OrderStatus | 'all' | 'active'
              }))}
            >
              {role === 'staff' && <option value="active">Active Orders</option>}
              {role !== 'staff' && <option value="all">All Statuses</option>}
              {getVisibleStatusOptions(role).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Table
            <input
              value={filters.tableNumber}
              onChange={(event) => onFiltersChange((current) => ({ ...current, tableNumber: event.target.value }))}
            />
          </label>
          {role !== 'staff' && (
            <>
              <label>
                Server
                <input
                  value={filters.serverName}
                  onChange={(event) => onFiltersChange((current) => ({ ...current, serverName: event.target.value }))}
                />
              </label>
              <label>
                From
                <input
                  type="date"
                  value={filters.fromDate}
                  onChange={(event) => onFiltersChange((current) => ({ ...current, fromDate: event.target.value }))}
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={filters.toDate}
                  onChange={(event) => onFiltersChange((current) => ({ ...current, toDate: event.target.value }))}
                />
              </label>
            </>
          )}
        </div>
        <div className="filter-actions">
          <button className="primary-button">Apply</button>
          <button className="ghost-button" type="button" onClick={onFilterReset}>
            Clear
          </button>
        </div>
      </form>

      <div className="metrics">
        <Metric label={role === 'staff' ? 'Today Orders' : 'Shown Orders'} value={orders.length.toString()} />
        <Metric label={role === 'staff' ? 'Today Active' : 'Shown Active'} value={orders.filter((order) => ['pending', 'preparing', 'ready'].includes(order.status)).length.toString()} />
        <Metric label={role === 'staff' ? 'Today Paid' : 'Shown Paid'} value={formatMoney(orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + (order.paymentTotalCents ?? order.totalCents), 0))} />
      </div>

      <div className="order-grid">
        {isLoading ? (
          <div className="empty-state">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">No orders yet</div>
        ) : (
          filteredOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              role={role}
              processingOrderActionId={processingOrderActionId}
              processingItemActionId={processingItemActionId}
              formatMoney={formatMoney}
              formatOrderItemName={formatOrderItemName}
              getOrderTitle={getOrderTitle}
              onReceipt={onReceipt}
              onHistory={onHistory}
              onEdit={onEdit}
              onOrderStatusChange={onOrderStatusChange}
              onItemStatusChange={onItemStatusChange}
              onCheckout={onCheckout}
            />
          ))
        )}
      </div>

      <div className="pagination">
        <button
          className="ghost-button"
          disabled={pagination.page <= 1 || isLoading}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          Previous
        </button>
        <span>
          Page {pagination.totalPages === 0 ? 0 : pagination.page} of {pagination.totalPages}
        </span>
        <button
          className="ghost-button"
          disabled={pagination.page >= pagination.totalPages || isLoading}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getVisibleStatusOptions(role: UserRole) {
  const entries = Object.entries(statusLabels) as Array<[OrderStatus, string]>;

  return role === 'chef'
    ? entries.filter(([status]) => isKitchenStatus(status))
    : entries;
}

function isKitchenStatus(status: OrderStatus | 'all' | 'active') {
  return status === 'all' || status === 'pending' || status === 'preparing';
}

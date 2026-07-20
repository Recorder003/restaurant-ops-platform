import type { AdminManagerDashboard, OrderItemStatus, OrderStatus } from '../types';
import { formatDateTime, formatMoney } from '../utils/formatters';

type AdminManagerDashboardPanelProps = {
  dashboard: AdminManagerDashboard | null;
  error: string | null;
  isLoading: boolean;
  isRefreshing?: boolean;
  lastRefreshAt?: string | null;
  onRefresh: () => void;
};

export function AdminManagerDashboardPanel({
  dashboard,
  error,
  isLoading,
  isRefreshing = false,
  lastRefreshAt = null,
  onRefresh
}: AdminManagerDashboardPanelProps) {
  return (
    <section className="admin-panel manager-dashboard-panel" aria-labelledby="manager-dashboard-title">
      <div className="panel-heading">
        <div>
          <h2 id="manager-dashboard-title">Manager Dashboard</h2>
          <p>Live source metrics used by the AI Daily Summary.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Refreshing...' : 'Refresh Metrics'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {!dashboard && !error && (
        <p className="empty-state">Refresh metrics to review today&apos;s revenue, active orders, kitchen queue, and top items without using AI credits.</p>
      )}

      {dashboard && (
        <div className="manager-dashboard-content">
          <div className="dashboard-status-row">
            <span className="dashboard-status-badge">Auto refresh on live changes</span>
            <span className="dashboard-timestamp">
              Source updated {formatDateTime(dashboard.generatedAt)}
              {lastRefreshAt ? ` / UI refreshed ${formatDateTime(lastRefreshAt)}` : ''}
            </span>
            {isRefreshing && <span className="dashboard-refreshing">Updating metrics...</span>}
          </div>

          <div className="dashboard-metrics" aria-label="Manager dashboard metrics">
            <DashboardMetric label="Orders" value={dashboard.metrics.orderCount.toString()} />
            <DashboardMetric label="Active" value={dashboard.metrics.activeOrderCount.toString()} />
            <DashboardMetric label="Unpaid" value={dashboard.metrics.unpaidOrderCount.toString()} />
            <DashboardMetric label="Paid Revenue" value={formatMoney(dashboard.metrics.paidRevenueCents)} />
            <DashboardMetric label="Avg Paid Order" value={formatMoney(dashboard.metrics.averagePaidOrderCents)} />
            <DashboardMetric label="Dine-in" value={dashboard.metrics.dineInCount.toString()} />
            <DashboardMetric label="To-go / Delivery" value={dashboard.metrics.toGoCount.toString()} />
            <DashboardMetric label="Over 20 Min" value={dashboard.metrics.activeOver20MinCount.toString()} />
          </div>

          <div className="dashboard-columns">
            <DashboardBars title="Order Status" rows={dashboard.statusCounts} getLabel={formatOrderStatus} />
            <DashboardBars title="Kitchen Queue" rows={dashboard.kitchenQueue} getLabel={formatKitchenStatus} />
            <TopItems items={dashboard.topItems} />
          </div>
        </div>
      )}
    </section>
  );
}

function DashboardMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric dashboard-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DashboardBars<T extends { count: number }>({
  title,
  rows,
  getLabel
}: {
  title: string;
  rows: T[];
  getLabel: (row: T) => string;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="dashboard-card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p>No data yet.</p>
      ) : (
        <ul className="dashboard-bar-list">
          {rows.map((row) => {
            const label = getLabel(row);
            const width = total > 0 ? `${Math.max(8, Math.round((row.count / total) * 100))}%` : '0%';

            return (
              <li key={label}>
                <div className="dashboard-bar-label">
                  <span>{label}</span>
                  <strong>{row.count}</strong>
                </div>
                <div className="dashboard-bar-track" aria-hidden="true">
                  <span style={{ width }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TopItems({ items }: { items: AdminManagerDashboard['topItems'] }) {
  return (
    <section className="dashboard-card">
      <h3>Top Items</h3>
      {items.length === 0 ? (
        <p>No item sales yet.</p>
      ) : (
        <ul className="dashboard-item-list">
          {items.map((item) => (
            <li key={item.name}>
              <span>{item.name} x {item.quantity}</span>
              <strong>{formatMoney(item.revenueCents)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatOrderStatus(row: { status: OrderStatus }) {
  return row.status.replace('_', ' ');
}

function formatKitchenStatus(row: { status: OrderItemStatus }) {
  return row.status.replace('_', ' ');
}

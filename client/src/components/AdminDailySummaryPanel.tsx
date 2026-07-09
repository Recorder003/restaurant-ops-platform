import type { AdminDailySummary } from '../types';
import { formatDateTime, formatMoney } from '../utils/formatters';

type AdminDailySummaryPanelProps = {
  dailySummary: AdminDailySummary | null;
  error: string | null;
  isLoading: boolean;
  onGenerate: () => void;
};

export function AdminDailySummaryPanel({
  dailySummary,
  error,
  isLoading,
  onGenerate
}: AdminDailySummaryPanelProps) {
  return (
    <section className="admin-panel ai-summary-panel" aria-labelledby="ai-summary-title">
      <div className="panel-heading">
        <div>
          <h2 id="ai-summary-title">AI Daily Summary</h2>
          <p>Admin-only operational insights based on today's live order data.</p>
        </div>
        <button type="button" onClick={onGenerate} disabled={isLoading}>
          {isLoading ? 'Analyzing...' : dailySummary ? 'Regenerate' : 'Generate Summary'}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      {!dailySummary && !error && (
        <p className="empty-state">Generate a daily summary to review revenue, active orders, kitchen queue, and suggested actions.</p>
      )}

      {dailySummary && (
        <div className="ai-summary-content">
          <div className="ai-summary-overview">
            <span className={`ai-source-badge ${dailySummary.source === 'ai' ? 'ai-source-badge-ai' : ''}`}>
              {dailySummary.source === 'ai' ? 'AI generated' : 'Rules fallback'}
            </span>
            <span>Generated {formatDateTime(dailySummary.generatedAt)}</span>
          </div>

          <p className="ai-summary-text">{dailySummary.summary}</p>

          <div className="ai-summary-metrics" aria-label="Daily metrics">
            <Metric label="Orders" value={dailySummary.metrics.orderCount.toString()} />
            <Metric label="Active" value={dailySummary.metrics.activeOrderCount.toString()} />
            <Metric label="Paid Revenue" value={formatMoney(dailySummary.metrics.paidRevenueCents)} />
            <Metric label="Avg Paid Order" value={formatMoney(dailySummary.metrics.averagePaidOrderCents)} />
          </div>

          <div className="ai-summary-columns">
            <SummaryList title="Highlights" items={dailySummary.highlights} />
            <SummaryList title="Recommended Actions" items={dailySummary.recommendations} />
            <TopItems items={dailySummary.topItems} />
          </div>
        </div>
      )}
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

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="ai-summary-card">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}

function TopItems({ items }: { items: AdminDailySummary['topItems'] }) {
  return (
    <section className="ai-summary-card">
      <h3>Top Items</h3>
      {items.length === 0 ? (
        <p>No item sales yet.</p>
      ) : (
        <ul>
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

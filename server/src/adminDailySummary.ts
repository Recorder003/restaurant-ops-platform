import { config } from './config.js';
import { query } from './db.js';
import type { OrderItemStatus, OrderStatus } from './types.js';

type DailyMetricRow = {
  order_count: number;
  active_order_count: number;
  cancelled_count: number;
  paid_order_count: number;
  unpaid_order_count: number;
  paid_revenue_cents: number;
  dine_in_count: number;
  to_go_count: number;
  phone_order_count: number;
  active_over_20_min_count: number;
};

type StatusCountRow = {
  status: OrderStatus;
  count: number;
};

type KitchenQueueRow = {
  status: OrderItemStatus;
  count: number;
};

type TopItemRow = {
  name: string;
  quantity: number;
  revenue_cents: number;
};

type DailySummaryData = {
  metrics: {
    orderCount: number;
    activeOrderCount: number;
    cancelledCount: number;
    paidOrderCount: number;
    unpaidOrderCount: number;
    paidRevenueCents: number;
    averagePaidOrderCents: number;
    dineInCount: number;
    toGoCount: number;
    phoneOrderCount: number;
    activeOver20MinCount: number;
  };
  topItems: Array<{ name: string; quantity: number; revenueCents: number }>;
  statusCounts: Array<{ status: OrderStatus; count: number }>;
  kitchenQueue: Array<{ status: OrderItemStatus; count: number }>;
};

type DailyNarrative = {
  summary: string;
  highlights: string[];
  recommendations: string[];
};

type AdminDailySummaryResponse = DailyNarrative & DailySummaryData & {
  generatedAt: string;
  source: 'ai' | 'rules';
};

type AdminManagerDashboardResponse = DailySummaryData & {
  generatedAt: string;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

export async function getAdminDailySummary(): Promise<AdminDailySummaryResponse> {
  const summaryData = await getDailySummaryData();
  const aiNarrative = await getAiDailyNarrative(summaryData);
  const fallbackNarrative = createFallbackDailyNarrative(summaryData);

  return {
    generatedAt: new Date().toISOString(),
    source: aiNarrative ? 'ai' : 'rules',
    ...(aiNarrative ?? fallbackNarrative),
    metrics: summaryData.metrics,
    topItems: summaryData.topItems,
    statusCounts: summaryData.statusCounts,
    kitchenQueue: summaryData.kitchenQueue
  };
}

export async function getAdminManagerDashboard(): Promise<AdminManagerDashboardResponse> {
  return {
    generatedAt: new Date().toISOString(),
    ...(await getDailySummaryData())
  };
}

async function getDailySummaryData(): Promise<DailySummaryData> {
  const [metricsResult, statusResult, kitchenResult, topItemsResult] = await Promise.all([
    query<DailyMetricRow>(`
      SELECT
        COUNT(*)::int AS order_count,
        COUNT(*) FILTER (WHERE status IN ('pending', 'preparing', 'ready'))::int AS active_order_count,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled_count,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS paid_order_count,
        COUNT(*) FILTER (WHERE payment_status IN ('unpaid', 'partially_paid'))::int AS unpaid_order_count,
        COALESCE((SELECT SUM(total_cents) FROM order_payments WHERE created_at >= date_trunc('day', NOW())), 0)::int AS paid_revenue_cents,
        COUNT(*) FILTER (WHERE fulfillment_type = 'dine_in')::int AS dine_in_count,
        COUNT(*) FILTER (WHERE fulfillment_type IN ('to_go', 'pickup', 'delivery'))::int AS to_go_count,
        COUNT(*) FILTER (WHERE order_source = 'phone')::int AS phone_order_count,
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'preparing', 'ready')
            AND created_at < NOW() - INTERVAL '20 minutes'
        )::int AS active_over_20_min_count
      FROM orders
      WHERE created_at >= date_trunc('day', NOW())
    `),
    query<StatusCountRow>(`
      SELECT status, COUNT(*)::int AS count
      FROM orders
      WHERE created_at >= date_trunc('day', NOW())
      GROUP BY status
      ORDER BY status
    `),
    query<KitchenQueueRow>(`
      SELECT oi.status, COUNT(*)::int AS count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.created_at >= date_trunc('day', NOW())
        AND o.status <> 'cancelled'
        AND mi.category <> 'Drinks'
        AND oi.status IN ('pending', 'preparing', 'ready')
      GROUP BY oi.status
      ORDER BY oi.status
    `),
    query<TopItemRow>(`
      SELECT
        mi.name || CASE WHEN miv.name <> 'Regular' THEN ' / ' || miv.name ELSE '' END AS name,
        SUM(oi.quantity)::int AS quantity,
        SUM(oi.quantity * oi.price_cents)::int AS revenue_cents
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN menu_item_variants miv ON miv.id = oi.menu_item_variant_id
      WHERE o.created_at >= date_trunc('day', NOW())
        AND o.status <> 'cancelled'
      GROUP BY mi.name, miv.name
      ORDER BY quantity DESC, revenue_cents DESC
      LIMIT 5
    `)
  ]);

  const metrics = metricsResult.rows[0] ?? {
    order_count: 0,
    active_order_count: 0,
    cancelled_count: 0,
    paid_order_count: 0,
    unpaid_order_count: 0,
    paid_revenue_cents: 0,
    dine_in_count: 0,
    to_go_count: 0,
    phone_order_count: 0,
    active_over_20_min_count: 0
  };

  return {
    metrics: {
      orderCount: metrics.order_count,
      activeOrderCount: metrics.active_order_count,
      cancelledCount: metrics.cancelled_count,
      paidOrderCount: metrics.paid_order_count,
      unpaidOrderCount: metrics.unpaid_order_count,
      paidRevenueCents: metrics.paid_revenue_cents,
      averagePaidOrderCents: metrics.paid_order_count > 0
        ? Math.round(metrics.paid_revenue_cents / metrics.paid_order_count)
        : 0,
      dineInCount: metrics.dine_in_count,
      toGoCount: metrics.to_go_count,
      phoneOrderCount: metrics.phone_order_count,
      activeOver20MinCount: metrics.active_over_20_min_count
    },
    statusCounts: statusResult.rows.map((row) => ({ status: row.status, count: row.count })),
    kitchenQueue: kitchenResult.rows.map((row) => ({ status: row.status, count: row.count })),
    topItems: topItemsResult.rows.map((row) => ({
      name: row.name,
      quantity: row.quantity,
      revenueCents: row.revenue_cents
    }))
  };
}

async function getAiDailyNarrative(summaryData: DailySummaryData): Promise<DailyNarrative | null> {
  if (!config.openaiApiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.aiSummaryModel,
        max_output_tokens: 500,
        input: [
          'You are an operations analyst for a restaurant manager.',
          'Create a concise daily management summary from the JSON data.',
          'Return only valid JSON with this shape:',
          '{"summary":"string","highlights":["string"],"recommendations":["string"]}',
          'Use practical, specific language. Do not invent data.',
          JSON.stringify(summaryData)
        ].join('\n')
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as OpenAiResponse;
    const text = payload.output_text ?? payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => typeof content.text === 'string')
      ?.text;

    return text ? parseDailyNarrative(text) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseDailyNarrative(text: string): DailyNarrative | null {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as Partial<DailyNarrative>;

    if (
      typeof parsed.summary === 'string'
      && Array.isArray(parsed.highlights)
      && Array.isArray(parsed.recommendations)
    ) {
      return {
        summary: parsed.summary,
        highlights: parsed.highlights.filter((item): item is string => typeof item === 'string').slice(0, 4),
        recommendations: parsed.recommendations.filter((item): item is string => typeof item === 'string').slice(0, 4)
      };
    }
  } catch {
    return null;
  }

  return null;
}

function createFallbackDailyNarrative(summaryData: DailySummaryData): DailyNarrative {
  const { metrics, topItems, kitchenQueue } = summaryData;
  const topItem = topItems[0];
  const pendingKitchenItems = kitchenQueue
    .filter((item) => item.status === 'pending' || item.status === 'preparing')
    .reduce((sum, item) => sum + item.count, 0);

  const highlights = [
    `${metrics.orderCount} orders were created today.`,
    `${metrics.paidOrderCount} paid orders generated ${formatCents(metrics.paidRevenueCents)}.`,
    `${metrics.activeOrderCount} active orders and ${metrics.unpaidOrderCount} unpaid or partially paid orders remain.`
  ];

  if (topItem) {
    highlights.push(`Top item: ${topItem.name} with ${topItem.quantity} sold.`);
  }

  const recommendations = [];

  if (metrics.activeOver20MinCount > 0) {
    recommendations.push(`Review ${metrics.activeOver20MinCount} active orders older than 20 minutes.`);
  }

  if (pendingKitchenItems > 0) {
    recommendations.push(`Check the kitchen queue for ${pendingKitchenItems} pending or preparing items.`);
  }

  if (metrics.unpaidOrderCount > 0) {
    recommendations.push(`Follow up on ${metrics.unpaidOrderCount} unpaid or partially paid orders before close.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Operations look clear for the current filters; keep monitoring new orders in real time.');
  }

  return {
    summary: metrics.orderCount === 0
      ? 'No orders have been recorded today yet.'
      : `Today has ${metrics.orderCount} orders, ${formatCents(metrics.paidRevenueCents)} in paid revenue, and ${metrics.activeOrderCount} active orders still moving through service.`,
    highlights,
    recommendations
  };
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

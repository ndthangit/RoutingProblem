import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  PackageCheck,
  RefreshCw,
  Route,
  Truck,
  Warehouse,
} from "lucide-react";

import { request } from "../api";
import type { Order, OrderStatus, Point } from "../types";

type SegmentKind = "pickup" | "transfer" | "delivery" | "done" | "unrouted";

type OrderSegment = {
  order: Order;
  kind: SegmentKind;
  from?: Point;
  to?: Point;
};

type SegmentGroup = {
  key: string;
  kind: SegmentKind;
  fromLabel: string;
  toLabel: string;
  count: number;
  weightKg: number;
  statuses: Record<string, number>;
};

const ACTIVE_STATUSES = new Set<OrderStatus | undefined>([
  "ORDER.CREATED",
  "ORDER.PICKED_UP",
  "ORDER.DELIVERING",
  "ORDER.FAILED_ATTEMPT",
]);

const TERMINAL_STATUSES = new Set<OrderStatus | undefined>([
  "ORDER.COMPLETED",
  "ORDER.CANCELLED",
  "ORDER.PAYMENT_RECEIVED",
]);

function normalizeOrders(data: unknown): Order[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Order[];

  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.orders)) return obj.orders as Order[];
  if (Array.isArray(obj.items)) return obj.items as Order[];
  if (obj.order && typeof obj.order === "object") return [obj.order as Order];

  return [];
}

function pointLabel(point?: Point) {
  if (!point) return "N/A";
  return point.name || point.address || point.id || "N/A";
}

function getRouteState(order: Order) {
  const raw = order.routeState ?? order.route_state ?? 0;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function getOrderWeight(order: Order) {
  const raw = order.package?.weightKg ?? 0;
  const weight = Number(raw);
  return Number.isFinite(weight) ? weight : 0;
}

function getOrderSegment(order: Order): OrderSegment {
  if (TERMINAL_STATUSES.has(order.status)) {
    return { order, kind: "done" };
  }

  const routes = Array.isArray(order.routes) ? order.routes : [];
  if (routes.length < 2) {
    if (order.status === "ORDER.CREATED") return { order, kind: "pickup", from: order.origin };
    if (ACTIVE_STATUSES.has(order.status)) return { order, kind: "unrouted" };
    return { order, kind: "unrouted" };
  }

  const currentIndex = Math.min(getRouteState(order), routes.length - 1);
  const nextIndex = currentIndex + 1;
  if (nextIndex >= routes.length) {
    return { order, kind: "done", from: routes[currentIndex] };
  }

  const from = routes[currentIndex];
  const to = routes[nextIndex];
  if (currentIndex === 0) return { order, kind: "pickup", from, to };
  if (nextIndex === routes.length - 1) return { order, kind: "delivery", from, to };
  return { order, kind: "transfer", from, to };
}

function segmentKindLabel(kind: SegmentKind) {
  switch (kind) {
    case "pickup":
      return "Cần lấy từ khách";
    case "transfer":
      return "Chuyển depot";
    case "delivery":
      return "Cần giao người mua";
    case "done":
      return "Đã kết thúc";
    default:
      return "Chưa có route";
  }
}

function segmentKindClass(kind: SegmentKind) {
  switch (kind) {
    case "pickup":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "transfer":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "delivery":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "done":
      return "bg-slate-50 text-slate-600 border-slate-200";
    default:
      return "bg-red-50 text-red-700 border-red-200";
  }
}

function statusLabel(status?: OrderStatus) {
  switch (status) {
    case "ORDER.CREATED":
      return "Đã tạo";
    case "ORDER.PICKED_UP":
      return "Đã lấy";
    case "ORDER.DELIVERING":
      return "Đang giao";
    case "ORDER.PAYMENT_RECEIVED":
      return "Đã thu tiền";
    case "ORDER.FAILED_ATTEMPT":
      return "Giao lỗi";
    case "ORDER.COMPLETED":
      return "Hoàn thành";
    case "ORDER.CANCELLED":
      return "Đã hủy";
    default:
      return "N/A";
  }
}

function formatWeight(value: number) {
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kg`;
}

function buildSegmentGroups(segments: OrderSegment[]) {
  const groups = new Map<string, SegmentGroup>();

  for (const segment of segments) {
    if (segment.kind === "done" || segment.kind === "unrouted") continue;

    const fromLabel = pointLabel(segment.from);
    const toLabel = pointLabel(segment.to);
    const key = `${segment.kind}|${fromLabel}|${toLabel}`;
    const current =
      groups.get(key) ??
      ({
        key,
        kind: segment.kind,
        fromLabel,
        toLabel,
        count: 0,
        weightKg: 0,
        statuses: {},
      } satisfies SegmentGroup);

    const status = segment.order.status ?? "N/A";
    current.count += 1;
    current.weightKg += getOrderWeight(segment.order);
    current.statuses[status] = (current.statuses[status] ?? 0) + 1;
    groups.set(key, current);
  }

  return Array.from(groups.values()).sort((a, b) => b.count - a.count || a.fromLabel.localeCompare(b.fromLabel));
}

async function fetchAllOrders() {
  const pageSize = 500;
  const maxOrders = 20000;
  const orders: Order[] = [];

  for (let offset = 0; offset < maxOrders; offset += pageSize) {
    const res = await request<unknown>("GET", `/v1/orders?limit=${pageSize}&offset=${offset}`);
    const page = normalizeOrders(res?.data as unknown);
    orders.push(...page);
    if (page.length < pageSize) break;
  }

  return orders;
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      setOrders(await fetchAllOrders());
    } catch (e) {
      console.error("Error fetching dashboard orders:", e);
      setOrders([]);
      setError("Không thể tải dữ liệu dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const dashboard = useMemo(() => {
    const segments = orders.map(getOrderSegment);
    const activeSegments = segments.filter((segment) => segment.kind !== "done");
    const pickup = segments.filter((segment) => segment.kind === "pickup");
    const transfer = segments.filter((segment) => segment.kind === "transfer");
    const delivery = segments.filter((segment) => segment.kind === "delivery");
    const done = segments.filter((segment) => segment.kind === "done");
    const unrouted = segments.filter((segment) => segment.kind === "unrouted");
    const groups = buildSegmentGroups(segments);
    const totalActive = activeSegments.length;

    return {
      total: orders.length,
      totalActive,
      pickup,
      transfer,
      delivery,
      done,
      unrouted,
      groups,
      totalWeightKg: orders.reduce((sum, order) => sum + getOrderWeight(order), 0),
      activeWeightKg: activeSegments.reduce((sum, segment) => sum + getOrderWeight(segment.order), 0),
    };
  }, [orders]);

  const flowStats = [
    {
      label: "Cần lấy từ khách",
      value: dashboard.pickup.length,
      icon: PackageCheck,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      barClassName: "bg-emerald-500",
    },
    {
      label: "Chuyển depot khác",
      value: dashboard.transfer.length,
      icon: Warehouse,
      className: "border-blue-200 bg-blue-50 text-blue-700",
      barClassName: "bg-blue-500",
    },
    {
      label: "Cần giao người mua",
      value: dashboard.delivery.length,
      icon: Truck,
      className: "border-amber-200 bg-amber-50 text-amber-800",
      barClassName: "bg-amber-500",
    },
  ];

  const maxFlowValue = Math.max(...flowStats.map((item) => item.value), 1);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
          <p className="text-sm text-slate-600">
            Thống kê số lượng đơn hàng theo đoạn vận chuyển hiện tại.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-500">Tổng đơn</div>
            <ClipboardList className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{loading ? "..." : dashboard.total}</div>
          <div className="mt-1 text-sm text-slate-500">{formatWeight(dashboard.totalWeightKg)}</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-500">Đơn đang xử lý</div>
            <Route className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{loading ? "..." : dashboard.totalActive}</div>
          <div className="mt-1 text-sm text-slate-500">{formatWeight(dashboard.activeWeightKg)}</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-500">Đã kết thúc</div>
            <PackageCheck className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{loading ? "..." : dashboard.done.length}</div>
          <div className="mt-1 text-sm text-slate-500">Hoàn thành, hủy hoặc đã thu tiền</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-500">Chưa có route</div>
            <Route className="h-5 w-5 text-slate-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{loading ? "..." : dashboard.unrouted.length}</div>
          <div className="mt-1 text-sm text-slate-500">Cần kiểm tra dữ liệu routes</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {flowStats.map((item) => {
          const Icon = item.icon;
          const percent = Math.round((item.value / maxFlowValue) * 100);
          return (
            <div key={item.label} className={`rounded-lg border p-5 shadow-sm ${item.className}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{item.label}</div>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-3xl font-bold">{loading ? "..." : item.value}</div>
              <div className="mt-4 h-2 rounded-full bg-white/80">
                <div className={`h-2 rounded-full ${item.barClassName}`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 p-5">
          <Route className="h-5 w-5 text-slate-600" />
          <div>
            <h3 className="font-bold text-slate-900">Các đoạn đang có đơn hàng</h3>
            <p className="text-sm text-slate-500">Gộp theo điểm đi, điểm đến và loại đoạn vận chuyển.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Loại đoạn</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Từ</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Đến</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Số đơn</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-slate-500">Khối lượng</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-slate-500">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : dashboard.groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">
                    Không có đoạn vận chuyển đang chờ xử lý.
                  </td>
                </tr>
              ) : (
                dashboard.groups.map((group) => (
                  <tr key={group.key} className="hover:bg-slate-50">
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${segmentKindClass(group.kind)}`}>
                        {segmentKindLabel(group.kind)}
                      </span>
                    </td>
                    <td className="max-w-xs px-5 py-4 align-top text-sm text-slate-700">
                      <div className="break-words">{group.fromLabel}</div>
                    </td>
                    <td className="max-w-xs px-5 py-4 align-top text-sm text-slate-700">
                      <div className="flex items-start gap-2">
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span className="break-words">{group.toLabel}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right align-top text-sm font-semibold text-slate-900">
                      {group.count}
                    </td>
                    <td className="px-5 py-4 text-right align-top text-sm text-slate-700">
                      {formatWeight(group.weightKg)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(group.statuses).map(([status, count]) => (
                          <span
                            key={status}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                          >
                            {statusLabel(status as OrderStatus)}: {count}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

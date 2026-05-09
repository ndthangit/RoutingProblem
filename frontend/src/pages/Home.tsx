import { useState } from "react";

import Header from "../components/Header";
import Hero from "../components/Hero";
import Services from "../components/Services";
import About from "../components/About";
import Statistics from "../components/Statistics";
import Contact from "../components/Contact";
import Footer from "../components/Footer";

import { publicRequest } from "../api";
import type { Order, OrderStatus } from "../types";

function statusLabel(s: OrderStatus | undefined): string {
  switch (s) {
    case "ORDER.CREATED":
      return "Đã tạo đơn";
    case "ORDER.PICKED_UP":
      return "Đã lấy hàng";
    case "ORDER.DELIVERING":
      return "Đang vận chuyển";
    case "ORDER.PAYMENT_RECEIVED":
      return "Đã nhận thanh toán";
    case "ORDER.COMPLETED":
      return "Đơn hàng đã hoàn thành";
    case "ORDER.FAILED_ATTEMPT":
      return "Giao hàng thất bại (sẽ thử lại)";
    case "ORDER.CANCELLED":
      return "Đã huỷ";
    default:
      return "Không xác định";
  }
}

function statusColorClass(s: OrderStatus | undefined): string {
  switch (s) {
    case "ORDER.PAYMENT_RECEIVED":
    case "ORDER.COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "ORDER.DELIVERING":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "ORDER.CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
    case "ORDER.FAILED_ATTEMPT":
      return "bg-amber-50 text-amber-800 border-amber-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

function stepIndex(s: OrderStatus | undefined): number {
  switch (s) {
    case "ORDER.CREATED":
      return 0;
    case "ORDER.PICKED_UP":
      return 1;
    case "ORDER.FAILED_ATTEMPT":
      return 1; // still in transport flow
    case "ORDER.DELIVERING":
      return 1; // đang vận chuyển sau khi đã picked up
    case "ORDER.PAYMENT_RECEIVED":
    case "ORDER.COMPLETED":
      return 2;
    case "ORDER.CANCELLED":
      return -1;
    default:
      return 0;
  }
}

export default function Home() {
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackedOrder, setTrackedOrder] = useState<Order | null>(null);

  const handleTrackingSearch = async (orderId: string) => {
    setLoadingTracking(true);
    setTrackingError(null);
    setTrackedOrder(null);

    try {
      const res = await publicRequest<Order>("GET", `/v1/orders/${encodeURIComponent(orderId)}`);
      const order = res.data ?? null;
      if (!order) {
        setTrackingError("Không tìm thấy đơn hàng.");
        return;
      }
      setTrackedOrder(order);
    } catch (_e) {
      setTrackingError("Không tìm thấy đơn hàng hoặc không thể kết nối tới server.");
    } finally {
      setLoadingTracking(false);
    }
  };

  const s = (trackedOrder?.status ?? "ORDER.CREATED") as OrderStatus;
  const idx = stepIndex(s);

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <Hero onTrackingSearch={handleTrackingSearch} />

        {/* Tracking section */}
        <section id="tracking" className="py-10 bg-slate-50 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900">Tra cứu trạng thái đơn hàng</h2>
              <p className="mt-2 text-slate-600">
                Nhập mã đơn hàng ở ô tra cứu phía trên (hero) để xem trạng thái hiện tại.
              </p>

              {loadingTracking && (
                <div className="mt-4 p-4 rounded-lg bg-white border border-slate-200 text-slate-700">Đang tra cứu...</div>
              )}

              {!loadingTracking && trackingError && (
                <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">{trackingError}</div>
              )}

              {!loadingTracking && trackedOrder && (
                <div className="mt-4 p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-500">Mã đơn hàng</div>
                      <div className="font-mono text-slate-900 font-semibold break-all">{trackedOrder.id}</div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full border text-sm font-semibold w-fit ${statusColorClass(s)}`}>
                      {statusLabel(s)} ({s})
                    </div>
                  </div>

                  {/* Steps */}
                  {idx === -1 ? (
                    <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
                      Đơn hàng đã bị huỷ.
                    </div>
                  ) : (
                    <div className="mt-5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { key: "ORDER.CREATED", title: "Đã tạo", desc: "Hệ thống đã tiếp nhận đơn" },
                          { key: "ORDER.PICKED_UP", title: "Đã lấy hàng", desc: "Shipper đã lấy hàng từ điểm gửi" },
                          { key: "ORDER.COMPLETED", title: "Hoàn thành", desc: "Đơn hàng đã hoàn thành" },
                        ].map((step, i) => {
                          const active = i <= idx;
                          return (
                            <div
                              key={step.key}
                              className={`p-4 rounded-xl border ${active ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}
                            >
                              <div className={`text-sm font-bold ${active ? "text-emerald-700" : "text-slate-700"}`}>{step.title}</div>
                              <div className="mt-1 text-sm text-slate-600">{step.desc}</div>
                            </div>
                          );
                        })}
                      </div>

                      {(s === "ORDER.FAILED_ATTEMPT" || s === "ORDER.PAYMENT_RECEIVED" || s === "ORDER.COMPLETED") && (
                        <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                          Trạng thái hiện tại: <b>{statusLabel(s)}</b>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <Services />
        <About />
        <Statistics />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

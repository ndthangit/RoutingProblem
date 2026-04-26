import { useEffect, useMemo, useState } from "react";
import { Box as MuiBox } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { Plus, Package as PackageIcon } from "lucide-react";

import { request } from "../api";
import type { Order } from "../types";
import AddOrderModal from "./Order/AddOrderModal";
import OrderDetailsModal from "./Order/OrderDetailsModal";

function normalizeOrders(data: unknown): Order[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Order[];

  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.orders)) return obj.orders as Order[];
  if (Array.isArray(obj.items)) return obj.items as Order[];
  if (obj.order && typeof obj.order === "object") return [obj.order as Order];

  return [];
}

export default function Orders() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await request<unknown>("GET", "/v1/orders");
      setOrders(normalizeOrders(res?.data as unknown));
    } catch (error) {
      console.error("Error fetching orders:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {    
    fetchOrders();
  }, []);

  const handleSuccess = () => {
    setLoading(true);
    fetchOrders();
  };

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "Order ID", width: 240 },
      {
        field: "origin",
        headerName: "Origin",
        width: 200,
        sortable: false,
        valueGetter: (_v, row: Order) => row.origin || "N/A",
      },
      {
        field: "destination",
        headerName: "Destination",
        width: 200,
        sortable: false,
        valueGetter: (_v, row: Order) => row.destination || "N/A",
      },
      { field: "senderName", headerName: "Sender", width: 160, valueGetter: (v) => v || "N/A" },
      { field: "receiverName", headerName: "Receiver", width: 160, valueGetter: (v) => v || "N/A" },
      {
        field: "codAmount",
        headerName: "COD",
        width: 120,
        type: "number",
        valueGetter: (v) => (v ?? "N/A"),
      },
      {
        field: "shippingFee",
        headerName: "Shipping",
        width: 120,
        type: "number",
        valueGetter: (v) => (v ?? "N/A"),
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: 140,
        valueGetter: (_v, row: Order) => {
          const anyRow = row as unknown as Record<string, unknown>;
          const value = (anyRow.createdAt ?? anyRow.created_at) as unknown;
          if (!value) return "N/A";
          return typeof value === "string" ? value.slice(0, 10) : "N/A";
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        renderCell: (params) => {
          const row = params.row as Order;
          return (
            <div className="flex gap-2 items-center h-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailOrder(row);
                  setIsDetailModalOpen(true);
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors text-xs font-medium"
              >
                Detail
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingOrder(row);
                  setIsModalOpen(true);
                }}
                className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-xs font-medium"
              >
                Edit
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = window.confirm(`Delete order ${row.id}?`);
                  if (!ok) return;

                  try {
                    await request("DELETE", `/v1/orders/${row.id}`);
                    handleSuccess();
                  } catch (err) {
                    console.error("Delete order failed:", err);
                  }
                }}
                className="px-3 py-1 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors text-xs font-medium"
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    [handleSuccess]
  );

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <PackageIcon className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Orders</h2>
            <span className="ml-auto text-sm text-slate-500">{orders.length} orders</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Order
            </button>
          </div>
        </div>

        <MuiBox sx={{ width: "100%" }}>
          <DataGrid
            rows={orders}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.id}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 10 },
              },
            }}
            pageSizeOptions={[5, 10, 25, 50]}
            checkboxSelection
            disableRowSelectionOnClick
            autoHeight
            sx={{
              border: "none",
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid #e2e8f0",
              },
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#475569",
                textTransform: "uppercase",
              },
              "& .MuiDataGrid-row:hover": {
                backgroundColor: "#f8fafc",
              },
              "& .MuiDataGrid-footerContainer": {
                borderTop: "1px solid #e2e8f0",
              },
              "& .MuiCheckbox-root": {
                color: "#3b82f6",
              },
              "& .MuiDataGrid-columnSeparator": {
                display: "none",
              },
            }}
          />
        </MuiBox>
      </div>

      <AddOrderModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingOrder(null);
        }}
        onSuccess={handleSuccess}
        initialOrder={editingOrder}
      />

      <OrderDetailsModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailOrder(null);
        }}
        order={detailOrder}
      />
    </>
  );
}


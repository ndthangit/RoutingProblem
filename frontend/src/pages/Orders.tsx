import { useEffect, useMemo, useState } from "react";
import { Box as MuiBox } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { Plus, Package as PackageIcon } from "lucide-react";

import { request } from "../api";
import type { Order } from "../types";
import AddOrderModal from "./Order/AddOrderModal";

function normalizeOrders(data: unknown): Order[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Order[];

  const obj = data as any;
  if (Array.isArray(obj.orders)) return obj.orders as Order[];
  if (Array.isArray(obj.items)) return obj.items as Order[];
  if (obj.order && typeof obj.order === "object") return [obj.order as Order];

  return [];
}

export default function Orders() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const res = await request<any>("GET", "/v1/orders");
      setOrders(normalizeOrders(res?.data));
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
      { field: "trackingNumber", headerName: "Tracking", width: 160, valueGetter: (v) => v || "N/A" },
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
          const value: any = (row as any).createdAt ?? (row as any).created_at;
          if (!value) return "N/A";
          return typeof value === "string" ? value.slice(0, 10) : "N/A";
        },
      },
    ],
    []
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

      <AddOrderModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />
    </>
  );
}


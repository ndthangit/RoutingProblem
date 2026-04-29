import { useCallback, useEffect, useMemo, useState } from "react";
import { Box as MuiBox, Chip } from "@mui/material";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { MapPin } from "lucide-react";

import { request } from "../api";
import type { CustomerWarehouse, CustomerWarehouseEvent, WarehouseStatus } from "../types";

import CustomerWarehouseDetailsModal from "./CustomerWarehouse/CustomerWarehouseDetailsModal.tsx";

function StatusBadge({ status }: { status: WarehouseStatus }) {
  const colorMap: Record<WarehouseStatus, "success" | "default" | "warning" | "error"> = {
    ACTIVE: "success",
    INACTIVE: "error",
    FULL: "warning",
    MAINTENANCE: "warning",
    CLOSED: "error",
  };

  return (
    <Chip
      label={status}
      color={colorMap[status] || "default"}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  );
}

export default function CustomerWarehouses() {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detail, setDetail] = useState<CustomerWarehouse | null>(null);
  const [items, setItems] = useState<CustomerWarehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    try {
      const res = await request<CustomerWarehouse[]>("GET", "/v1/customer-houses");
      setItems(res?.data ?? []);
    } catch (error) {
      console.error("Error fetching customer warehouses:", error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSuccess = useCallback(() => {
    setLoading(true);
    fetchItems();
  }, []);

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "name", headerName: "Name", width: 200, valueGetter: (value) => value || "N/A" },
      { field: "address", headerName: "Address", width: 320, sortable: false, valueGetter: (value) => value || "N/A" },
      {
        field: "representativeName",
        headerName: "Representative",
        width: 200,
        valueGetter: (value) => value || "N/A",
      },
      { field: "contactPhone", headerName: "Phone", width: 160, valueGetter: (value) => value || "N/A" },
      {
        field: "pendingWeight",
        headerName: "Pending (kg)",
        width: 140,
        valueGetter: (value) => String(value ?? 0),
      },
      {
        field: "totalPendingOrders",
        headerName: "Orders",
        width: 110,
        valueGetter: (value) => String(value ?? 0),
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        renderCell: (params: GridRenderCellParams<CustomerWarehouse, CustomerWarehouse["status"]>) => (
          <StatusBadge status={(params.value as WarehouseStatus) ?? "ACTIVE"} />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        renderCell: (params: GridRenderCellParams<CustomerWarehouse>) => {
          const row = params.row;
          return (
            <div className="flex gap-2 items-center h-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDetail(row);
                  setIsDetailModalOpen(true);
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors text-xs font-medium"
              >
                Detail
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Legacy edit modal removed. Please edit via the unified registration flow if needed.
                }}
                className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-xs font-medium"
              >
                Edit
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = window.confirm(`Delete ${row.name}?`);
                  if (!ok) return;

                  try {
                    const nowIso = new Date().toISOString();
                    const payload: CustomerWarehouseEvent = {
                      event_id: window.crypto?.randomUUID?.() ?? "",
                      timestamp: nowIso,
                      ownerEmail: "unknown",
                      eventType: "CUSTOMER_LOCATION.DELETED",
                      customerHouse: row,
                    };

                    await request<CustomerWarehouseEvent>(
                      "DELETE",
                      `/v1/customer-houses/${row.id}`,
                      undefined,
                      undefined,
                      payload
                    );
                    handleSuccess();
                  } catch (err) {
                    console.error("Delete customer warehouse failed:", err);
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
            <MapPin className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Customer Warehouses</h2>
            <span className="ml-auto text-sm text-slate-500">{items.length} locations</span>
          </div>
        </div>

        <MuiBox sx={{ width: "100%" }}>
          <DataGrid
            rows={items}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.id}
            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
            pageSizeOptions={[5, 10, 25, 50]}
            disableRowSelectionOnClick
            autoHeight
            sx={{
              border: "none",
              "& .MuiDataGrid-cell": { borderBottom: "1px solid #e2e8f0" },
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "#475569",
                textTransform: "uppercase",
              },
              "& .MuiDataGrid-row:hover": { backgroundColor: "#f8fafc" },
              "& .MuiDataGrid-footerContainer": { borderTop: "1px solid #e2e8f0" },
              "& .MuiDataGrid-columnSeparator": { display: "none" },
            }}
          />
        </MuiBox>
      </div>


      <CustomerWarehouseDetailsModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetail(null);
        }}
        customerHouse={detail}
      />
    </>
  );
}



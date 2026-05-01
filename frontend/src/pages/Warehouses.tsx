import { useEffect, useMemo, useState } from "react";
import { Chip, Box as MuiBox } from "@mui/material";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { Plus, Warehouse as WarehouseIcon } from "lucide-react";

import { request } from "../api";
import AddWarehouseModal from "./Warehouse/AddWarehouseModal";
import WarehouseDetailsModal from "./Warehouse/WarehouseDetailsModal";
import type { BrandWarehouse, BrandWarehouseEvent, BrandWarehouseStatus, BrandWarehouseType } from "../types";

function StatusBadge({ status }: { status: BrandWarehouseStatus }) {
  const colorMap: Record<BrandWarehouseStatus, "success" | "default" | "warning" | "error"> = {
    ACTIVE: "success",
    INACTIVE: "error",
    FULL: "warning",
    MAINTENANCE: "warning",
    CLOSED: "error",
  };

  const labelMap: Record<BrandWarehouseStatus, string> = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    FULL: "Full",
    MAINTENANCE: "Maintenance",
    CLOSED: "Closed",
  };

  return (
    <Chip
      label={labelMap[status] ?? status}
      color={colorMap[status] || "default"}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  );
}

const typeLabel: Record<BrandWarehouseType, string> = {
  HUB: "Hub",
  DEPOT: "Depot",
  CUSTOMER_LOCATION: "Customer",
  RECEIVER_LOCATION: "Receiver",
};

export default function Warehouses() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailWarehouse, setDetailWarehouse] = useState<BrandWarehouse | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<BrandWarehouse | null>(null);
  const [warehouses, setWarehouses] = useState<BrandWarehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWarehouses = async () => {
    try {
      const res = await request<BrandWarehouse[]>("GET", "/v1/warehouses");
      if (res?.data) setWarehouses(res.data);
      else setWarehouses([]);
    } catch (error) {
      console.error("Error fetching warehouses:", error);
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const handleSuccess = () => {
    setLoading(true);
    fetchWarehouses();
  };

  const columns: GridColDef[] = useMemo(
    () => [
      // { field: "id", headerName: "Warehouse ID", width: 240 },
      { field: "name", headerName: "Name", width: 200, valueGetter: (value) => value || "N/A" },
      { field: "address", headerName: "Address", width: 280, sortable: false, valueGetter: (value) => value || "N/A" },
      {
        field: "warehouseType",
        headerName: "Type",
        width: 140,
        valueGetter: (value) => (value ? typeLabel[value as BrandWarehouseType] ?? value : "N/A"),
      },
      {
        field: "status",
        headerName: "Status",
        width: 160,
        renderCell: (params: GridRenderCellParams<BrandWarehouse, BrandWarehouse["status"]>) => (
          <StatusBadge status={(params.value as BrandWarehouseStatus) ?? "ACTIVE"} />
        ),
      },
      {
        field: "capacity",
        headerName: "Capacity",
        width: 120,
        valueGetter: (value) => (value ?? "N/A"),
      },
      {
        field: "managerId",
        headerName: "Manager",
        width: 160,
        valueGetter: (value) => value || "N/A",
      },
      {
        field: "contactPhone",
        headerName: "Contact",
        width: 140,
        valueGetter: (value) => value || "N/A",
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        renderCell: (params: GridRenderCellParams<BrandWarehouse>) => {
          const row = params.row;
          return (
            <div className="flex gap-2 items-center h-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailWarehouse(row);
                  setIsDetailModalOpen(true);
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors text-xs font-medium"
              >
                Detail
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingWarehouse(row);
                  setIsModalOpen(true);
                }}
                className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-xs font-medium"
              >
                Edit
              </button>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = window.confirm(`Delete warehouse ${row.name}?`);
                  if (!ok) return;

                  try {
                    const nowIso = new Date().toISOString();
                    const payload: BrandWarehouseEvent = {
                      event_id: window.crypto?.randomUUID?.() ?? "",
                      timestamp: nowIso,
                      ownerEmail: "unknown",
                      eventType: "WAREHOUSE.DELETED",
                      brand_warehouse: row,
                    };

                    await request<BrandWarehouseEvent>("DELETE", `/v1/warehouses/${row.id}`, undefined, undefined, payload);
                    handleSuccess();
                  } catch (err) {
                    console.error("Delete warehouse failed:", err);
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
            <WarehouseIcon className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Warehouses</h2>
            <span className="ml-auto text-sm text-slate-500">{warehouses.length} warehouses</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Warehouse
            </button>
          </div>
        </div>

        <MuiBox sx={{ width: "100%" }}>
          <DataGrid
            rows={warehouses}
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

      <AddWarehouseModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingWarehouse(null);
        }}
        onSuccess={handleSuccess}
        initialWarehouse={editingWarehouse}
      />

      <WarehouseDetailsModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailWarehouse(null);
        }}
        warehouse={detailWarehouse}
      />
    </>
  );
}

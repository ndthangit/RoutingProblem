import { useEffect, useMemo, useState } from "react";
import { request } from "../api";
import { Chip } from "@mui/material";
import AddVehicleModal from "./Vehicle/AddVehicleModal.tsx";
import { Plus, Truck } from "lucide-react";
import { Box as MuiBox } from "@mui/material";
import type { Vehicle, VehicleEvent, VehicleStatus } from "../types";
import VehicleDetailsModal from "./Vehicle/VehicleDetailsModal";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";



function StatusBadge({ status }: { status: VehicleStatus }) {



  const colorMap: Record<VehicleStatus, 'success' | 'default' | 'warning' | 'error'> = {
    ACTIVE: 'success',
    INACTIVE: 'error',
    MAINTENANCE: 'warning',
    RESERVED: 'default',
    EXPIRED_DOCUMENTS: 'error',
  };

  const labelMap: Record<VehicleStatus, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    MAINTENANCE: 'Maintenance',
    RESERVED: 'Reserved',
    EXPIRED_DOCUMENTS: 'Expired Documents',
  };

  return (
    <Chip
      label={labelMap[status] ?? status}
      color={colorMap[status] || 'default'}
      size="small"
      sx={{ fontWeight: 500 }}
    />
  );
}

export default function Vehicles() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);


  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const res = await request<Vehicle[]>("GET", "/v1/vehicles");
      if (res?.data) {
        setVehicles(res.data);
      } else {
        setVehicles([]);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();

  }, []);



  const handleSuccess = () => {
    fetchVehicles();
  };

  const displayVehicles = vehicles;
  const columns: GridColDef[] = useMemo(() => [
    {
      field: 'licensePlate',
      headerName: 'License Plate',
      width: 120,
      valueGetter: (value) => value || 'N/A',
    },
    {
      field: 'vehicleType',
      headerName: 'Type',
      width: 80,
      valueGetter: (value) => value || 'N/A',
    },

    {
      field: 'warehouseAddress',
      headerName: 'warehouse',
      width: 220,
      sortable: false,
      valueGetter:  (value) => value ?? 'N/A',
    },
    {
      field: 'capacity',
      headerName: 'Capacity',
      width: 100,
      valueFormatter: (value) => value != null ? `${value} kg` : 'N/A',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params: GridRenderCellParams<Vehicle, Vehicle['status']>) => (
        <StatusBadge status={params.value as VehicleStatus} />
      ),
    },
    {
      field: 'driverId',
      headerName: 'Driver',
      width: 170,
      valueGetter: (_value, row: Vehicle) => {
        // Prefer denormalized employeeCode persisted on vehicle when assigning
        if (row.employeeCode) return row.employeeCode;
        if (row.driverId) return row.driverId;
        return "Unassigned";
      },
    },

    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Vehicle>) => {
        const row = params.row;
        return (
          <div className="flex gap-2 items-center h-full">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDetailVehicle(row);
                setIsDetailModalOpen(true);
              }}
              className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors text-xs font-medium"
            >
              Detail
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingVehicle(row);
                setIsModalOpen(true);
              }}
              className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-xs font-medium"
            >
              Edit
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const ok = window.confirm(`Delete vehicle ${row.licensePlate ?? row.id}?`);
                if (!ok) return;

                try {
                  const nowIso = new Date().toISOString();
                  const payload: VehicleEvent = {
                    event_id: window.crypto?.randomUUID?.() ?? "",
                    timestamp: nowIso,
                    ownerEmail: "unknown",
                    eventType: "VEHICLE.DELETED",
                    vehicle: row,
                  };
                  await request<VehicleEvent>("DELETE", `/v1/vehicles/${row.id}` , undefined, undefined, payload);
                  fetchVehicles();
                } catch (err) {
                  console.error("Delete vehicle failed:", err);
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
  ], []);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Truck className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Fleet Status</h2>
            <span className="ml-auto text-sm text-slate-500">{displayVehicles.length} vehicles</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          </div>
        </div>

        <MuiBox sx={{ width: '100%' }}>
          <DataGrid
            rows={displayVehicles}
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
              border: 'none',
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid #e2e8f0',
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#475569',
                textTransform: 'uppercase',
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: '#f8fafc',
              },
              '& .MuiDataGrid-footerContainer': {
                borderTop: '1px solid #e2e8f0',
              },
              '& .MuiCheckbox-root': {
                color: '#3b82f6',
              },
              '& .MuiDataGrid-columnSeparator': {
                display: 'none',
              },
            }}
          />
        </MuiBox>
      </div>

      <AddVehicleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingVehicle(null);
        }}
        onSuccess={handleSuccess}
        initialVehicle={editingVehicle}
      />

      <VehicleDetailsModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailVehicle(null);
        }}
        vehicle={detailVehicle}
      />
    </>
  );
}

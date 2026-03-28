import { useEffect, useState } from "react";
import { request } from "../api";
import { Chip } from "@mui/material";
import AddVehicleModal from "./Vehicle/AddVehicleModal.tsx";
import { Plus, Truck } from "lucide-react";
import { Box as MuiBox } from "@mui/material";
import type { Vehicle, VehicleStatus } from "../types";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import {useKeycloak} from "@react-keycloak/web";



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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const { keycloak } = useKeycloak();


  const fetchVehicles = async () => {
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
      console.log("User info:", keycloak?.tokenParsed);
  }, []);

  const handleSuccess = () => {
    fetchVehicles();
  };

  const displayVehicles = vehicles;

  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'Vehicle ID',
      width: 200,
    },
    {
      field: 'vehicleType',
      headerName: 'Type',
      width: 80,
      valueGetter: (value) => value || 'N/A',
    },
    {
      field: 'licensePlate',
      headerName: 'License Plate',
      width: 120,
      valueGetter: (value) => value || 'N/A',
    },
    {
      field: 'brandModel',
      headerName: 'Brand/Model',
      width: 120,
      sortable: false,
      valueGetter: (_value, row: Vehicle) =>
        row.brand && row.model ? `${row.brand} ${row.model}` : (row.brand || row.model || 'N/A'),
    },
    {
      field: 'year',
      headerName: 'Year',
      width: 90,
      type: 'number',
      valueGetter: (value) => value ?? 'N/A',
    },
    {
      field: 'capacity',
      headerName: 'Capacity',
      width: 120,
      valueFormatter: (value) => value != null ? `${value} kg` : 'N/A',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 160,
      renderCell: (params: GridRenderCellParams<Vehicle, Vehicle['status']>) => (
        <StatusBadge status={params.value as VehicleStatus} />
      ),
    },
    {
      field: 'driverId',
      headerName: 'Driver',
      width: 170,
      valueGetter: (value) => value || 'Unassigned',
    },
  ];

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
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </>
  );
}

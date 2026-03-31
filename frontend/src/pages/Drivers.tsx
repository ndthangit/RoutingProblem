import { useEffect, useMemo, useState } from "react";
import { Chip, Box as MuiBox } from "@mui/material";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { Plus, Users } from "lucide-react";

import { request } from "../api";
import AddDriverModal from "./Driver/AddDriverModal";
import AssignVehicleModal from "./Driver/AssignVehicleModal";
import type { Driver, DriverHiredEvent, DriverStatus, Vehicle } from "../types";

function StatusBadge({ status }: { status: DriverStatus }) {
  const colorMap: Record<DriverStatus, "success" | "default" | "warning" | "error"> = {
    ACTIVE: "success",
    INACTIVE: "error",
    SUSPENDED: "warning",
    ON_LEAVE: "default",
  };

  const labelMap: Record<DriverStatus, string> = {
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    SUSPENDED: "Suspended",
    ON_LEAVE: "On leave",
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

function normalizeDrivers(data: unknown): Driver[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    if (data.length === 0) return [];

    const first = data[0] as any;
    if (first && typeof first === "object" && "driver" in first) {
      return (data as DriverHiredEvent[])
        .map((e) => e.driver)
        .filter(Boolean);
    }

    return data as Driver[];
  }

  const obj = data as any;
  if (Array.isArray(obj.drivers)) return obj.drivers as Driver[];
  if (Array.isArray(obj.items)) return obj.items as Driver[];
  if (obj.driver && typeof obj.driver === "object") return [obj.driver as Driver];

  return [];
}

export default function Drivers() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);

  const fetchDrivers = async () => {
    try {
      const res = await request<any>("GET", "/v1/drivers");
      const normalized = normalizeDrivers(res?.data);
      setDrivers(normalized);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicles = async () => {
    setVehiclesLoading(true);
    try {
      const res = await request<Vehicle[]>("GET", "/v1/vehicles");
      setVehicles(res?.data ?? []);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      setVehicles([]);
    } finally {
      setVehiclesLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
    fetchVehicles();
  }, []);

  const handleSuccess = () => {
    setLoading(true);
    fetchDrivers();
    fetchVehicles();
  };

  const vehicleById = useMemo(() => {
    return new Map(vehicles.map((v) => [v.id, v] as const));
  }, [vehicles]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "employeeCode",
        headerName: "Employee Code",
        width: 180,
        valueGetter: (value) => value || "N/A",
      },
      {
        field: "fullName",
        headerName: "Name",
        width: 160,
        sortable: false,
        valueGetter: (_value, row: Driver) => {
          const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
          return name || row.username || "N/A";
        },
      },
      {
        field: "phone",
        headerName: "Phone",
        width: 140,
        valueGetter: (value) => value || "N/A",
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: (params: GridRenderCellParams<Driver, Driver["status"]>) => (
          <StatusBadge status={(params.value as DriverStatus) ?? "ACTIVE"} />
        ),
      },
      {
        field: "licenseNumber",
        headerName: "License No.",
        width: 200,
        valueGetter: (value) => value || "N/A",
      },
      {
        field: "licenseExpiryDate",
        headerName: "License Expiry",
        width: 200,
        valueGetter: (_value, row: Driver) => {
          const value = row.licenseExpiryDate;
          if (!value) return "N/A";
          return typeof value === "string" ? value.slice(0, 10) : "N/A";
        },
      },
      {
        field: "assignedVehicleId",
        headerName: "Action",
        width: 120,
        sortable: false,
        renderCell: (params: GridRenderCellParams<Driver, Driver["assignedVehicleId"]>) => {
          const driver = params.row;
          const assignedId = driver.assignedVehicleId;
          const isUnassigned = !assignedId;

          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDriver(driver);
                setIsAssignModalOpen(true);
              }}
              className={`px-3 py-1 rounded-lg transition-colors text-xs font-medium ${
                isUnassigned
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-red-500 text-white hover:bg-red-600"
              }`}
            >
              {isUnassigned ? "Assign" : "Unassign"}
            </button>
          );
        },
      },
      {
        field: "rating",
        headerName: "Rating",
        width: 120,
        type: "number",
        valueGetter: (value) => (value ?? "N/A"),
      },
      {
        field: "totalTrips",
        headerName: "Trips",
        width: 120,
        type: "number",
        valueGetter: (value) => (value ?? "N/A"),
      },
    ],
    [vehicleById]
  );

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Drivers</h2>
            <span className="ml-auto text-sm text-slate-500">{drivers.length} drivers</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Driver
            </button>
          </div>
        </div>

        <MuiBox sx={{ width: "100%" }}>
          <DataGrid
            rows={drivers}
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

      <AddDriverModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />

      <AssignVehicleModal
        isOpen={isAssignModalOpen}
        onClose={() => {
          setIsAssignModalOpen(false);
          setSelectedDriver(null);
        }}
        onSuccess={handleSuccess}
        driver={selectedDriver}
        vehicles={vehicles}
        vehiclesLoading={vehiclesLoading}
      />
    </>
  );
}
import { useEffect, useMemo, useState } from "react";
import { Chip, Box as MuiBox } from "@mui/material";
import type { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { Plus, Users } from "lucide-react";

import { request } from "../api";
import AddDriverModal from "./Driver/AddDriverModal";
import AssignVehicleModal from "./Driver/AssignVehicleModal";
import DriverDetailsModal from "./Driver/DriverDetailsModal";
import EditDriverModal from "./Driver/EditDriverModal";
import type { Driver, DriverHiredEvent, DriverStatus, DriverType, LicenseClass } from "../types";

function DriverTypeBadge({ driverType }: { driverType?: DriverType }) {
  const labelMap: Record<DriverType, string> = {
    TRUCK_DRIVER: "Internal",
    SEASONAL: "Seasonal",
  };

  if (!driverType) return <span className="text-slate-500">N/A</span>;

  const label = labelMap[driverType] ?? driverType;
  const isInternal = driverType === "TRUCK_DRIVER";

  return (
    <span
      className={`px-2 py-0.5 text-xs font-semibold rounded border ${
        isInternal
          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : "bg-amber-100 text-amber-800 border-amber-200"
      }`}
    >
      {label}
    </span>
  );
}

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

function LicenseBadge({ license }: { license: LicenseClass }) {
  // Define colors for different license classes
  const getLicenseColor = (lic: LicenseClass) => {
    switch (lic) {
      case "A1":
      case "A2":
      case "A3":
      case "A4":
        return { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" };
      case "B1":
      case "B2":
        return { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" };
      case "C":
        return { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" };
      case "D":
        return { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" };
      case "E":
        return { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200" };
      case "F":
        return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" };
      default:
        return { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" };
    }
  };

  const colors = getLicenseColor(license);

  return (
    <span
      className={`px-2 py-0.5 text-xs font-semibold rounded border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {license}
    </span>
  );
}

function normalizeDrivers(data: unknown): Driver[] {
  if (!data) return [];

  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

  if (Array.isArray(data)) {
    if (data.length === 0) return [];

    const first = data[0];
    if (isRecord(first) && "driver" in first) {
      return (data as DriverHiredEvent[]).map((e) => e.driver).filter(Boolean);
    }

    return data as Driver[];
  }

  if (isRecord(data)) {
    const obj = data;
    if (Array.isArray(obj.drivers)) return obj.drivers as Driver[];
    if (Array.isArray(obj.items)) return obj.items as Driver[];
    if (obj.driver && isRecord(obj.driver)) return [obj.driver as unknown as Driver];
  }

  return [];
}

export default function Drivers() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = async () => {
    try {
      const res = await request<unknown>("GET", "/v1/drivers");
      const normalized = normalizeDrivers(res?.data as unknown);
      setDrivers(normalized);
    } catch (error) {
      console.error("Error fetching drivers:", error);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleSuccess = () => {
    setLoading(true);
    fetchDrivers();
  };

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "employeeCode",
        headerName: "Employee Code",
        width: 150,
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
        width: 120,
        valueGetter: (value) => value || "N/A",
      },
      {
        field: "status",
        headerName: "Status",
        width: 100,
        renderCell: (params: GridRenderCellParams<Driver, Driver["status"]>) => (
          <StatusBadge status={(params.value as DriverStatus) ?? "ACTIVE"} />
        ),
      },
      {
        field: "driverType",
        headerName: "Type",
        width: 110,
        sortable: false,
        renderCell: (params: GridRenderCellParams<Driver, Driver["driverType"]>) => (
          <DriverTypeBadge driverType={params.value as DriverType | undefined} />
        ),
      },
      {
        field: "assignedVehicleId",
        headerName: "Vehicle",
        width: 100,
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
        width: 80,
        type: "number",
        valueGetter: (value) => (value ?? "N/A"),
      },
      {
        field: "licenseClass",
        headerName: "License Class",
        width: 120,
        renderCell: (params: GridRenderCellParams<Driver, Driver["licenseClass"]>) => {
          const licenses = params.value;
          if (!licenses || licenses.length === 0) return <span className="text-gray-400 italic">N/A</span>;
          
          return (
            <div className="flex flex-wrap gap-1 items-center h-full">
              {licenses.map((lic) => (
                <LicenseBadge key={lic} license={lic as LicenseClass} />
              ))}
            </div>
          );
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        renderCell: (params: GridRenderCellParams<Driver>) => {
          return (
            <div className="flex gap-2 items-center h-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailDriver(params.row);
                  setIsDetailModalOpen(true);
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors text-xs font-medium"
              >
                Detail
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingDriver(params.row);
                  setIsEditModalOpen(true);
                }}
                className="px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors text-xs font-medium"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement delete logic
                  console.log("Delete driver", params.row.id);
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
    []
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
        vehicles={[]}
        vehiclesLoading={false}
      />

      <DriverDetailsModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailDriver(null);
        }}
        driver={detailDriver}
      />

      <EditDriverModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingDriver(null);
        }}
        onSuccess={handleSuccess}
        driver={editingDriver}
      />
    </>
  );
}

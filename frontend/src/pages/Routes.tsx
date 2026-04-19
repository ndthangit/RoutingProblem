import { useEffect, useMemo, useState } from "react";
import { Box as MuiBox } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { Plus, Route as RouteIcon } from "lucide-react";

import { request } from "../api";
import type { Route } from "../types";
import AddRouteModal from "./Route/AddRouteModal";

export default function RoutesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await request<Route[]>("GET", "/v1/routes");
      if (res?.data) setRoutes(res.data);
      else setRoutes([]);
    } catch (error) {
      console.error("Error fetching routes:", error);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleSuccess = () => {
    fetchRoutes();
  };

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "Route ID", width: 150 },
      { field: "vehicleId", headerName: "Vehicle", width: 180, valueGetter: (value) => value || "N/A" },
      { field: "routeType", headerName: "Type", width: 160, valueGetter: (value) => value || "N/A" },
      { field: "origin", headerName: "Origin", width: 220, valueGetter: (value) => value || "N/A" },
      { field: "destination", headerName: "Destination", width: 220, valueGetter: (value) => value || "N/A" },
      {
        field: "startTime",
        headerName: "Start Time",
        width: 250,
        valueGetter: (value: unknown) => {
          if (value === null || value === undefined || value === "") return "N/A";
          return String(value);
        },
      },
    ],
    []
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <RouteIcon className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Routes</h2>
          <span className="ml-auto text-sm text-slate-500">{routes.length} routes</span>
          <button
            onClick={() => setIsModalOpen(true)}
            className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Route
          </button>
        </div>
      </div>

      <MuiBox sx={{ width: "100%" }}>
        <DataGrid
          rows={routes}
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

      <AddRouteModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

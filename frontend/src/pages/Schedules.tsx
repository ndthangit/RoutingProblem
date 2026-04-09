import { useEffect, useMemo, useState } from "react";
import { Box as MuiBox, IconButton, Tooltip } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { Calendar, Plus, Trash2 } from "lucide-react";

import { request } from "../api";
import type { Schedule } from "../types";
import { AddScheduleModal } from "./Schedule/AddScheduleModal";

function normalizeSchedules(data: unknown): Schedule[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Schedule[];

  const obj = data as any;
  if (Array.isArray(obj.schedules)) return obj.schedules as Schedule[];
  if (Array.isArray(obj.items)) return obj.items as Schedule[];
  if (obj.schedule && typeof obj.schedule === "object") return [obj.schedule as Schedule];

  return [];
}

function getScheduleVehicleId(schedule: Schedule): string {
  const cfg = schedule.scheduleConfig as Record<string, unknown> | undefined;
  const v = cfg?.["vehicleId"];
  return typeof v === "string" ? v : "N/A";
}

export default function Schedules() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = async () => {
    try {
      const res = await request<any>("GET", "/v1/schedules");
      setSchedules(normalizeSchedules(res?.data));
    } catch (error) {
      console.error("Error fetching schedules:", error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleSuccess = () => {
    setLoading(true);
    fetchSchedules();
  };

  const handleDelete = async (scheduleId: string) => {
    if (!window.confirm(`Delete schedule ${scheduleId}?`)) return;

    try {
      await request<any>("DELETE", `/v1/schedules/${encodeURIComponent(scheduleId)}`);
      handleSuccess();
    } catch (e) {
      console.error("Failed to delete schedule", e);
    }
  };

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "Schedule ID", width: 260 },
      { field: "origin", headerName: "Origin", width: 220, sortable: false },
      { field: "destination", headerName: "Destination", width: 220, sortable: false },
      { field: "scheduleType", headerName: "Type", width: 160 },
      {
        field: "vehicleId",
        headerName: "Vehicle",
        width: 160,
        sortable: false,
        valueGetter: (_v, row: Schedule) => getScheduleVehicleId(row),
      },
      {
        field: "isActive",
        headerName: "Active",
        width: 110,
        valueGetter: (v) => (v ? "Yes" : "No"),
      },
      {
        field: "lastGeneratedAt",
        headerName: "Last Generated",
        width: 170,
        valueGetter: (_v, row: Schedule) => {
          const v = (row as any).lastGeneratedAt;
          return typeof v === "string" ? v.slice(0, 19).replace("T", " ") : "N/A";
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 110,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => handleDelete(params.row.id)}>
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    []
  );

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-600" />
            <h2 className="text-lg font-bold text-slate-900">Schedules</h2>
            <span className="ml-auto text-sm text-slate-500">{schedules.length} schedules</span>
            <button
              onClick={() => setIsModalOpen(true)}
              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Schedule
            </button>
          </div>
        </div>

        <MuiBox sx={{ width: "100%" }}>
          <DataGrid
            rows={schedules}
            columns={columns}
            loading={loading}
            getRowId={(row) => row.id}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 10 },
              },
            }}
            pageSizeOptions={[5, 10, 25, 50]}
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
              "& .MuiDataGrid-columnSeparator": {
                display: "none",
              },
            }}
          />
        </MuiBox>
      </div>

      <AddScheduleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleSuccess} />
    </>
  );
}





import { useEffect, useMemo, useState } from "react";
import { Box as MuiBox } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { DataGrid } from "@mui/x-data-grid";
import { Plus, ClipboardList } from "lucide-react";

import { request } from "../api";
import type { Plan } from "../types";
import AddPickupPlanModal from "./Route/AddPickupPlanModal";
import AddMovingPlanModal from "./Route/AddMovingPlanModal";
import AddDeliveryPlanModal from "./Route/AddDeliveryPlanModal";
import PlanDetailsModal from "./Plan/PlanDetailsModal";

export default function RoutesPage() {
  const [isPickupPlanOpen, setIsPickupPlanOpen] = useState(false);
  const [isMovingPlanOpen, setIsMovingPlanOpen] = useState(false);
  const [isDeliveryPlanOpen, setIsDeliveryPlanOpen] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyScheduled, setShowOnlyScheduled] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailPlan, setDetailPlan] = useState<Plan | null>(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await request<Plan[]>("GET", "/v1/plans");
      if (res?.data) setPlans(res.data);
      else setPlans([]);
    } catch (error) {
      console.error("Error fetching plans:", error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleDelete = async (plan: Plan) => {
    const ok = window.confirm(`Delete plan ${plan.id}?`);
    if (!ok) return;

    try {
      const nowIso = new Date().toISOString();
      const payload = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        ownerEmail: "unknown",
        eventType: "PLAN.DELETED",
        plan,
      };
      await request("DELETE", `/v1/plans/${encodeURIComponent(plan.id)}`, undefined, undefined, payload as any);
      fetchPlans();
    } catch (e) {
      console.error("Delete plan failed:", e);
    }
  };

  const visiblePlans = useMemo(() => {
    if (!showOnlyScheduled) return plans;
    return plans.filter((p) => {
      // “Đã được lập lịch”: hiện plan có startTime hoặc đã ở trạng thái PLANNED/IN_PROGRESS/COMPLETED.
      const hasStart = p.startTime !== null && p.startTime !== undefined && String(p.startTime).trim() !== "";
      const hasStatus = p.status === "PLANNED" || p.status === "IN_PROGRESS" || p.status === "COMPLETED";
      return hasStart || hasStatus;
    });
  }, [plans, showOnlyScheduled]);

  const columns: GridColDef[] = useMemo(
    () => [
      { field: "id", headerName: "Plan ID", width: 160 },
      { field: "vehicleId", headerName: "Vehicle", width: 180, valueGetter: (value) => value || "N/A" },
      { field: "status", headerName: "Status", width: 140, valueGetter: (value) => value || "N/A" },
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
      {
        field: "endTime",
        headerName: "End Time",
        width: 250,
        valueGetter: (value: unknown) => {
          if (value === null || value === undefined || value === "") return "N/A";
          return String(value);
        },
      },
      {
        field: "stops",
        headerName: "Stops",
        width: 110,
        valueGetter: (_value: unknown, row: Plan) => (Array.isArray(row.points) ? row.points.length : 0),
      },
      {
        field: "note",
        headerName: "Note",
        width: 160,
        valueGetter: (value: unknown) => (value === null || value === undefined || value === "" ? "N/A" : String(value)),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params.row as Plan;
          return (
            <div className="flex gap-2 items-center h-full">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDetailPlan(row);
                  setIsDetailModalOpen(true);
                }}
                className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors text-xs font-medium"
              >
                Detail
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete(row);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plans]
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-bold text-slate-900">Plans</h2>
          <span className="ml-auto text-sm text-slate-500">{visiblePlans.length} plans</span>

          <label className="ml-4 flex items-center gap-2 text-sm text-slate-600 select-none">
            <input
              type="checkbox"
              checked={showOnlyScheduled}
              onChange={(e) => setShowOnlyScheduled(e.target.checked)}
            />
            Chỉ hiển thị plan đã lập lịch
          </label>

          <button
            onClick={() => setIsPickupPlanOpen(true)}
            className="ml-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Pickup Plan
          </button>

          <button
            onClick={() => setIsMovingPlanOpen(true)}
            className="ml-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Moving Plan
          </button>

          <button
            onClick={() => setIsDeliveryPlanOpen(true)}
            className="ml-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Delivery Plan
          </button>
        </div>
      </div>

      <MuiBox sx={{ width: "100%" }}>
        <DataGrid
          rows={visiblePlans}
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

      <AddPickupPlanModal
        isOpen={isPickupPlanOpen}
        onClose={() => setIsPickupPlanOpen(false)}
        onSuccess={() => {
          fetchPlans();
        }}
      />

      <AddMovingPlanModal
        isOpen={isMovingPlanOpen}
        onClose={() => setIsMovingPlanOpen(false)}
        onSuccess={() => {
          fetchPlans();
        }}
      />

      <AddDeliveryPlanModal
        isOpen={isDeliveryPlanOpen}
        onClose={() => setIsDeliveryPlanOpen(false)}
        onSuccess={() => {
          fetchPlans();
        }}
      />

      <PlanDetailsModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailPlan(null);
        }}
        plan={detailPlan}
      />
    </div>
  );
}

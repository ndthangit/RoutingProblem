import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";

import React from "react";

import type { Plan } from "../../types";
import { request } from "../../api";

interface PlanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
}

function formatDate(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function FieldRow({ label, value }: { label: string; value?: React.ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "N/A" : value;
  return (
    <Box sx={{ display: "flex", gap: 2, py: 0.75 }}>
      <Typography sx={{ width: 220, color: "text.secondary", fontWeight: 600 }} variant="body2">
        {label}
      </Typography>
      <Typography sx={{ flex: 1 }} variant="body2">
        {display}
      </Typography>
    </Box>
  );
}

export default function PlanDetailsModal({ isOpen, onClose, plan }: PlanDetailsModalProps) {
  const stops = Array.isArray(plan?.points) ? plan!.points!.length : 0;

  // UI-only state: mark a stop as arrived within this modal session.
  const [arrivedByStopKey, setArrivedByStopKey] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    // Reset state when switching plans or reopening.
    if (isOpen) setArrivedByStopKey({});
  }, [isOpen, plan?.id]);

  const [isSavingStopKey, setIsSavingStopKey] = React.useState<string | null>(null);

  const updatePlanStartTimeIfNeeded = async (nowIso: string) => {
    if (!plan) return;
    const hasStart = plan.startTime !== null && plan.startTime !== undefined && String(plan.startTime).trim() !== "";
    if (hasStart) return;

    const updatedPlan: Plan = { ...plan, startTime: nowIso };
    const payload = {
      event_id: window.crypto?.randomUUID?.() ?? "",
      timestamp: nowIso,
      ownerEmail: "unknown",
      eventType: "PLAN.UPDATED",
      plan: updatedPlan,
    };

    await request("PUT", `/v1/plans/${encodeURIComponent(plan.id)}`, undefined, undefined, payload as any);
  };

  const fetchRouteById = async (routeId: string) => {
    const response = await request("GET", `/v1/routes/${encodeURIComponent(routeId)}`);
    return (response as any)?.data ?? null;
  };

  const updateRouteStatus = async (routeId: string, patch: Record<string, unknown>, nowIso: string) => {
    const route = await fetchRouteById(routeId);
    if (!route) return;
    const updatedRoute = { ...route, ...patch };

    const payload = {
      event_id: window.crypto?.randomUUID?.() ?? "",
      timestamp: nowIso,
      ownerEmail: "unknown",
      // use update endpoint; eventType not strictly validated
      eventType: "ROUTE.STATUS_CHANGED",
      route: updatedRoute,
    };

    await request("PUT", `/v1/routes/${encodeURIComponent(routeId)}`, undefined, undefined, payload as any);
  };

  const handleMarkArrived = async (stopKey: string, idx: number) => {
    if (!plan) return;
    const nowIso = new Date().toISOString();

    // optimistic UI
    setArrivedByStopKey((prev) => ({ ...prev, [stopKey]: true }));
    setIsSavingStopKey(stopKey);

    try {
      // 1) If this is the first point of the plan => set plan.startTime = now
      if (idx === 0) {
        await updatePlanStartTimeIfNeeded(nowIso);
      }

      // 2) Route logic: treat "Stop i" as start of route i, and stop i+1 as end of route i
      // This is consistent with: routes are segments between consecutive points.
      const routeIds: string[] = Array.isArray(plan.routeIds) ? plan.routeIds.map(String) : [];

      // If arriving at start of a route => IN_PROGRESS + startTime
      if (routeIds[idx]) {
        await updateRouteStatus(
          routeIds[idx],
          {
            routeStatus: "IN_PROGRESS",
            startTime: nowIso,
          },
          nowIso
        );
      }

      // If arriving at end of a route (destination) => COMPLETED + endTime
      if (idx > 0 && routeIds[idx - 1]) {
        await updateRouteStatus(
          routeIds[idx - 1],
          {
            routeStatus: "COMPLETED",
            endTime: nowIso,
          },
          nowIso
        );
      }
    } catch (e) {
      console.error("Mark arrived failed:", e);
      // rollback optimistic UI on failure
      setArrivedByStopKey((prev) => {
        const next = { ...prev };
        delete next[stopKey];
        return next;
      });
    } finally {
      setIsSavingStopKey(null);
    }
  };

  const handleClose = () => {
    setArrivedByStopKey({});
    setIsSavingStopKey(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <PlaylistAddCheckIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Plan details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {plan?.id ?? ""}
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!plan ? (
          <Typography variant="body2" color="text.secondary">
            No plan selected.
          </Typography>
        ) : (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Summary
            </Typography>
            <FieldRow label="ID" value={plan.id} />
            <FieldRow label="Vehicle" value={plan.vehicleId} />
            <FieldRow label="Status" value={plan.status} />
            <FieldRow label="Origin" value={plan.origin} />
            <FieldRow label="Destination" value={plan.destination} />
            <FieldRow label="Stops" value={stops} />
            <FieldRow label="Note" value={plan.note} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Timing
            </Typography>
            <FieldRow label="Start time" value={formatDate(plan.startTime ?? null)} />
            <FieldRow label="End time" value={formatDate(plan.endTime ?? null)} />
            <FieldRow label="Created at" value={formatDate(plan.createdAt ?? null)} />
            <FieldRow label="Updated at" value={formatDate(plan.updatedAt ?? null)} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Stops detail
            </Typography>
            {Array.isArray(plan.points) && plan.points.length ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {plan.points.map((p, idx) => (
                  <Box
                    key={String(p.id ?? idx)}
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 1.5,
                    }}
                  >
                    {(() => {
                      const stopKey = String(p.id ?? idx);
                      const arrived = Boolean(arrivedByStopKey[stopKey]);
                      return (
                        <>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                              Stop {idx + 1}
                            </Typography>
                            <Button
                              size="small"
                              variant={arrived ? "outlined" : "contained"}
                              color={arrived ? "success" : "primary"}
                              disabled={arrived || isSavingStopKey === stopKey}
                              onClick={() => void handleMarkArrived(stopKey, idx)}
                            >
                              Đã đến
                            </Button>
                          </Box>
                        </>
                      );
                    })()}
                    <Typography variant="body2" color="text.secondary">
                      {String(p.address ?? p.name ?? p.id ?? "N/A")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.coordinate ? `${p.coordinate.lat}, ${p.coordinate.lon}` : ""}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No stops.
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}


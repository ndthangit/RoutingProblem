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

import type { Plan, Route, RouteStatus } from "../../types";
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
  const stops = Array.isArray(plan?.points) ? plan.points.length : 0;
  const routeIds = React.useMemo(
    () => (Array.isArray(plan?.routeIds) ? plan.routeIds.map((routeId) => String(routeId)) : []),
    [plan?.routeIds]
  );

  const [routesById, setRoutesById] = React.useState<Record<string, Route>>({});
  const [isLoadingRoutes, setIsLoadingRoutes] = React.useState(false);
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

  const fetchRouteById = React.useCallback(async (routeId: string) => {
    const response = await request<Route>("GET", `/v1/routes/${encodeURIComponent(routeId)}`);
    return response?.data ?? null;
  }, []);

  const updateRouteStatus = React.useCallback(
    async (routeId: string, patch: Record<string, unknown>, nowIso: string) => {
      const route = await fetchRouteById(routeId);
      if (!route) return null;

      const updatedRoute = { ...route, ...patch };
      const payload = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        ownerEmail: "unknown",
        eventType: "ROUTE.STATUS_CHANGED",
        route: updatedRoute,
      };

      const response = await request<Route>(
        "PUT",
        `/v1/routes/${encodeURIComponent(routeId)}`,
        undefined,
        undefined,
        payload as any
      );

      return response?.data ?? updatedRoute;
    },
    [fetchRouteById]
  );

  React.useEffect(() => {
    let isMounted = true;

    const loadRoutes = async () => {
      if (!isOpen || !routeIds.length) {
        if (isMounted) {
          setRoutesById({});
          setIsLoadingRoutes(false);
        }
        return;
      }

      setIsLoadingRoutes(true);
      try {
        const routes = await Promise.all(
          routeIds.map(async (routeId) => {
            const route = await fetchRouteById(routeId);
            return route ? ([routeId, route] as const) : null;
          })
        );

        if (!isMounted) return;

        setRoutesById(
          Object.fromEntries(routes.filter((entry): entry is readonly [string, Route] => entry !== null))
        );
      } catch (error) {
        console.error("Failed to load route statuses:", error);
        if (isMounted) setRoutesById({});
      } finally {
        if (isMounted) setIsLoadingRoutes(false);
      }
    };

    void loadRoutes();

    return () => {
      isMounted = false;
    };
  }, [fetchRouteById, isOpen, routeIds]);

  const getRouteStatus = React.useCallback(
    (routeId?: string): RouteStatus | null => {
      if (!routeId) return null;
      return routesById[routeId]?.routeStatus ?? null;
    },
    [routesById]
  );

  const canMarkRouteStart = React.useCallback(
    (routeId?: string) => getRouteStatus(routeId) === "PLANNED",
    [getRouteStatus]
  );

  const canMarkRouteEnd = React.useCallback(
    (routeId?: string) => {
      const status = getRouteStatus(routeId);
      return status === "PLANNED" || status === "IN_PROGRESS";
    },
    [getRouteStatus]
  );

  const canMarkArrived = React.useCallback(
    (idx: number) => {
      if (isLoadingRoutes || !routeIds.length) return false;

      const previousRouteId = idx > 0 ? routeIds[idx - 1] : undefined;
      const nextRouteId = idx < routeIds.length ? routeIds[idx] : undefined;

      return canMarkRouteEnd(previousRouteId) || canMarkRouteStart(nextRouteId);
    },
    [canMarkRouteEnd, canMarkRouteStart, isLoadingRoutes, routeIds]
  );

  const isStopMarkedArrived = React.useCallback(
    (idx: number) => {
      if (!routeIds.length) return false;

      const previousRouteStatus = idx > 0 ? getRouteStatus(routeIds[idx - 1]) : null;
      const nextRouteStatus = idx < routeIds.length ? getRouteStatus(routeIds[idx]) : null;
      const statuses = [previousRouteStatus, nextRouteStatus].filter(
        (status): status is RouteStatus => status !== null
      );

      if (!statuses.length) return false;

      return statuses.some((status) => status !== "PLANNED") && !canMarkArrived(idx);
    },
    [canMarkArrived, getRouteStatus, routeIds]
  );

  const handleMarkArrived = async (stopKey: string, idx: number) => {
    if (!plan || !canMarkArrived(idx)) return;

    const nowIso = new Date().toISOString();
    const previousRoutesById = { ...routesById };
    const previousRouteId = idx > 0 ? routeIds[idx - 1] : undefined;
    const nextRouteId = idx < routeIds.length ? routeIds[idx] : undefined;

    setIsSavingStopKey(stopKey);
    setRoutesById((prev) => {
      const next = { ...prev };

      if (nextRouteId && next[nextRouteId]) {
        next[nextRouteId] = {
          ...next[nextRouteId],
          routeStatus: "IN_PROGRESS",
          startTime: next[nextRouteId].startTime ?? nowIso,
        };
      }

      if (previousRouteId && next[previousRouteId]) {
        next[previousRouteId] = {
          ...next[previousRouteId],
          routeStatus: "COMPLETED",
          endTime: nowIso,
        };
      }

      return next;
    });

    try {
      if (idx === 0) {
        await updatePlanStartTimeIfNeeded(nowIso);
      }

      if (nextRouteId) {
        const updatedRoute = await updateRouteStatus(
          nextRouteId,
          {
            routeStatus: "IN_PROGRESS",
            startTime: nowIso,
          },
          nowIso
        );

        if (updatedRoute) {
          setRoutesById((prev) => ({ ...prev, [nextRouteId]: updatedRoute }));
        }
      }

      if (previousRouteId) {
        const updatedRoute = await updateRouteStatus(
          previousRouteId,
          {
            routeStatus: "COMPLETED",
            endTime: nowIso,
          },
          nowIso
        );

        if (updatedRoute) {
          setRoutesById((prev) => ({ ...prev, [previousRouteId]: updatedRoute }));
        }
      }
    } catch (error) {
      console.error("Mark arrived failed:", error);
      setRoutesById(previousRoutesById);
    } finally {
      setIsSavingStopKey(null);
    }
  };

  const handleClose = () => {
    setRoutesById({});
    setIsLoadingRoutes(false);
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
                {plan.points.map((p, idx) => {
                  const stopKey = String(p.id ?? idx);
                  const arrived = isStopMarkedArrived(idx);
                  const disabled = !canMarkArrived(idx) || isSavingStopKey === stopKey;

                  return (
                    <Box
                      key={stopKey}
                      sx={{
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 1.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                          Stop {idx + 1}
                        </Typography>
                        <Button
                          size="small"
                          variant={arrived ? "outlined" : "contained"}
                          color={arrived ? "success" : "primary"}
                          disabled={disabled}
                          onClick={() => void handleMarkArrived(stopKey, idx)}
                        >
                          Đã đến
                        </Button>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {String(p.address ?? p.name ?? p.id ?? "N/A")}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {p.coordinate ? `${p.coordinate.lat}, ${p.coordinate.lon}` : ""}
                      </Typography>
                    </Box>
                  );
                })}
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

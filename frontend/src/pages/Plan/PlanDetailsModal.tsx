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
import { useEffect, useMemo, useState, type ReactNode } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

import { request } from "../../api";
import type { Plan } from "../../types";

// Fix default marker icon paths for bundlers (Vite)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

let leafletIconsConfigured = false;
function ensureLeafletDefaultIcons() {
  if (leafletIconsConfigured) return;
  leafletIconsConfigured = true;
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
  });
}

type MapPoint = {
  key: string;
  label: string;
  address?: string;
  lat: number;
  lon: number;
};

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;
    const latLngs = points.map((p) => L.latLng(p.lat, p.lon));
    const bounds = L.latLngBounds(latLngs);
    if (!bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, points]);

  return null;
}

interface PlanDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
  onPlanUpdated?: (plan: Plan) => void;
}

function formatDate(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "N/A";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function FieldRow({ label, value }: { label: string; value?: ReactNode }) {
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

function getPointState(plan?: Plan | null): number {
  const raw = plan?.pointState ?? plan?.point_state;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

function withPointState(plan: Plan): Plan {
  const pointState = getPointState(plan);
  return {
    ...plan,
    pointState,
    point_state: pointState,
  };
}

export default function PlanDetailsModal({ isOpen, onClose, plan, onPlanUpdated }: PlanDetailsModalProps) {
  const [localPlan, setLocalPlan] = useState<Plan | null>(plan ? withPointState(plan) : null);
  const [isSavingStopIndex, setIsSavingStopIndex] = useState<number | null>(null);

  useEffect(() => {
    setLocalPlan(plan ? withPointState(plan) : null);
    setIsSavingStopIndex(null);
  }, [isOpen, plan]);

  const displayPlan = localPlan;
  const stops = Array.isArray(displayPlan?.points) ? displayPlan.points.length : 0;
  const currentPointState = useMemo(() => Math.min(getPointState(displayPlan), stops), [displayPlan, stops]);

  const mapPoints = useMemo<MapPoint[]>(() => {
    if (!displayPlan) return [];
    const next: MapPoint[] = [];

    const originCoord = displayPlan.originCoordinate;
    if (originCoord && typeof originCoord.lat === "number" && typeof originCoord.lon === "number") {
      next.push({
        key: `origin:${displayPlan.id}`,
        label: "Origin",
        address: displayPlan.origin,
        lat: originCoord.lat,
        lon: originCoord.lon,
      });
    }

    const points = Array.isArray(displayPlan.points) ? displayPlan.points : [];
    points.forEach((p, idx) => {
      const c = (p as any)?.coordinate;
      if (!c || typeof c.lat !== "number" || typeof c.lon !== "number") return;
      next.push({
        key: `stop:${String(p.id ?? idx)}`,
        label: `Stop ${idx + 1}`,
        address: String(p.address ?? p.name ?? p.id ?? ""),
        lat: c.lat,
        lon: c.lon,
      });
    });

    const destCoord = displayPlan.destinationCoordinate;
    if (destCoord && typeof destCoord.lat === "number" && typeof destCoord.lon === "number") {
      next.push({
        key: `destination:${displayPlan.id}`,
        label: "Destination",
        address: displayPlan.destination,
        lat: destCoord.lat,
        lon: destCoord.lon,
      });
    }

    return next;
  }, [displayPlan]);

  const polylineLatLngs = useMemo(() => mapPoints.map((p) => [p.lat, p.lon] as [number, number]), [mapPoints]);

  useEffect(() => {
    if (!isOpen) return;
    if (!mapPoints.length) return;
    ensureLeafletDefaultIcons();
  }, [isOpen, mapPoints.length]);

  const handleMarkArrived = async (idx: number) => {
    if (!displayPlan || idx !== currentPointState || idx >= stops) return;

    const nextPointState = currentPointState + 1;
    const previousPlan = displayPlan;
    const optimisticPlan = withPointState({
      ...displayPlan,
      pointState: nextPointState,
      point_state: nextPointState,
    });
    const nowIso = new Date().toISOString();
    const payload = {
      event_id: window.crypto?.randomUUID?.() ?? "",
      timestamp: nowIso,
      ownerEmail: "unknown",
      eventType: "PLAN.UPDATED",
      plan: {
        ...optimisticPlan,
        point_state: nextPointState,
      },
    };

    setIsSavingStopIndex(idx);
    setLocalPlan(optimisticPlan);

    try {
      const response = await request<Plan>(
        "PUT",
        `/v1/plans/${encodeURIComponent(displayPlan.id)}`,
        undefined,
        undefined,
        payload as any
      );

      if (!response?.data) {
        throw new Error("Plan update returned no data");
      }

      const persistedPlan = withPointState(response.data);
      setLocalPlan(persistedPlan);
      onPlanUpdated?.(persistedPlan);
    } catch (error) {
      console.error("Mark arrived failed:", error);
      setLocalPlan(previousPlan);
    } finally {
      setIsSavingStopIndex(null);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <PlaylistAddCheckIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Plan details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {displayPlan?.id ?? ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!displayPlan ? (
          <Typography variant="body2" color="text.secondary">
            No plan selected.
          </Typography>
        ) : (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Summary
            </Typography>
            <FieldRow label="ID" value={displayPlan.id} />
            <FieldRow label="Vehicle" value={displayPlan.vehicleId} />
            <FieldRow label="Status" value={displayPlan.status} />
            <FieldRow label="Origin" value={displayPlan.origin} />
            <FieldRow label="Destination" value={displayPlan.destination} />
            <FieldRow label="Stops" value={stops} />
            <FieldRow label="Point state" value={`${currentPointState}/${stops}`} />
            <FieldRow label="Note" value={displayPlan.note} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Timing
            </Typography>
            <FieldRow label="Start time" value={formatDate(displayPlan.startTime ?? null)} />
            <FieldRow label="End time" value={formatDate(displayPlan.endTime ?? null)} />
            <FieldRow label="Created at" value={formatDate(displayPlan.createdAt ?? null)} />
            <FieldRow label="Updated at" value={formatDate(displayPlan.updatedAt ?? null)} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Stops detail
            </Typography>
            {Array.isArray(displayPlan.points) && displayPlan.points.length ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {displayPlan.points.map((p, idx) => {
                  const stopKey = String(p.id ?? idx);
                  const arrived = idx < currentPointState;
                  const isCurrentStop = idx === currentPointState;
                  const disabled = arrived || !isCurrentStop || isSavingStopIndex !== null;
                  const helperText = arrived ? "Đã xác nhận đến điểm này" : isCurrentStop ? "Có thể xác nhận" : "Chưa đến lượt";

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
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            Stop {idx + 1}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: arrived ? "success.main" : "text.secondary" }}
                          >
                            {helperText}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant={arrived ? "outlined" : "contained"}
                          color={arrived ? "success" : "primary"}
                          disabled={disabled}
                          onClick={() => void handleMarkArrived(idx)}
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

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Map
            </Typography>
            {mapPoints.length ? (
              <Box
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  overflow: "hidden",
                  height: 420,
                  width: "100%",
                }}
              >
                <MapContainer
                  center={[mapPoints[0]!.lat, mapPoints[0]!.lon]}
                  zoom={13}
                  style={{ height: "100%", width: "100%" }}
                  preferCanvas
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FitBounds points={mapPoints} />

                  {polylineLatLngs.length >= 2 ? <Polyline positions={polylineLatLngs} /> : null}

                  {mapPoints.map((p) => (
                    <Marker key={p.key} position={[p.lat, p.lon]}>
                      <Popup>
                        <Box sx={{ minWidth: 220 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {p.label}
                          </Typography>
                          {p.address ? (
                            <Typography variant="caption" color="text.secondary">
                              {p.address}
                            </Typography>
                          ) : null}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: "block", mt: 0.5 }}
                          >
                            {p.lat}, {p.lon}
                          </Typography>
                        </Box>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Không có toạ độ để hiển thị trên bản đồ.
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

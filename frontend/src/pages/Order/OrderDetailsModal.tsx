import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import { useEffect, useMemo, type ReactNode } from "react";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

import type { Order, Point } from "../../types";

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

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
}

function formatDate(value?: string | number): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function getPointLabel(point: Point | undefined, fallback: string): string {
  return String(point?.name ?? point?.address ?? point?.id ?? fallback);
}

function getRouteState(order?: Order | null): number {
  const raw = order?.route_state ?? order?.routeState;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return 0;
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

export default function OrderDetailsModal({ isOpen, onClose, order }: OrderDetailsModalProps) {
  const stopPoints = useMemo<Point[]>(() => {
    if (!order) return [];
    if (Array.isArray(order.routes) && order.routes.length) return order.routes;
    return [order.origin, order.destination].filter(Boolean);
  }, [order]);

  const currentStopIndex = useMemo(() => {
    if (!stopPoints.length) return 0;
    return Math.min(getRouteState(order), Math.max(stopPoints.length - 1, 0));
  }, [order, stopPoints.length]);

  const currentStop = stopPoints[currentStopIndex];

  const mapPoints = useMemo<MapPoint[]>(() => {
    const next: MapPoint[] = [];
    const appendPoint = (point: MapPoint) => {
      const previous = next[next.length - 1];
      if (previous && previous.lat === point.lat && previous.lon === point.lon) return;
      next.push(point);
    };

    stopPoints.forEach((point, idx) => {
      const coordinate = point?.coordinate;
      if (!coordinate || typeof coordinate.lat !== "number" || typeof coordinate.lon !== "number") return;

      const isFirst = idx === 0;
      const isLast = idx === stopPoints.length - 1;
      const isCurrent = idx === currentStopIndex;
      appendPoint({
        key: `order-point:${String(point.id ?? idx)}`,
        label: isCurrent ? "Current location" : isFirst ? "Origin" : isLast ? "Destination" : `Stop ${idx + 1}`,
        address: getPointLabel(point, `Point ${idx + 1}`),
        lat: coordinate.lat,
        lon: coordinate.lon,
      });
    });

    return next;
  }, [currentStopIndex, stopPoints]);

  const polylineLatLngs = useMemo(() => mapPoints.map((p) => [p.lat, p.lon] as [number, number]), [mapPoints]);

  useEffect(() => {
    if (!isOpen || !mapPoints.length) return;
    ensureLeafletDefaultIcons();
  }, [isOpen, mapPoints.length]);

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <LocalShippingIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Order details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {order?.id ?? ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!order ? (
          <Typography variant="body2" color="text.secondary">
            No order selected.
          </Typography>
        ) : (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Parties
            </Typography>
            <FieldRow label="Status" value={order.status} />
            <FieldRow label="Sender" value={order.senderName} />
            <FieldRow label="Receiver" value={order.receiverName} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Trip
            </Typography>
            <FieldRow label="Origin" value={order.origin?.address} />
            <FieldRow label="Destination" value={order.destination?.address} />
            

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Package & Fees
            </Typography>
            <FieldRow label="Description" value={order.package?.description} />
            <FieldRow label="Weight (kg)" value={order.package?.weightKg} />
            <FieldRow label="Declared value" value={order.package?.declaredValue} />
            <FieldRow label="COD amount" value={order.codAmount} />
            <FieldRow label="Shipping fee" value={order.shippingFee} />
            <FieldRow label="Note" value={order.note} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Assignment
            </Typography>
           
            <FieldRow
              label="Current stop"
              value={
                stopPoints.length
                  ? `${currentStopIndex + 1}/${stopPoints.length} - ${getPointLabel(currentStop, "Current location")}`
                  : order.route_state
              }
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Stops
            </Typography>
            {stopPoints.length ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {stopPoints.map((point, idx) => {
                  const completed = idx < currentStopIndex;
                  const current = idx === currentStopIndex;
                  const statusText = completed ? "Passed" : current ? "Current location" : "Pending";
                  const statusColor = completed ? "success.main" : current ? "primary.main" : "text.secondary";
                  const isFirst = idx === 0;
                  const isLast = idx === stopPoints.length - 1;
                  const stopTitle = isFirst ? "Origin" : isLast ? "Destination" : `Stop ${idx + 1}`;

                  return (
                    <Box
                      key={`${point.id ?? point.address ?? idx}:${idx}`}
                      sx={{
                        border: "1px solid",
                        borderColor: current ? "primary.light" : "divider",
                        borderRadius: 1,
                        p: 1.5,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {stopTitle}
                          </Typography>
                          <Typography variant="caption" sx={{ color: statusColor }}>
                            {statusText}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography variant="body2" color="text.secondary">
                        {getPointLabel(point, `Point ${idx + 1}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {point.coordinate ? `${point.coordinate.lat}, ${point.coordinate.lon}` : "N/A"}
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

                  {polylineLatLngs.length >= 2 ? (
                    <Polyline
                      positions={polylineLatLngs}
                      pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.85 }}
                    />
                  ) : null}

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
                No coordinates available for the map.
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Metadata
            </Typography>
            <FieldRow label="Created at" value={formatDate(order.createdAt as string | number | undefined)} />
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



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
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import type { ReactNode } from "react";

import type { Vehicle } from "../../types";

interface VehicleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
}

const KNOWN_VEHICLE_FIELDS = [
  "id",
  "licensePlate",
  "model",
  "brand",
  "year",
  "color",
  "capacity",
  "vehicleType",
  "status",
  "driverId",
  "employeeCode",
  "warehouseId",
  "warehouseAddress",
  "coordinate",
  "location",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "created_at",
  "updated_at",
  "deleted_at",
] as const;

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function formatDate(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (value instanceof Date) return isNaN(value.getTime()) ? "N/A" : value.toLocaleString();
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatCoordinate(value?: { lon?: number; lat?: number } | null): string {
  if (!value || typeof value.lat !== "number" || typeof value.lon !== "number") return "N/A";
  return `${value.lat.toFixed(6)}, ${value.lon.toFixed(6)}`;
}

function formatLocation(value?: { latitude?: number; longitude?: number } | null): string {
  if (!value || typeof value.latitude !== "number" || typeof value.longitude !== "number") return "N/A";
  return `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`;
}

function formatValue(value: unknown): ReactNode {
  if (isEmptyValue(value)) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(", ") : "N/A";
  if (typeof value === "object") {
    return (
      <Box
        component="pre"
        sx={{
          m: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    );
  }
  return String(value);
}

function FieldRow({ label, value }: { label: string; value?: ReactNode }) {
  const display = isEmptyValue(value) ? "N/A" : value;
  return (
    <Box sx={{ display: "flex", gap: 2, py: 0.75 }}>
      <Typography sx={{ width: 220, color: "text.secondary", fontWeight: 600 }} variant="body2">
        {label}
      </Typography>
      <Typography component="div" sx={{ flex: 1, minWidth: 0, wordBreak: "break-word" }} variant="body2">
        {display}
      </Typography>
    </Box>
  );
}

function AdditionalFields({ data }: { data: Vehicle }) {
  const known = new Set<string>(KNOWN_VEHICLE_FIELDS);
  const entries = Object.entries(data as unknown as Record<string, unknown>).filter(
    ([key, value]) => !known.has(key) && !isEmptyValue(value)
  );

  if (!entries.length) return null;

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Additional fields
      </Typography>
      {entries.map(([key, value]) => (
        <FieldRow key={key} label={key} value={formatValue(value)} />
      ))}
    </>
  );
}

export default function VehicleDetailsModal({ isOpen, onClose, vehicle }: VehicleDetailsModalProps) {
  const createdAt = vehicle?.createdAt ?? vehicle?.created_at;
  const updatedAt = vehicle?.updatedAt ?? vehicle?.updated_at;
  const deletedAt = vehicle?.deletedAt ?? vehicle?.deleted_at;

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <LocalShippingIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Vehicle details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {vehicle?.licensePlate ?? vehicle?.id ?? ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!vehicle ? (
          <Typography variant="body2" color="text.secondary">
            No vehicle selected.
          </Typography>
        ) : (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Basic
            </Typography>
            <FieldRow label="ID" value={vehicle.id} />
            <FieldRow label="License plate" value={vehicle.licensePlate} />
            <FieldRow label="Type" value={vehicle.vehicleType} />
            <FieldRow label="Status" value={vehicle.status} />
            <FieldRow label="Employee code" value={vehicle.employeeCode} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Specs
            </Typography>
            <FieldRow label="Brand" value={vehicle.brand} />
            <FieldRow label="Model" value={vehicle.model} />
            <FieldRow label="Year" value={vehicle.year} />
            <FieldRow label="Color" value={vehicle.color} />
            <FieldRow label="Capacity (kg)" value={vehicle.capacity} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Assignment & Location
            </Typography>
            <FieldRow label="Driver ID" value={vehicle.driverId} />
            <FieldRow label="Warehouse ID" value={vehicle.warehouseId} />
            <FieldRow label="Warehouse address" value={vehicle.warehouseAddress} />
            <FieldRow label="Warehouse coordinate" value={formatCoordinate(vehicle.coordinate)} />
            <FieldRow label="Live location" value={formatLocation(vehicle.location)} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Metadata
            </Typography>
            <FieldRow label="Created at" value={formatDate(createdAt as string | number | Date | null | undefined)} />
            <FieldRow label="Updated at" value={formatDate(updatedAt as string | number | Date | null | undefined)} />
            <FieldRow label="Deleted at" value={formatDate(deletedAt as string | number | Date | null | undefined)} />
            <AdditionalFields data={vehicle} />
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


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

import type { Vehicle } from "../../types";

interface VehicleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
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

export default function VehicleDetailsModal({ isOpen, onClose, vehicle }: VehicleDetailsModalProps) {
  const loc = vehicle?.location;

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
            <FieldRow
              label="Location"
              value={
                loc ? `${Number(loc.latitude).toFixed(6)}, ${Number(loc.longitude).toFixed(6)}` : "N/A"
              }
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Metadata
            </Typography>
            <FieldRow label="Created at" value={formatDate(vehicle.createdAt as string | number | undefined)} />
            <FieldRow label="Updated at" value={formatDate(vehicle.updatedAt as string | number | undefined)} />
            <FieldRow label="Deleted at" value={formatDate(vehicle.deletedAt as string | number | undefined)} />
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


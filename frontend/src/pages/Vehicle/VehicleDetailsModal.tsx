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

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
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

export default function VehicleDetailsModal({ isOpen, onClose, vehicle }: VehicleDetailsModalProps) {
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
            <FieldRow label="Warehouse address" value={vehicle.warehouseAddress} />
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


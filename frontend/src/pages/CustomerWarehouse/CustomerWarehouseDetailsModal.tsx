import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LocationOnIcon from "@mui/icons-material/LocationOn";

import type { CustomerWarehouse } from "../../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customerHouse: CustomerWarehouse | null;
}

function formatDate(value?: string | number): string {
  if (!value) return "N/A";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function FieldRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", py: 1 }}>
      <Typography sx={{ width: 180, fontWeight: 600 }} variant="body2">
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {value ?? "N/A"}
      </Typography>
    </Box>
  );
}

export default function CustomerWarehouseDetailsModal({ isOpen, onClose, customerHouse }: Props) {
  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <LocationOnIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Customer warehouse details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {customerHouse?.name ?? ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!customerHouse ? (
          <Typography variant="body2" color="text.secondary">
            No location selected.
          </Typography>
        ) : (
          <Box>
            <FieldRow label="ID" value={customerHouse.id} />
            <Divider />
            <FieldRow label="Name" value={customerHouse.name} />
            <FieldRow label="Address" value={customerHouse.address} />
            <FieldRow label="Representative" value={customerHouse.representativeName} />
            <FieldRow label="Phone" value={customerHouse.contactPhone} />
            <Divider sx={{ my: 1 }} />
            <FieldRow label="Pending weight" value={(customerHouse.pendingWeight ?? 0) + " kg"} />
            <FieldRow label="Pending orders" value={customerHouse.totalPendingOrders ?? 0} />
            <Divider sx={{ my: 1 }} />
            <FieldRow label="Status" value={customerHouse.status ?? "ACTIVE"} />
            <FieldRow label="Created at" value={formatDate(customerHouse.createdAt as any)} />
            <FieldRow label="Updated at" value={formatDate(customerHouse.updatedAt as any)} />
            <Divider sx={{ my: 1 }} />
            <FieldRow
              label="Coordinate"
              value={
                customerHouse.coordinate
                  ? `${customerHouse.coordinate.lat}, ${customerHouse.coordinate.lon}`
                  : "N/A"
              }
            />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}


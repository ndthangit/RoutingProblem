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

import type { Order } from "../../types";

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

export default function OrderDetailsModal({ isOpen, onClose, order }: OrderDetailsModalProps) {
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
            <FieldRow
              label="Origin coordinate"
              value={
                order.origin?.coordinate
                  ? `${order.origin.coordinate.lat}, ${order.origin.coordinate.lon}`
                  : "N/A"
              }
            />
            <FieldRow
              label="Destination coordinate"
              value={
                order.destination?.coordinate
                  ? `${order.destination.coordinate.lat}, ${order.destination.coordinate.lon}`
                  : "N/A"
              }
            />

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
            <FieldRow label="Vehicle ID" value={order.vehicleId} />
            <FieldRow label="Route ID" value={order.routeId} />

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



import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Grid from "@mui/material/Grid";
import { MapPin } from "lucide-react";

import { request } from "../../api";
import type { CustomerWarehouse, CustomerWarehouseEvent } from "../../types";

interface AddCustomerWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCustomerHouse?: CustomerWarehouse | null;
}

function compactObject<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    out[k] = v;
  });
  return out as Partial<T>;
}

export default function AddCustomerWarehouseModal({
  isOpen,
  onClose,
  onSuccess,
  initialCustomerHouse,
}: AddCustomerWarehouseModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type FormData = {
    name: string;
    address: string;
    representativeName: string;
    contactPhone: string;
    pendingWeight: number;
    totalPendingOrders: number;
  };

  const [formData, setFormData] = useState<FormData>({
    name: "",
    address: "",
    representativeName: "",
    contactPhone: "",
    pendingWeight: 0,
    totalPendingOrders: 0,
  });

  useEffect(() => {
    if (!initialCustomerHouse) {
      setFormData({
        name: "",
        address: "",
        representativeName: "",
        contactPhone: "",
        pendingWeight: 0,
        totalPendingOrders: 0,
      });
      return;
    }

    setFormData({
      name: initialCustomerHouse.name ?? "",
      address: initialCustomerHouse.address ?? "",
      representativeName: initialCustomerHouse.representativeName ?? "",
      contactPhone: initialCustomerHouse.contactPhone ?? "",
      pendingWeight: Number(initialCustomerHouse.pendingWeight ?? 0),
      totalPendingOrders: Number(initialCustomerHouse.totalPendingOrders ?? 0),
    });
  }, [initialCustomerHouse, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === "pendingWeight" || name === "totalPendingOrders") {
      setFormData((prev) => ({ ...prev, [name]: Number(value) } as FormData));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const nowIso = new Date().toISOString();
      const base: CustomerWarehouse = {
        ...(initialCustomerHouse?.id ? { id: initialCustomerHouse.id } : {}),
        name: formData.name,
        address: formData.address,
        representativeName: formData.representativeName,
        contactPhone: formData.contactPhone,
        pendingWeight: formData.pendingWeight,
        totalPendingOrders: formData.totalPendingOrders,
        status: initialCustomerHouse?.status ?? "ACTIVE",
      };

      const payload: CustomerWarehouseEvent = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        ownerEmail: "unknown",
        eventType: initialCustomerHouse?.id ? "CUSTOMER_LOCATION.UPDATED" : "CUSTOMER_LOCATION.REGISTERED",
        customerHouse: compactObject(base) as CustomerWarehouse,
      };

      if (initialCustomerHouse?.id) {
        await request<CustomerWarehouseEvent>(
          "PUT",
          `/v1/customer-houses/${initialCustomerHouse.id}`,
          undefined,
          undefined,
          payload
        );
      } else {
        await request<CustomerWarehouseEvent>("POST", "/v1/customer-houses", undefined, undefined, payload);
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      console.error("Save customer warehouse failed:", err);
      setError(err?.message ?? "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: 1,
          borderColor: "divider",
          pb: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              bgcolor: "primary.main",
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MapPin className="w-5 h-5 text-white" />
          </Box>
          <Typography variant="h6" component="span">
            {initialCustomerHouse ? "Edit Customer Warehouse" : "Add Customer Warehouse"}
          </Typography>
        </Box>

        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Phone"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleChange}
                required
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Representative name"
                name="representativeName"
                value={formData.representativeName}
                onChange={handleChange}
                required
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label="Pending weight (kg)"
                name="pendingWeight"
                type="number"
                value={formData.pendingWeight}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label="Pending orders"
                name="totalPendingOrders"
                type="number"
                value={formData.totalPendingOrders}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ borderTop: 1, borderColor: "divider", p: 2 }}>
          <Button onClick={handleClose} color="inherit" disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? "Saving..." : initialCustomerHouse ? "Save" : "Create"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}


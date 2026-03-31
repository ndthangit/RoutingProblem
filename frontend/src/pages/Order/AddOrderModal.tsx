import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PackageIcon from "@mui/icons-material/LocalShipping";
import Grid from "@mui/material/Grid";

import { request } from "../../api";
import type { Order } from "../../types";

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function compactObject<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "")
  ) as Partial<T>;
}

export default function AddOrderModal({ isOpen, onClose, onSuccess }: AddOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type FormData = {
    trackingNumber: string;
    senderName: string;
    receiverName: string;
    note: string;

    origin: string;
    destination: string;

    description: string;
    weightKg: string;
    
    declaredValue: string;

    codAmount: string;
    shippingFee: string;
  };

  const [formData, setFormData] = useState<FormData>({
    trackingNumber: "",
    senderName: "",
    receiverName: "",
    note: "",

    origin: "",
    destination: "",

    description: "",
    weightKg: "1",

    declaredValue: "0",

    codAmount: "0",
    shippingFee: "0",
  });

  const resetForm = () => {
    setError(null);
    setFormData({
      trackingNumber: "",
      senderName: "",
      receiverName: "",
      note: "",

      origin: "",
      destination: "",

      description: "",
      weightKg: "1",
      
      declaredValue: "0",

      codAmount: "0",
      shippingFee: "0",
    });
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
  }, [isOpen]);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | { target: { name: string; value: unknown } }
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: String(value) } as FormData));
  };

  const toNumberOrUndefined = (value: string) => {
    if (value === "") return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.trackingNumber) {
        setError("Vui lòng nhập Tracking number.");
        return;
      }
      if (!formData.origin || !formData.destination) {
        setError("Vui lòng nhập địa chỉ lấy hàng (Origin) và địa chỉ nhận hàng (Destination).");
        return;
      }
      if (!formData.senderName || !formData.receiverName) {
        setError("Vui lòng nhập tên người gửi và tên người nhận.");
        return;
      }
      if (!formData.description || !formData.weightKg) {
        setError("Vui lòng nhập mô tả kiện hàng và cân nặng.");
        return;
      }

      const nowIso = new Date().toISOString();

      const payload: Order = compactObject({
        id: window.crypto?.randomUUID?.() ?? "",
        trackingNumber: formData.trackingNumber,
        origin: formData.origin,
        destination: formData.destination,
        senderName: formData.senderName,
        receiverName: formData.receiverName,
        package: compactObject({
          description: formData.description,
          weightKg: toNumberOrUndefined(formData.weightKg),
         
          declaredValue: toNumberOrUndefined(formData.declaredValue),
        }),
        codAmount: toNumberOrUndefined(formData.codAmount),
        shippingFee: toNumberOrUndefined(formData.shippingFee),
        note: formData.note,
        createdAt: nowIso,
      } as Order) as Order;

      console.log("Submitting new order:", payload);

      await request<Order>("POST", "/v1/orders", undefined, undefined, payload);

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PackageIcon />
          <Typography variant="h6">Add New Order</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Tracking Number"
                name="trackingNumber"
                value={formData.trackingNumber}
                onChange={handleChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="COD Amount"
                name="codAmount"
                type="number"
                value={formData.codAmount}
                onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Sender Name" name="senderName" value={formData.senderName} onChange={handleChange} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Receiver Name"
                name="receiverName"
                value={formData.receiverName}
                onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Origin (Pickup address)"
                name="origin"
                value={formData.origin}
                onChange={handleChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Destination (Delivery address)"
                name="destination"
                value={formData.destination}
                onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label="Note" name="note" value={formData.note} onChange={handleChange} multiline minRows={2} />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Package
              </Typography>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth required label="Description" name="description" value={formData.description} onChange={handleChange} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth required label="Weight (kg)" name="weightKg" type="number" value={formData.weightKg} onChange={handleChange} />
            </Grid>
            
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Declared Value" name="declaredValue" type="number" value={formData.declaredValue} onChange={handleChange} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Shipping Fee" name="shippingFee" type="number" value={formData.shippingFee} onChange={handleChange} />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0, gap: 2 }}>
          <Button onClick={handleClose} disabled={loading} variant="outlined">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} variant="contained" sx={{ minWidth: 140 }}>
            {loading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={18} color="inherit" />
                Creating...
              </Box>
            ) : (
              "Create"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}



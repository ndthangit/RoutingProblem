import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PackageIcon from "@mui/icons-material/LocalShipping";
import Grid from "@mui/material/Grid";

import { request } from "../../api";
import type { Order, Warehouse } from "../../types";

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

function buildWarehouseLite(id: string): Warehouse {
  const nowIso = new Date().toISOString();
  return {
    id,
    name: "",
    address: "",
    warehouseType: "DEPOT",
    status: "ACTIVE",
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export default function AddOrderModal({ isOpen, onClose, onSuccess }: AddOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  type FormData = {
    trackingNumber: string;
    senderName: string;
    receiverName: string;
    note: string;

    originWarehouseId: string;
    destinationWarehouseId: string;

    description: string;
    weightKg: string;
    lengthCm: string;
    widthCm: string;
    heightCm: string;
    declaredValue: string;

    codAmount: string;
    shippingFee: string;
  };

  const [formData, setFormData] = useState<FormData>({
    trackingNumber: "",
    senderName: "",
    receiverName: "",
    note: "",

    originWarehouseId: "",
    destinationWarehouseId: "",

    description: "",
    weightKg: "1",
    lengthCm: "1",
    widthCm: "1",
    heightCm: "1",
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

      originWarehouseId: "",
      destinationWarehouseId: "",

      description: "",
      weightKg: "1",
      lengthCm: "1",
      widthCm: "1",
      heightCm: "1",
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

  const fetchWarehouses = async () => {
    setLoadingWarehouses(true);
    try {
      const res = await request<Warehouse[]>("GET", "/v1/warehouses");
      setWarehouses(res?.data ?? []);
    } catch (e) {
      console.error("Error fetching warehouses", e);
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchWarehouses();
  }, [isOpen]);

  const warehouseById = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses]);

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
      if (!formData.originWarehouseId || !formData.destinationWarehouseId) {
        setError("Vui lòng chọn Origin và Destination warehouse.");
        return;
      }

      const nowIso = new Date().toISOString();
      const origin = warehouseById.get(formData.originWarehouseId) ?? buildWarehouseLite(formData.originWarehouseId);
      const destination =
        warehouseById.get(formData.destinationWarehouseId) ?? buildWarehouseLite(formData.destinationWarehouseId);

      const payload: Order = compactObject({
        id: window.crypto?.randomUUID?.() ?? "",
        trackingNumber: formData.trackingNumber,
        origin,
        destination,
        senderName: formData.senderName,
        receiverName: formData.receiverName,
        package: compactObject({
          description: formData.description,
          weightKg: toNumberOrUndefined(formData.weightKg),
          lengthCm: toNumberOrUndefined(formData.lengthCm),
          widthCm: toNumberOrUndefined(formData.widthCm),
          heightCm: toNumberOrUndefined(formData.heightCm),
          declaredValue: toNumberOrUndefined(formData.declaredValue),
        }),
        codAmount: toNumberOrUndefined(formData.codAmount),
        shippingFee: toNumberOrUndefined(formData.shippingFee),
        note: formData.note,
        createdAt: nowIso,
      } as Order) as Order;

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
              <FormControl fullWidth required>
                <InputLabel>Origin</InputLabel>
                <Select
                  name="originWarehouseId"
                  value={formData.originWarehouseId}
                  onChange={handleChange}
                  label="Origin"
                  disabled={loadingWarehouses}
                >
                  {warehouses.map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name} ({w.id.slice(0, 8)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Destination</InputLabel>
                <Select
                  name="destinationWarehouseId"
                  value={formData.destinationWarehouseId}
                  onChange={handleChange}
                  label="Destination"
                  disabled={loadingWarehouses}
                >
                  {warehouses.map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name} ({w.id.slice(0, 8)})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
              <TextField fullWidth label="Description" name="description" value={formData.description} onChange={handleChange} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="Weight (kg)" name="weightKg" type="number" value={formData.weightKg} onChange={handleChange} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="Length (cm)" name="lengthCm" type="number" value={formData.lengthCm} onChange={handleChange} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="Width (cm)" name="widthCm" type="number" value={formData.widthCm} onChange={handleChange} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField fullWidth label="Height (cm)" name="heightCm" type="number" value={formData.heightCm} onChange={handleChange} />
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



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
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PackageIcon from "@mui/icons-material/LocalShipping";
import Grid from "@mui/material/Grid";

import { request } from "../../api";
import type { Order, OrderEvent, PackageDetails, Point } from "../../types";
import type { CustomerWarehouse } from "../../types";

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialOrder?: Order | null;
}

export default function AddOrderModal({ isOpen, onClose, onSuccess, initialOrder }: AddOrderModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerWarehouses, setCustomerWarehouses] = useState<CustomerWarehouse[]>([]);

  type FormData = {
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

    // Load customer warehouses for Origin dropdown when creating a new order
    (async () => {
      try {
        const resp = await request<unknown>("GET", "/v1/customer-warehouses");

        // request() in this codebase may return the payload directly OR wrap it in { data: ... }
        const maybeList =
          Array.isArray(resp)
            ? resp
            : typeof resp === "object" && resp !== null && "data" in resp
              ? (resp as { data: unknown }).data
              : resp;

        const list: CustomerWarehouse[] = Array.isArray(maybeList) ? (maybeList as CustomerWarehouse[]) : [];
        setCustomerWarehouses(list);
        console.log("Fetched customer warehouses (raw resp):", resp);
        console.log("Fetched customer warehouses (list):", list);
      } catch {
        // non-blocking; keep empty list
        setCustomerWarehouses([]);
      }
    })();

    if (initialOrder) {
      setFormData({
        senderName: initialOrder.senderName ?? "",
        receiverName: initialOrder.receiverName ?? "",
        note: initialOrder.note ?? "",
        origin: initialOrder.origin?.address ?? "",
        destination: initialOrder.destination?.address ?? "",
        description: initialOrder.package?.description ?? "",
        weightKg: String(initialOrder.package?.weightKg ?? "1"),
        declaredValue: String(initialOrder.package?.declaredValue ?? "0"),
        codAmount: String(initialOrder.codAmount ?? "0"),
        shippingFee: String(initialOrder.shippingFee ?? "0"),
      });
    } else {
      resetForm();
    }
  }, [isOpen, initialOrder]);

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

      const pkg: PackageDetails = {
        description: formData.description,
        weightKg: toNumberOrUndefined(formData.weightKg),
        declaredValue: toNumberOrUndefined(formData.declaredValue),
      };

      const originPoint: Point = initialOrder
        ? {
            ...(initialOrder.origin ?? ({ address: formData.origin } as Point)),
            address: formData.origin,
          }
        : {
            // When creating, user selects a customer warehouse id; backend resolves and denormalizes.
            id: formData.origin,
            address: "",
          };

      const destinationPoint: Point = initialOrder
        ? {
            ...(initialOrder.destination ?? ({ address: formData.destination } as Point)),
            address: formData.destination,
          }
        : {
            address: formData.destination,
          };

      const order: Order = {
        id: initialOrder?.id ?? (window.crypto?.randomUUID?.() ?? ""),
        origin: originPoint,
        destination: destinationPoint,
        senderName: formData.senderName,
        receiverName: formData.receiverName,
        package: pkg,
        codAmount: toNumberOrUndefined(formData.codAmount),
        shippingFee: toNumberOrUndefined(formData.shippingFee),
        note: formData.note,
        createdAt: initialOrder?.createdAt ?? nowIso,
      };

      if (initialOrder) {
        console.log("Updating order:", order);
        await request<Order>("PUT", `/v1/orders/${initialOrder.id}`, undefined, undefined, order);
      } else {
        const payload: OrderEvent = {
          event_id: window.crypto?.randomUUID?.() ?? "",
          timestamp: nowIso,
          ownerEmail: "unknown",
          eventType: "ORDER.CREATED",
          order,
        };

        console.log("Submitting new order event:", payload);
        await request<OrderEvent>("POST", "/v1/orders", undefined, undefined, payload);
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : initialOrder ? "Failed to update order" : "Failed to add order");
    } finally {
      setLoading(false);
    }
  };

  return (
      <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PackageIcon />
            <Typography variant="h6">{initialOrder ? "Edit Order" : "Add New Order"}</Typography>
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
            {/*<Grid size={{ xs: 12, sm: 6 }}>*/}
            {/*  <TextField*/}
            {/*    fullWidth*/}
            {/*    required*/}
            {/*    label="Sender Name"*/}
            {/*    name="senderName"*/}
            {/*    value={formData.senderName}*/}
            {/*    onChange={handleChange}*/}
            {/*  />*/}
            {/*</Grid>*/}
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
              {initialOrder ? (
                <TextField
                  fullWidth
                  label="Origin (Pickup address)"
                  name="origin"
                  value={formData.origin}
                  onChange={handleChange}
                  helperText="Order đã tạo sẽ lưu Origin là địa chỉ (readonly theo kho khách hàng)"
                  disabled
                />
              ) : (
                <TextField
                  fullWidth
                  required
                  select
                  label="Origin (Customer warehouse)"
                  name="origin"
                  value={formData.origin}
                  onChange={handleChange}
                  helperText="Chọn kho khách hàng để lấy địa chỉ & tọa độ"
                >
                  <MenuItem value="" disabled>
                    {customerWarehouses.length ? "Chọn kho khách hàng" : "Chưa có kho khách hàng"}
                  </MenuItem>
                  {customerWarehouses
                    .filter((cw) => typeof cw.id === "string" && cw.id)
                    .map((cw) => (
                      <MenuItem key={cw.id as string} value={cw.id as string}>
                        {(cw.name ?? "Customer warehouse") + (cw.address ? ` - ${cw.address}` : "")}
                      </MenuItem>
                    ))}
                </TextField>
              )}
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
                {initialOrder ? "Saving..." : "Creating..."}
              </Box>
            ) : (
              initialOrder ? "Save" : "Create"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}



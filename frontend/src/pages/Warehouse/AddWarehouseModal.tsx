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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import Grid from "@mui/material/Grid";
import { useKeycloak } from "@react-keycloak/web";

import { request } from "../../api";
import type { BrandWarehouse, BrandWarehouseEvent, BrandWarehouseStatus, BrandWarehouseType } from "../../types";

interface AddWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialWarehouse?: BrandWarehouse | null;
}

function compactObject<T extends object>(obj: T): Partial<T> {
  const entries = Object.entries(obj as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  return Object.fromEntries(entries) as Partial<T>;
}

export default function AddWarehouseModal({ isOpen, onClose, onSuccess, initialWarehouse }: AddWarehouseModalProps) {
  const { keycloak } = useKeycloak();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type FormData = {
    name: string;
    address: string;
    warehouseType: BrandWarehouseType;
    status: BrandWarehouseStatus;
    capacity: number | null;
    managerId: string | null;
    contactPhone: string | null;
  };

  const [formData, setFormData] = useState<FormData>({
    name: "",
    address: "",
    warehouseType: "DEPOT",
    status: "ACTIVE",
    capacity: null,
    managerId: null,
    contactPhone: null,
  });

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | { target: { name: string; value: unknown } }
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (["capacity"].includes(name)) {
        return { ...prev, [name]: value === "" ? null : Number(value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const resetForm = () => {
    setError(null);
    setFormData({
      name: "",
      address: "",
      warehouseType: "DEPOT",
      status: "ACTIVE",
      capacity: null,
      managerId: null,
      contactPhone: null,
    });
  };

  const hydrateFromInitial = (w: BrandWarehouse) => {
    setFormData({
      name: w.name ?? "",
      address: w.address ?? "",
      warehouseType: (w.warehouseType ?? "DEPOT") as BrandWarehouseType,
      status: (w.status ?? "ACTIVE") as BrandWarehouseStatus,
      capacity: (w.capacity ?? null) as number | null,
      managerId: (w.managerId ?? null) as string | null,
      contactPhone: (w.contactPhone ?? null) as string | null,
    });
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  // When opening modal, either reset (create) or hydrate (edit)
  // Keep this here so edit button can reuse this modal.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialWarehouse) hydrateFromInitial(initialWarehouse);
    else resetForm();
  }, [isOpen, initialWarehouse]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.name || !formData.address) {
        setError("Vui lòng nhập Name và Address.");
        return;
      }

      const nowIso = new Date().toISOString();
      const warehouse: Partial<BrandWarehouse> = compactObject({
        name: formData.name,
        address: formData.address,
        // coordinate is intentionally omitted; backend will geocode from address
        warehouseType: formData.warehouseType,
        status: formData.status,
        capacity: formData.capacity,
        managerId: formData.managerId,
        contactPhone: formData.contactPhone,
      } as BrandWarehouse);

      const payload: BrandWarehouseEvent = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        // backend overrides ownerEmail based on auth token, but keep for compatibility
        ownerEmail:
          ((keycloak?.tokenParsed as unknown) as { email?: string } | undefined)?.email ||
          "unknown",
        eventType: initialWarehouse ? "WAREHOUSE.UPDATED" : "WAREHOUSE.REGISTERED",
        warehouse: {
          ...(warehouse as BrandWarehouse),
          id: initialWarehouse?.id,
        } as BrandWarehouse,
      };

      console.log("Submitting warehouse:", payload);

      if (initialWarehouse?.id) {
        await request<BrandWarehouseEvent>("PUT", `/v1/warehouses/${initialWarehouse.id}`, undefined, undefined, payload);
      } else {
        await request<BrandWarehouseEvent>("POST", "/v1/warehouses", undefined, undefined, payload);
      }

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add warehouse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            maxHeight: "90vh",
          },
        },
      }}
    >
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
            <WarehouseIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h6" component="span">
            {initialWarehouse ? "Edit Warehouse" : "Add New Warehouse"}
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
                value={formData.name ?? ""}
                onChange={handleChange}
                required
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Type</InputLabel>
                <Select
                  name="warehouseType"
                  value={formData.warehouseType}
                  onChange={handleChange}
                  label="Type"
                >
                  <MenuItem value="HUB">HUB</MenuItem>
                  <MenuItem value="DEPOT">DEPOT</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Address"
                name="address"
                value={formData.address ?? ""}
                onChange={handleChange}
                required
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                <Select name="status" value={formData.status} onChange={handleChange} label="Status">
                  <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                  <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                  <MenuItem value="FULL">FULL</MenuItem>
                  <MenuItem value="MAINTENANCE">MAINTENANCE</MenuItem>
                  <MenuItem value="CLOSED">CLOSED</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Capacity"
                name="capacity"
                type="number"
                value={formData.capacity ?? ""}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Manager ID (optional)"
                name="managerId"
                value={formData.managerId ?? ""}
                onChange={handleChange}
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Contact Phone (optional)"
                name="contactPhone"
                value={formData.contactPhone ?? ""}
                onChange={handleChange}
                variant="outlined"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0, gap: 2 }}>
          <Button onClick={handleClose} disabled={loading} variant="outlined" size="large">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            variant="contained"
            size="large"
            sx={{ minWidth: 140 }}
          >
            {loading ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={18} color="inherit" />
                {initialWarehouse ? "Saving..." : "Creating..."}
              </Box>
            ) : (
              initialWarehouse ? "Save" : "Create"
            )}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

import { useState } from "react";
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
import type { Warehouse, WarehouseEvent, WarehouseStatus, WarehouseType } from "../../types";

interface AddWarehouseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function compactObject<T extends object>(obj: T): Partial<T> {
  const entries = Object.entries(obj as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  return Object.fromEntries(entries) as Partial<T>;
}

export default function AddWarehouseModal({ isOpen, onClose, onSuccess }: AddWarehouseModalProps) {
  const { keycloak } = useKeycloak();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type FormData = {
    name: string;
    address: string;
    warehouseType: WarehouseType;
    status: WarehouseStatus;
    capacity: number | null;
    managerId: string | null;
    customerId: string | null;
    contactPhone: string | null;
  };

  const [formData, setFormData] = useState<FormData>({
    name: "",
    address: "",
    warehouseType: "DEPOT",
    status: "ACTIVE",
    capacity: null,
    managerId: null,
    customerId: null,
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
      customerId: null,
      contactPhone: null,
    });
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

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
      const warehouse: Partial<Warehouse> = compactObject({
        name: formData.name,
        address: formData.address,
        warehouseType: formData.warehouseType,
        status: formData.status,
        capacity: formData.capacity,
        managerId: formData.managerId,
        customerId: formData.customerId,
        contactPhone: formData.contactPhone,
      } as Warehouse);

      const payload: WarehouseEvent = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        // backend overrides ownerEmail based on auth token, but keep for compatibility
        ownerEmail: (keycloak?.tokenParsed as any)?.email || "unknown",
        eventType: "WAREHOUSE.REGISTERED",
        warehouse: warehouse as Warehouse,
      };

      console.log("Submitting warehouse:", payload);

      await request("POST", "/v1/warehouses", undefined, undefined, payload as any);

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
            Add New Warehouse
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
                  <MenuItem value="CUSTOMER_LOCATION">CUSTOMER_LOCATION</MenuItem>
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
                label="Latitude"
                name="coordLat"
                type="number"
                value={formData.coordLat ?? ""}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: -90, max: 90, step: "any" } }}
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Longitude"
                name="coordLon"
                type="number"
                value={formData.coordLon ?? ""}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: -180, max: 180, step: "any" } }}
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
                label="Customer ID (optional)"
                name="customerId"
                value={formData.customerId ?? ""}
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

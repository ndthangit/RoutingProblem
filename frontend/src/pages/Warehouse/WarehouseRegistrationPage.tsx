import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import Grid from "@mui/material/Grid";
import { useKeycloak } from "@react-keycloak/web";
import { useNavigate } from "react-router-dom";

import { request } from "../../api";
import type { Warehouse, WarehouseEvent, WarehouseStatus, WarehouseType } from "../../types";

function compactObject<T extends object>(obj: T): Partial<T> {
  const entries = Object.entries(obj as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  return Object.fromEntries(entries) as Partial<T>;
}

export default function WarehouseRegistrationPage() {
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Warehouse>>({
    name: "",
    address: "",
    warehouseType: "CUSTOMER_LOCATION" as WarehouseType,
    status: "ACTIVE" as WarehouseStatus,
    capacity: null,
    managerId: keycloak?.tokenParsed?.sub || null,
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
      warehouseType: "CUSTOMER_LOCATION" as WarehouseType,
      status: "ACTIVE" as WarehouseStatus,
      capacity: null,
      managerId: keycloak?.tokenParsed?.sub || null,
      customerId: null,
      contactPhone: null,
    });
  };

  const handleCancel = () => {
    if (loading) return;
    resetForm();
    navigate("/warehouses");
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
        ...formData,
        // coordinate is intentionally omitted; backend will geocode from address
      } as Warehouse);

      const payload: WarehouseEvent = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        ownerEmail:
          ((keycloak?.tokenParsed as unknown) as { email?: string } | undefined)?.email ||
          "unknown",
        eventType: "WAREHOUSE.REGISTERED",
        warehouse: warehouse as Warehouse,
      };
      console.log("Submitting warehouse registration:", payload);

      await request<WarehouseEvent>("POST", "/v1/warehouses", undefined, undefined, payload);

      navigate("/warehouses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add warehouse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <WarehouseIcon fontSize="small" />
          <h2 className="text-lg font-bold text-slate-900">Đăng ký Warehouse</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Box sx={{ p: 3 }}>
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

            {/* <Grid size={{ xs: 12, sm: 6 }}>
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
            </Grid> */}

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
{/* 
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
            </Grid> */}

           

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Manager name"
                name="managerId"
                value={keycloak?.tokenParsed?.name || "N/A"}
                // onChange={handleChange}
                disabled  
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

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
            <Button onClick={handleCancel} disabled={loading} variant="outlined" size="large">
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
                  Save...
                </Box>
              ) : (
                "Save"
              )}
            </Button>
          </Box>
        </Box>
      </form>
    </div>
  );
}

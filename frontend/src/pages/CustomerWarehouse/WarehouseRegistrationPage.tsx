import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
} from "@mui/material";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import Grid from "@mui/material/Grid";
import { useKeycloak } from "@react-keycloak/web";
import { useNavigate } from "react-router-dom";

import { request } from "../../api.tsx";
import type { CustomerWarehouse, CustomerWarehouseEvent } from "../../types";

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

  const [formData, setFormData] = useState<Partial<CustomerWarehouse>>({
    name: "",
    address: "",
    representativeName: keycloak?.tokenParsed?.name || "",
    contactPhone: "",
    pendingWeight: 0,
    totalPendingOrders: 0,
    status: "ACTIVE",
  });

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | { target: { name: string; value: unknown } }
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (["pendingWeight", "totalPendingOrders"].includes(name)) {
        return { ...prev, [name]: value === "" ? 0 : Number(value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const resetForm = () => {
    setError(null);
    setFormData({
      name: "",
      address: "",
      representativeName: keycloak?.tokenParsed?.name || "",
      contactPhone: "",
      pendingWeight: 0,
      totalPendingOrders: 0,
      status: "ACTIVE",
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
      if (!formData.name || !formData.address || !formData.representativeName || !formData.contactPhone) {
        setError("Vui lòng nhập đầy đủ: Name, Address, Representative name, Contact phone.");
        return;
      }

      const nowIso = new Date().toISOString();
      const customerWarehouse: Partial<CustomerWarehouse> = compactObject({
        ...formData,
        // coordinate is intentionally omitted; backend will geocode from address
      } as CustomerWarehouse);

      const payload: CustomerWarehouseEvent = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        ownerEmail:
          ((keycloak?.tokenParsed as unknown) as { email?: string } | undefined)?.email ||
          "unknown",
        eventType: "CUSTOMER_LOCATION.REGISTERED",
        customerWarehouse:  customerWarehouse as CustomerWarehouse,
      };
      console.log("Submitting customer warehouse registration:", payload);

      await request<CustomerWarehouseEvent>("POST", "/v1/customer-houses", undefined, undefined, payload);

      navigate("/warehouses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add customer warehouse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <WarehouseIcon fontSize="small" />
          <h2 className="text-lg font-bold text-slate-900">Đăng ký kho khách hàng</h2>
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

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Contact phone"
                name="contactPhone"
                value={formData.contactPhone ?? ""}
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
              <TextField
                fullWidth
                label="Representative name"
                name="representativeName"
                value={formData.representativeName ?? ""}
                onChange={handleChange}
                required
                variant="outlined"
                disabled
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label="Pending weight (kg)"
                name="pendingWeight"
                type="number"
                value={formData.pendingWeight ?? 0}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label="Pending orders"
                name="totalPendingOrders"
                type="number"
                value={formData.totalPendingOrders ?? 0}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
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

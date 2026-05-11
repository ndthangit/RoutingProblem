import { useEffect, useMemo, useState } from "react";
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingWarehouse, setExistingWarehouse] = useState<CustomerWarehouse | null>(null);

  const ownerEmail = useMemo(() => {
    return (
      ((keycloak?.tokenParsed as unknown) as { email?: string } | undefined)?.email || "unknown"
    );
  }, [keycloak?.tokenParsed]);

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

  useEffect(() => {
    let cancelled = false;

    const fetchMyWarehouse = async () => {
      setInitialLoading(true);
      setError(null);
      try {
        const res = await request<CustomerWarehouse>("GET", "/v1/customer-warehouses/me");
        const cw = res?.data ?? null;
        if (cancelled) return;

        if (cw) {
          setExistingWarehouse(cw);
          setFormData({
            id: cw.id,
            name: cw.name ?? "",
            address: cw.address ?? "",
            representativeName: cw.representativeName ?? (keycloak?.tokenParsed?.name || ""),
            contactPhone: cw.contactPhone ?? "",
            pendingWeight: cw.pendingWeight ?? 0,
            totalPendingOrders: cw.totalPendingOrders ?? 0,
            status: cw.status ?? "ACTIVE",
            hubResponsible: cw.hubResponsible ?? null,
            coordinate: cw.coordinate ?? null,
            createdAt: cw.createdAt,
            updatedAt: cw.updatedAt,
          });
        } else {
          setExistingWarehouse(null);
          resetForm();
        }
      } catch (err) {
        // If the user has no warehouse yet, backend returns 404; that's not an error for this page.
        const message = err instanceof Error ? err.message : String(err);
        if (!cancelled && !/404/.test(message)) {
          setError("Không thể tải thông tin kho hiện tại.");
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    };

    fetchMyWarehouse();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = () => {
    if (loading || initialLoading) return;
    resetForm();
    navigate("/customer-warehouses");
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
        ownerEmail,
        eventType: existingWarehouse ? "CUSTOMER_LOCATION.UPDATED" : "CUSTOMER_LOCATION.REGISTERED",
        customerWarehouse: customerWarehouse as CustomerWarehouse,
      };
      console.log("Submitting customer warehouse registration:", payload);

      if (existingWarehouse?.id) {
        await request<CustomerWarehouseEvent>(
          "PUT",
          `/v1/customer-warehouses/${existingWarehouse.id}`,
          undefined,
          undefined,
          payload
        );
      } else {
        await request<CustomerWarehouseEvent>("POST", "/v1/customer-warehouses", undefined, undefined, payload);
      }

      navigate("/customer-warehouses");
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
          <h2 className="text-lg font-bold text-slate-900">
            {existingWarehouse ? "Thông tin kho khách hàng" : "Đăng ký kho khách hàng"}
          </h2>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Box sx={{ p: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {initialLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CircularProgress size={18} />
              <span>Loading...</span>
            </Box>
          ) : (
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
                disabled={true}
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
                disabled={true}
              />
            </Grid>
          </Grid>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
            <Button onClick={handleCancel} disabled={loading} variant="outlined" size="large">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || initialLoading}
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
                existingWarehouse ? "Update" : "Save"
              )}
            </Button>
          </Box>
        </Box>
      </form>
    </div>
  );
}

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
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import Grid from "@mui/material/Grid";

import { request } from "../../api";
import type { BrandWarehouse, DeliveryPlanRequest, Driver, Plan } from "../../types";

interface AddDeliveryPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (plans: Plan[]) => void;
}

type FormData = {
  depot_id: string;
  driver_ids: string[];
  note?: string | null;
};

export default function AddDeliveryPlanModal({ isOpen, onClose, onSuccess }: AddDeliveryPlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [brandWarehouses, setBrandWarehouses] = useState<BrandWarehouse[]>([]);

  const [formData, setFormData] = useState<FormData>({
    depot_id: "",
    driver_ids: [],
    note: "",
  });

  const resetForm = () => {
    setError(null);
    setFormData({ depot_id: "", driver_ids: [], note: "" });
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      setLoadingOptions(true);
      setError(null);
      try {
        const [driversRes, bwsRes] = await Promise.all([
          request<Driver[]>("GET", "/v1/drivers"),
          request<BrandWarehouse[]>("GET", "/v1/brand-warehouses"),
        ]);

        setDrivers(driversRes?.data ?? []);
        setBrandWarehouses(bwsRes?.data ?? []);
      } catch (err) {
        console.error(err);
        setDrivers([]);
        setBrandWarehouses([]);
        setError(err instanceof Error ? err.message : "Failed to load drivers/warehouses");
      } finally {
        setLoadingOptions(false);
      }
    };

    load();
  }, [isOpen]);

  const depotOptions = useMemo(() => brandWarehouses, [brandWarehouses]);
  const driverOptions = useMemo(
    () =>
      drivers.filter(
        (d) =>
          formData.depot_id &&
          String(d.warehouseId ?? "") === String(formData.depot_id) &&
          d.driverType === "SEASONAL" &&
          !d.assignedVehicleId
      ),
    [drivers, formData.depot_id]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.depot_id) {
        setError("Vui lòng chọn depot (brand warehouse).");
        return;
      }
      if (!formData.driver_ids.length) {
        setError("Vui lòng chọn ít nhất 1 driver thời vụ.");
        return;
      }
      const selectedDriverIds = new Set(driverOptions.map((d) => d.id));
      if (formData.driver_ids.some((id) => !selectedDriverIds.has(id))) {
        setError("Selected drivers must be seasonal drivers managed by the root depot without assigned vehicles.");
        return;
      }

      const payload: DeliveryPlanRequest = {
        depot_id: formData.depot_id,
        driver_ids: formData.driver_ids,
        note: formData.note ? String(formData.note) : undefined,
      };

      const res = await request<Plan[], DeliveryPlanRequest>(
        "POST",
        "/v1/delivery-plans",
        undefined,
        undefined,
        payload
      );
      const plans = res?.data ?? [];
      onSuccess?.(plans);
      handleClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create delivery plan");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "depot_id") {
      setFormData((prev) => ({ ...prev, depot_id: value, driver_ids: [] } as FormData));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value } as FormData));
  };

  const handleChangeMultiple =
    (name: keyof Pick<FormData, "driver_ids">) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = (e.target as unknown as { value: string[] | string }).value;
      const next = Array.isArray(value) ? value : value.split(",").filter(Boolean);
      setFormData((prev) => ({ ...prev, [name]: next }));
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
              bgcolor: "success.main",
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LocalShippingIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h6" component="span">
            Delivery Plan
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

          {loadingOptions ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  fullWidth
                  required
                  label="Depot (Brand Warehouse)"
                  name="depot_id"
                  value={formData.depot_id}
                  onChange={handleChange}
                  helperText="Điểm xuất phát/kết thúc (depot)"
                >
                  {depotOptions.map((w) => (
                    <MenuItem key={w.id ?? w.name} value={w.id ?? ""} disabled={!w.id}>
                      {w.name} {w.id ? `(${w.id})` : ""}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  fullWidth
                  required
                  SelectProps={{ multiple: true }}
                  label="Seasonal Drivers"
                  name="driver_ids"
                  value={formData.driver_ids}
                  onChange={handleChangeMultiple("driver_ids")}
                  disabled={!formData.depot_id}
                  helperText="Chọn driver thời vụ do depot này quản lý, chưa được cấp vehicle"
                >
                  {driverOptions.map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {[d.employeeCode, `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || d.username, d.id]
                        .filter(Boolean)
                        .join(" - ")}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Note"
                  name="note"
                  value={formData.note ?? ""}
                  onChange={handleChange}
                  helperText="Backend tự chọn các order sẵn sàng giao của depot này"
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="success"
            disabled={loading || loadingOptions}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
          >
            Create Delivery Plan
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

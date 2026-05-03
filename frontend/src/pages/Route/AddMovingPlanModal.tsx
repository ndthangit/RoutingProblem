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
import type { BrandWarehouse, MovingPlanRequest, Plan, Vehicle } from "../../types";

interface AddMovingPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (plans: Plan[]) => void;
}

type FormData = MovingPlanRequest;

export default function AddMovingPlanModal({ isOpen, onClose, onSuccess }: AddMovingPlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [brandWarehouses, setBrandWarehouses] = useState<BrandWarehouse[]>([]);

  const [formData, setFormData] = useState<FormData>({
    depot_id: "",
    vehicle_ids: [],
    brand_warehouse_ids: [],
    note: "",
  });

  const resetForm = () => {
    setError(null);
    setFormData({ depot_id: "", vehicle_ids: [], brand_warehouse_ids: [], note: "" });
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
        const [vehiclesRes, bwsRes] = await Promise.all([
          request<Vehicle[]>("GET", "/v1/vehicles"),
          request<BrandWarehouse[]>("GET", "/v1/brand-warehouses"),
        ]);

        setVehicles(vehiclesRes?.data ?? []);
        setBrandWarehouses(bwsRes?.data ?? []);
      } catch (err) {
        console.error(err);
        setVehicles([]);
        setBrandWarehouses([]);
        setError(err instanceof Error ? err.message : "Failed to load vehicles/brand warehouses");
      } finally {
        setLoadingOptions(false);
      }
    };

    load();
  }, [isOpen]);

  const depotOptions = useMemo(() => brandWarehouses, [brandWarehouses]);
  const destinationDepotOptions = useMemo(
    () => brandWarehouses.filter((bw) => (bw.id ?? "") !== formData.depot_id),
    [brandWarehouses, formData.depot_id]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.depot_id) {
        setError("Vui lòng chọn depot (brand warehouse). ");
        return;
      }
      if (!formData.vehicle_ids.length) {
        setError("Vui lòng chọn ít nhất 1 vehicle.");
        return;
      }
      if (!formData.brand_warehouse_ids.length) {
        setError("Vui lòng chọn ít nhất 1 depot đích để vận chuyển.");
        return;
      }

      if (formData.brand_warehouse_ids.includes(formData.depot_id)) {
        setError("Depot xuất phát không được nằm trong danh sách depot đích.");
        return;
      }

      const payload: MovingPlanRequest = {
        depot_id: formData.depot_id,
        vehicle_ids: formData.vehicle_ids,
        brand_warehouse_ids: formData.brand_warehouse_ids,
        note: formData.note ? String(formData.note) : undefined,
      };

      const res = await request<Plan[]>("POST", "/v1/moving-plans", undefined, undefined, payload as unknown as Plan[]);
      const plans = res?.data ?? [];
      onSuccess?.(plans);
      handleClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create moving plan");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value } as FormData));
  };

  const handleChangeMultiple = (name: keyof Pick<MovingPlanRequest, "vehicle_ids" | "brand_warehouse_ids">) =>
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
              bgcolor: "secondary.main",
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LocalShippingIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h6" component="span">
            Moving Plan
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
                  helperText="Điểm xuất phát/kết thúc"
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
                  label="Vehicles"
                  name="vehicle_ids"
                  value={formData.vehicle_ids}
                  onChange={handleChangeMultiple("vehicle_ids")}
                  helperText="Chọn 1 hoặc nhiều xe"
                >
                  {vehicles.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {v.licensePlate ? `${v.licensePlate} - ${v.id}` : v.id}
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
                  label="Depots to visit (Brand Warehouses)"
                  name="brand_warehouse_ids"
                  value={formData.brand_warehouse_ids}
                  onChange={handleChangeMultiple("brand_warehouse_ids")}
                  helperText="Các depot/kho của hãng cần ghé để vận chuyển"
                >
                  {destinationDepotOptions.map((bw) => (
                    <MenuItem key={bw.id ?? bw.name} value={bw.id ?? ""} disabled={!bw.id}>
                      {bw.name} {bw.id ? `(${bw.id})` : ""}
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
                  helperText="Tuỳ chọn: ghi chú cho plan"
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
            color="secondary"
            disabled={loading || loadingOptions}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
          >
            Create Moving Plan
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}


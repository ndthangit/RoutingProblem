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
import AssignmentIcon from "@mui/icons-material/Assignment";
import Grid from "@mui/material/Grid";

import { request } from "../../api";
import type { BrandWarehouse, CustomerWarehouse, PickupPlanRequest, Plan, Vehicle } from "../../types";

interface AddPickupPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (plans: Plan[]) => void;
}

type FormData = PickupPlanRequest;

export default function AddPickupPlanModal({ isOpen, onClose, onSuccess }: AddPickupPlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [brandWarehouses, setBrandWarehouses] = useState<BrandWarehouse[]>([]);
  const [customerWarehouses, setCustomerWarehouses] = useState<CustomerWarehouse[]>([]);

  const [formData, setFormData] = useState<FormData>({
	depot_id: "",
	vehicle_ids: [],
	customer_warehouse_ids: [],
  });

  const resetForm = () => {
	setError(null);
	setFormData({ depot_id: "", vehicle_ids: [], customer_warehouse_ids: [] });
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
		const [vehiclesRes, bwsRes, cwsRes] = await Promise.all([
		  request<Vehicle[]>("GET", "/v1/vehicles"),
		  // Depot is a BrandWarehouse
		  request<BrandWarehouse[]>("GET", "/v1/brand-warehouses"),
		  request<CustomerWarehouse[]>("GET", "/v1/customer-warehouses"),
		]);

		setVehicles(vehiclesRes?.data ?? []);
		setBrandWarehouses(bwsRes?.data ?? []);
		setCustomerWarehouses(cwsRes?.data ?? []);
	  } catch (err) {
		console.error(err);
		setVehicles([]);
		setBrandWarehouses([]);
		setCustomerWarehouses([]);
		setError(err instanceof Error ? err.message : "Failed to load vehicles/warehouses");
	  } finally {
		setLoadingOptions(false);
	  }
	};

	load();
  }, [isOpen]);

  const depotOptions = useMemo(() => brandWarehouses, [brandWarehouses]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
	e.preventDefault();
	setLoading(true);
	setError(null);

	try {
	  if (!formData.depot_id) {
		setError("Vui lòng chọn depot (brand warehouse).");
		return;
	  }
	  if (!formData.vehicle_ids.length) {
		setError("Vui lòng chọn ít nhất 1 vehicle.");
		return;
	  }
	  if (!formData.customer_warehouse_ids.length) {
		setError("Vui lòng chọn ít nhất 1 customer warehouse để lấy hàng.");
		return;
	  }

	  // depot_id is a brand warehouse id, so it should never be in customer_warehouse_ids,
	  // but keep this guard to prevent bad input.
	  if (formData.customer_warehouse_ids.includes(formData.depot_id)) {
		setError("Depot không được nằm trong danh sách customer warehouses lấy hàng.");
		return;
	  }

	  const res = await request<Plan[]>(
		"POST",
		"/v1/pickup-plans",
		undefined,
		undefined,
		formData as unknown as Plan[]
	  );
	  const plans = res?.data ?? [];
	  onSuccess?.(plans);
	  handleClose();
	} catch (err) {
	  console.error(err);
	  setError(err instanceof Error ? err.message : "Failed to create pickup plan");
	} finally {
	  setLoading(false);
	}
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
	const { name, value } = e.target;
	setFormData((prev) => ({ ...prev, [name]: value } as FormData));
  };

  const handleChangeMultiple = (name: keyof Pick<PickupPlanRequest, "vehicle_ids" | "customer_warehouse_ids">) =>
	(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
	  // MUI Select (multiple) returns string[] via event.target.value
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
			  bgcolor: "primary.main",
			  borderRadius: 1,
			  display: "flex",
			  alignItems: "center",
			  justifyContent: "center",
			}}
		  >
			<AssignmentIcon sx={{ color: "white" }} />
		  </Box>
		  <Typography variant="h6" component="span">
			Pickup Plan
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
				  label="Customer Warehouses (pickup)"
				  name="customer_warehouse_ids"
				  value={formData.customer_warehouse_ids}
				  onChange={handleChangeMultiple("customer_warehouse_ids")}
				  helperText="Các điểm lấy hàng"
				>
				  {customerWarehouses
					.filter((cw) => (cw.id ?? "") !== formData.depot_id)
					.map((cw) => (
					  <MenuItem key={cw.id ?? cw.name} value={cw.id ?? ""} disabled={!cw.id}>
						{cw.name} {cw.id ? `(${cw.id})` : ""}
					  </MenuItem>
					))}
				</TextField>
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
			disabled={loading || loadingOptions}
			startIcon={loading ? <CircularProgress size={18} /> : undefined}
		  >
			Create Pickup Plan
		  </Button>
		</DialogActions>
	  </form>
	</Dialog>
  );
}




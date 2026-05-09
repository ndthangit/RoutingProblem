import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import Grid from "@mui/material/Grid";

import { useKeycloak } from "@react-keycloak/web";
import { request } from "../../api";
import type {
  BrandWarehouse,
  Driver,
  DriverStatus,
  DriverType,
  LicenseClass,
} from "../../types";

interface EditDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  driver: Driver | null;
}

const steps = [
  "Thông tin tài khoản",
  "Bằng lái & công việc",
  "Hợp đồng & phân công",
  "Liên hệ khẩn",
];

function toIsoDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes("T")) return value;
  // assume YYYY-MM-DD
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function compactObject<T extends object>(obj: T): Partial<T> {
  const entries = Object.entries(obj as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  return Object.fromEntries(entries) as Partial<T>;
}

export default function EditDriverModal({ isOpen, onClose, onSuccess, driver }: EditDriverModalProps) {
  const { keycloak } = useKeycloak();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [warehouses, setWarehouses] = useState<BrandWarehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);

  const licenseClasses: LicenseClass[] = useMemo(
    () => ["A1", "A2", "A3", "A4", "B1", "B2", "C", "D", "E", "F"],
    []
  );

  const driverTypes: { value: DriverType; label: string }[] = useMemo(
    () => [
      { value: "TRUCK_DRIVER", label: "Tài xế nội bộ (Full-time)" },
      { value: "SEASONAL", label: "Shipper thời vụ / Freelancer" },
    ],
    []
  );

  const [formData, setFormData] = useState<Partial<Driver>>({});

  // Prefill form when opening / switching driver
  useEffect(() => {
    if (!isOpen || !driver) return;

    setActiveStep(0);
    setError(null);

    setFormData({
      // Keep id in payload snapshot for update
      id: driver.id,

      employeeCode: driver.employeeCode ?? "",
      status: (driver.status ?? "ACTIVE") as DriverStatus,
      hireDate: driver.hireDate ?? "",
      driverType: (driver.driverType ?? "TRUCK_DRIVER") as DriverType,

      firstName: driver.firstName ?? "",
      lastName: driver.lastName ?? "",
      email: driver.email ?? "",
      username: driver.username ?? "",
      phone: driver.phone ?? "",
      enabled: Boolean(driver.enabled),
      emailVerified: Boolean(driver.emailVerified),

      licenseNumber: driver.licenseNumber ?? "",
      licenseClass: (driver.licenseClass && driver.licenseClass.length ? driver.licenseClass : ["A1"]) as LicenseClass[],
      licenseIssueDate: driver.licenseIssueDate ?? "",
      licenseExpiryDate: driver.licenseExpiryDate ?? "",

      yearsOfExperience: driver.yearsOfExperience ?? 0,
      rating: driver.rating ?? 5,
      totalTrips: driver.totalTrips ?? 0,
      assignedVehicleId: driver.assignedVehicleId ?? "",
      warehouseId: driver.warehouseId ?? "",

      contractNumber: driver.contractNumber ?? "",
      contractStartDate: driver.contractStartDate ?? "",
      contractEndDate: driver.contractEndDate ?? "",

      emergencyContactName: driver.emergencyContactName ?? "",
      emergencyContactPhone: driver.emergencyContactPhone ?? "",
      emergencyContactRelation: driver.emergencyContactRelation ?? "",
    });
  }, [isOpen, driver]);

  // Load warehouses when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      setWarehousesLoading(true);
      try {
        const res = await request<BrandWarehouse[]>("GET", "/v1/brand-warehouses");
        if (cancelled) return;
        setWarehouses(res?.data ?? []);
      } catch (e) {
        if (cancelled) return;
        setWarehouses([]);
        console.error("Failed to fetch brand warehouses", e);
      } finally {
        if (!cancelled) setWarehousesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleClose = () => {
    if (loading) return;
    setError(null);
    onClose();
  };

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | { target: { name: string; value: unknown } }
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      if (["yearsOfExperience", "rating", "totalTrips"].includes(name)) {
        return { ...prev, [name]: value === "" ? undefined : Number(value) };
      }
      return { ...prev, [name]: value };
    });
  };

  const validateStep = (): string | null => {
    if (!driver) return "Chưa chọn tài xế.";

    if (activeStep === 0) {
      if (!formData.firstName || !formData.lastName) return "Vui lòng nhập họ và tên.";
      if (!formData.phone) return "Vui lòng nhập số điện thoại.";
      return null;
    }

    if (activeStep === 1) {
      if (!formData.employeeCode) return "Vui lòng nhập mã nhân viên.";
      if (!formData.licenseNumber) return "Vui lòng nhập số GPLX.";
      if (!formData.licenseClass || formData.licenseClass.length === 0) return "Chọn hạng GPLX.";
      return null;
    }

    if (activeStep === 2) {
      if (!formData.warehouseId) return "Vui lòng chọn Warehouse (BrandWarehouse).";
      return null;
    }

    return null;
  };

  const handleNext = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setActiveStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    if (!driver) return;

    // Validate last step submit as well
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedWarehouse =
        warehouses.find((w) => String(w.id) === String(formData.warehouseId ?? "")) ?? null;

      const snapshot: Partial<Driver> = compactObject({
        // keep immutable fields we still want to preserve
        ...driver,
        ...formData,
        warehouseAddress: selectedWarehouse?.address ?? undefined,
        hireDate: toIsoDateTime(formData.hireDate),
        licenseIssueDate: toIsoDateTime(formData.licenseIssueDate),
        licenseExpiryDate: toIsoDateTime(formData.licenseExpiryDate),
        contractStartDate: toIsoDateTime(formData.contractStartDate),
        contractEndDate: toIsoDateTime(formData.contractEndDate),
      } as Driver);

      const payload = {
        event_id: window.crypto?.randomUUID?.() ?? undefined,
        timestamp: new Date().toISOString(),
        ownerEmail: (keycloak?.tokenParsed as any)?.email || "unknown",
        eventType: "DRIVER.UPDATED",
        driver: snapshot as Driver,
      };

      await request("PUT", `/v1/drivers/${driver.id}`, undefined, undefined, payload as any);

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update driver");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="First name"
                name="firstName"
                value={formData.firstName ?? ""}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Last name"
                name="lastName"
                value={formData.lastName ?? ""}
                onChange={handleChange}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email ?? ""}
                onChange={handleChange}
                placeholder="driver@company.com"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={formData.username ?? ""}
                onChange={handleChange}
                placeholder="driver01"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Phone"
                name="phone"
                value={formData.phone ?? ""}
                onChange={handleChange}
                required
                placeholder="e.g., 0987654321"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center", height: "100%" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(formData.enabled)}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, enabled: e.target.checked }))
                      }
                    />
                  }
                  label="Enabled"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(formData.emailVerified)}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, emailVerified: e.target.checked }))
                      }
                    />
                  }
                  label="Email verified"
                />
              </Box>
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Employee code"
                name="employeeCode"
                value={formData.employeeCode ?? ""}
                onChange={handleChange}
                required
                placeholder="EMP-0001"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Hire date"
                name="hireDate"
                type="date"
                value={(formData.hireDate ?? "").slice(0, 10)}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status ?? "ACTIVE"}
                  onChange={handleChange}
                  label="Status"
                >
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                  <MenuItem value="SUSPENDED">Suspended</MenuItem>
                  <MenuItem value="ON_LEAVE">On leave</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Driver type</InputLabel>
                <Select
                  name="driverType"
                  value={(formData.driverType as DriverType) ?? "TRUCK_DRIVER"}
                  onChange={handleChange}
                  label="Driver type"
                >
                  {driverTypes.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="License number"
                name="licenseNumber"
                value={formData.licenseNumber ?? ""}
                onChange={handleChange}
                required
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth required>
                <InputLabel>License class</InputLabel>
                <Select
                  multiple
                  name="licenseClass"
                  value={(formData.licenseClass as LicenseClass[]) ?? []}
                  onChange={handleChange}
                  label="License class"
                  renderValue={(selected) => (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                      {(selected as LicenseClass[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {licenseClasses.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Issue date"
                name="licenseIssueDate"
                type="date"
                value={(formData.licenseIssueDate ?? "").slice(0, 10)}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Expiry date"
                name="licenseExpiryDate"
                type="date"
                value={(formData.licenseExpiryDate ?? "").slice(0, 10)}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth required disabled={warehousesLoading}>
                <InputLabel id="warehouseId-edit-label">Warehouse</InputLabel>
                <Select
                  labelId="warehouseId-edit-label"
                  name="warehouseId"
                  value={formData.warehouseId ?? ""}
                  onChange={handleChange}
                  label="Warehouse"
                >
                  {warehouses.length === 0 ? (
                    <MenuItem value="" disabled>
                      {warehousesLoading ? "Loading..." : "No warehouses"}
                    </MenuItem>
                  ) : (
                    warehouses
                      .filter((w) => typeof w.id === "string" && w.id.length > 0)
                      .map((w) => (
                        <MenuItem key={w.id as string} value={w.id as string}>
                          {w.name} ({w.id})
                        </MenuItem>
                      ))
                  )}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Assigned vehicle id"
                name="assignedVehicleId"
                value={formData.assignedVehicleId ?? ""}
                onChange={handleChange}
                placeholder="vehicle-uuid"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Years of experience"
                name="yearsOfExperience"
                type="number"
                value={formData.yearsOfExperience ?? ""}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Rating"
                name="rating"
                type="number"
                value={formData.rating ?? ""}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 0, max: 5, step: 0.5 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Total trips"
                name="totalTrips"
                type="number"
                value={formData.totalTrips ?? ""}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 0, step: 1 } }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Contract number"
                name="contractNumber"
                value={formData.contractNumber ?? ""}
                onChange={handleChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label="Contract start"
                name="contractStartDate"
                type="date"
                value={(formData.contractStartDate ?? "").slice(0, 10)}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label="Contract end"
                name="contractEndDate"
                type="date"
                value={(formData.contractEndDate ?? "").slice(0, 10)}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Emergency contact name"
                name="emergencyContactName"
                value={formData.emergencyContactName ?? ""}
                onChange={handleChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label="Emergency phone"
                name="emergencyContactPhone"
                value={formData.emergencyContactPhone ?? ""}
                onChange={handleChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                fullWidth
                label="Relation"
                name="emergencyContactRelation"
                value={formData.emergencyContactRelation ?? ""}
                onChange={handleChange}
                placeholder="Spouse / Parent"
              />
            </Grid>
          </Grid>
        );

      default:
        return null;
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
            <EditIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h6" component="span">
            Sửa thông tin tài xế
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {!driver ? (
          <Alert severity="warning">Chưa chọn tài xế.</Alert>
        ) : (
          <>
            <Stepper activeStep={activeStep} alternativeLabel>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ mt: 3 }}>{renderStepContent()}</Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0, gap: 2 }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined" size="large">
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={handleBack}
          disabled={loading || activeStep === 0 || !driver}
          variant="outlined"
          size="large"
        >
          Back
        </Button>

        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} disabled={loading || !driver} variant="contained" size="large">
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={loading || !driver}
            variant="contained"
            size="large"
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? "Submitting..." : "Save"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}


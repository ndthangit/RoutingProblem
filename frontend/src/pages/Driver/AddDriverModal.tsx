import { useMemo, useState } from "react";
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
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import BadgeIcon from "@mui/icons-material/Badge";
import Grid from "@mui/material/Grid";

import { useKeycloak } from "@react-keycloak/web";
import { request } from "../../api";
import type { Driver, DriverHiredEvent, DriverStatus, DriverType, LicenseClass } from "../../types";

interface AddDriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const steps = [
  "Thông tin tài khoản",
  "Bằng lái & công việc",
  "Hợp đồng & phân công",
  "Sức khỏe & liên hệ khẩn",
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

export default function AddDriverModal({ isOpen, onClose, onSuccess }: AddDriverModalProps) {
  const { keycloak } = useKeycloak();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const [formData, setFormData] = useState<Partial<Driver>>({
    employeeCode: "",
    status: "ACTIVE" as DriverStatus,
    hireDate: "",
    driverType: "TRUCK_DRIVER" as DriverType,

    firstName: "",
    lastName: "",
    email: "",
    username: "",
    phone: "",
    enabled: true,
    emailVerified: false,

    licenseNumber: "",
    licenseClass: ["A1"],
    licenseIssueDate: "",
    licenseExpiryDate: "",

    yearsOfExperience: 0,
    rating: 5,
    totalTrips: 0,
    assignedVehicleId: "",

    contractNumber: "",
    contractStartDate: "",
    contractEndDate: "",

    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",

    healthCheckDate: "",
    healthCheckExpiry: "",
    medicalConditions: "",
  });

  const resetForm = () => {
    setActiveStep(0);
    setError(null);
    setFormData({
      employeeCode: "",
      status: "ACTIVE" as DriverStatus,
      hireDate: "",
      driverType: "TRUCK_DRIVER" as DriverType,

      firstName: "",
      lastName: "",
      email: "",
      username: "",
      phone: "",
      enabled: true,
      emailVerified: false,

      licenseNumber: "",
      licenseClass: ["A1"],
      licenseIssueDate: "",
      licenseExpiryDate: "",

      yearsOfExperience: 0,
      rating: 5,
      totalTrips: 0,
      assignedVehicleId: "",

      contractNumber: "",
      contractStartDate: "",
      contractEndDate: "",

      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",

      healthCheckDate: "",
      healthCheckExpiry: "",
      medicalConditions: "",
    });
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
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
    setLoading(true);
    setError(null);

    try {
      const driver: Partial<Driver> = compactObject({
        ...formData,
        hireDate: toIsoDateTime(formData.hireDate),
        licenseIssueDate: toIsoDateTime(formData.licenseIssueDate),
        licenseExpiryDate: toIsoDateTime(formData.licenseExpiryDate),
        contractStartDate: toIsoDateTime(formData.contractStartDate),
        contractEndDate: toIsoDateTime(formData.contractEndDate),
        healthCheckDate: toIsoDateTime(formData.healthCheckDate),
        healthCheckExpiry: toIsoDateTime(formData.healthCheckExpiry),
      } as Driver);

      const payload: DriverHiredEvent = {
        event_id: window.crypto?.randomUUID?.() ?? undefined,
        timestamp: new Date().toISOString(),
        ownerEmail: (keycloak?.tokenParsed as any)?.email || "unknown",
        eventType: "DRIVER.HIRED",
        driver: driver as Driver,
      };

      await request("POST", "/v1/drivers", undefined, undefined, payload as any);

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add driver");
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

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Health check date"
                name="healthCheckDate"
                type="date"
                value={(formData.healthCheckDate ?? "").slice(0, 10)}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Health check expiry"
                name="healthCheckExpiry"
                type="date"
                value={(formData.healthCheckExpiry ?? "").slice(0, 10)}
                onChange={handleChange}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Medical conditions"
                name="medicalConditions"
                value={formData.medicalConditions ?? ""}
                onChange={handleChange}
                multiline
                minRows={3}
                placeholder="Ghi chú nếu có"
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
            <BadgeIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h6" component="span">
            Đăng ký tài xế mới
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" disabled={loading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
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
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0, gap: 2 }}>
        <Button onClick={handleClose} disabled={loading} variant="outlined" size="large">
          Cancel
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={handleBack}
          disabled={loading || activeStep === 0}
          variant="outlined"
          size="large"
        >
          Back
        </Button>

        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} disabled={loading} variant="contained" size="large">
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant="contained"
            size="large"
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? "Submitting..." : "Submit"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

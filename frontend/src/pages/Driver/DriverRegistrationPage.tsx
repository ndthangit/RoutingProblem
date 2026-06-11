import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import BadgeIcon from "@mui/icons-material/Badge";
import Grid from "@mui/material/Grid";
import { useKeycloak } from "@react-keycloak/web";
import { useNavigate } from "react-router-dom";

import { request } from "../../api";
import type {
  BrandWarehouse,
  Driver,
  DriverEvent,
  DriverStatus,
  DriverType,
  LicenseClass,
} from "../../types";

type TokenProfile = {
  sub?: string;
  email?: string;
  preferred_username?: string;
  username?: string;
  given_name?: string;
  family_name?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  phone_number?: string;
  email_verified?: boolean;
  emailVerified?: boolean;
  enabled?: boolean;
  createdTimestamp?: number;
  attributes?: Record<string, unknown>;
};

const licenseClasses: LicenseClass[] = ["A1", "A2", "B1", "B2", "C", "D", "E", "F"];

const driverTypes: { value: DriverType; label: string }[] = [
  { value: "TRUCK_DRIVER", label: "Internal driver" },
  { value: "SEASONAL", label: "Seasonal driver" },
];

function toIsoDateTime(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes("T")) return value;
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function compactObject<T extends object>(obj: T): Partial<T> {
  const entries = Object.entries(obj as Record<string, unknown>).filter(
    ([, v]) => v !== null && v !== undefined && v !== ""
  );
  return Object.fromEntries(entries) as Partial<T>;
}

function tokenProfile(tokenParsed: unknown): TokenProfile {
  return (tokenParsed ?? {}) as TokenProfile;
}

function defaultFormData(profile: TokenProfile): Partial<Driver> {
  return {
    id: profile.sub ?? "",
    sub: profile.sub ?? "",
    employeeCode: "",
    status: "ACTIVE" as DriverStatus,
    hireDate: "",
    driverType: "TRUCK_DRIVER" as DriverType,

    firstName: profile.firstName ?? profile.given_name ?? "",
    lastName: profile.lastName ?? profile.family_name ?? "",
    email: profile.email ?? "",
    username: profile.username ?? profile.preferred_username ?? "",
    phone: profile.phone ?? profile.phone_number ?? "",
    enabled: profile.enabled ?? true,
    emailVerified: profile.emailVerified ?? profile.email_verified ?? false,
    createdTimestamp: profile.createdTimestamp ?? 0,
    attributes: profile.attributes ?? {},

    licenseNumber: "",
    licenseClass: ["A1"],
    licenseIssueDate: "",
    licenseExpiryDate: "",

    yearsOfExperience: 0,
    totalTrips: 0,
    rating: 5,
    warehouseId: "",

    contractNumber: "",
    contractStartDate: "",
    contractEndDate: "",

    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "",
  };
}

export default function DriverRegistrationPage() {
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();
  const profile = useMemo(() => tokenProfile(keycloak?.tokenParsed), [keycloak?.tokenParsed]);

  const [formData, setFormData] = useState<Partial<Driver>>(() => defaultFormData(profile));
  const [existingDriver, setExistingDriver] = useState<Driver | null>(null);
  const [warehouses, setWarehouses] = useState<BrandWarehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerEmail = profile.email || "unknown";
  const keycloakSub = profile.sub ?? "";

  useEffect(() => {
    setFormData((prev) => ({
      ...defaultFormData(profile),
      ...prev,
      id: profile.sub ?? prev.id ?? "",
      sub: profile.sub ?? prev.sub ?? "",
      email: profile.email ?? prev.email ?? "",
      username: profile.username ?? profile.preferred_username ?? prev.username ?? "",
      enabled: profile.enabled ?? prev.enabled ?? true,
      emailVerified: profile.emailVerified ?? profile.email_verified ?? prev.emailVerified ?? false,
      createdTimestamp: profile.createdTimestamp ?? prev.createdTimestamp ?? 0,
      attributes: profile.attributes ?? prev.attributes ?? {},
    }));
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    const fetchInitialData = async () => {
      setInitialLoading(true);
      setWarehousesLoading(true);
      setError(null);

      try {
        const [driverRes, warehouseRes] = await Promise.all([
          request<Driver>("GET", "/v1/drivers/me"),
          request<BrandWarehouse[]>("GET", "/v1/brand-warehouses"),
        ]);

        if (cancelled) return;

        const driver = driverRes?.data ?? null;
        const nextWarehouses = warehouseRes?.data ?? [];
        setWarehouses(nextWarehouses);

        if (driver) {
          setExistingDriver(driver);
          setFormData({
            ...defaultFormData(profile),
            ...driver,
            id: keycloakSub,
            sub: keycloakSub,
            email: profile.email ?? driver.email ?? "",
            username: profile.username ?? profile.preferred_username ?? driver.username ?? "",
            firstName: driver.firstName ?? profile.firstName ?? profile.given_name ?? "",
            lastName: driver.lastName ?? profile.lastName ?? profile.family_name ?? "",
            phone: driver.phone ?? profile.phone ?? profile.phone_number ?? "",
            enabled: profile.enabled ?? driver.enabled ?? true,
            emailVerified: profile.emailVerified ?? profile.email_verified ?? driver.emailVerified ?? false,
            createdTimestamp: profile.createdTimestamp ?? driver.createdTimestamp ?? 0,
            attributes: profile.attributes ?? driver.attributes ?? {},
            licenseClass:
              driver.licenseClass && driver.licenseClass.length
                ? driver.licenseClass
                : ["A1"],
          });
        } else {
          setExistingDriver(null);
          setFormData(defaultFormData(profile));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load driver profile");
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
          setWarehousesLoading(false);
        }
      }
    };

    fetchInitialData();
    return () => {
      cancelled = true;
    };
  }, [keycloakSub, profile]);

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

  const validateForm = (): string | null => {
    if (!keycloakSub) return "Missing Keycloak subject.";
    if (!formData.firstName || !formData.lastName) return "First name and last name are required.";
    if (!formData.phone) return "Phone is required.";
    if (!formData.employeeCode) return "Employee code is required.";
    if (!formData.licenseNumber) return "License number is required.";
    if (!formData.licenseClass || formData.licenseClass.length === 0) return "License class is required.";
    if (!formData.licenseIssueDate) return "License issue date is required.";
    if (!formData.licenseExpiryDate) return "License expiry date is required.";
    if (!formData.warehouseId) return "Warehouse is required.";
    return null;
  };

  const handleCancel = () => {
    if (loading || initialLoading) return;
    navigate("/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const message = validateForm();
    if (message) {
      setError(message);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedWarehouse =
        warehouses.find((w) => String(w.id) === String(formData.warehouseId ?? "")) ?? null;

      const driver: Partial<Driver> = compactObject({
        ...formData,
        id: keycloakSub,
        sub: keycloakSub,
        email: profile.email ?? formData.email,
        username: profile.username ?? profile.preferred_username ?? formData.username,
        enabled: profile.enabled ?? formData.enabled ?? true,
        emailVerified: profile.emailVerified ?? profile.email_verified ?? formData.emailVerified ?? false,
        createdTimestamp: profile.createdTimestamp ?? formData.createdTimestamp ?? 0,
        attributes: profile.attributes ?? formData.attributes ?? {},
        warehouseAddress: selectedWarehouse?.address ?? undefined,
        hireDate: toIsoDateTime(formData.hireDate),
        licenseIssueDate: toIsoDateTime(formData.licenseIssueDate),
        licenseExpiryDate: toIsoDateTime(formData.licenseExpiryDate),
        contractStartDate: toIsoDateTime(formData.contractStartDate),
        contractEndDate: toIsoDateTime(formData.contractEndDate),
      } as Driver);

      const payload: DriverEvent = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: new Date().toISOString(),
        ownerEmail,
        eventType: existingDriver ? "DRIVER.UPDATED" : "DRIVER.HIRED",
        driver: driver as Driver,
      };

      const response = existingDriver
        ? await request<Driver, DriverEvent>("PUT", "/v1/drivers/me", undefined, undefined, payload)
        : await request<Driver, DriverEvent>("POST", "/v1/drivers/me", undefined, undefined, payload);

      if (!response?.data) {
        throw new Error("Failed to save driver profile");
      }

      setExistingDriver(response.data);
      setFormData((prev) => ({ ...prev, ...response.data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save driver profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <BadgeIcon fontSize="small" />
          <h2 className="text-lg font-bold text-slate-900">
            {existingDriver ? "Driver profile" : "Driver registration"}
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
                <TextField fullWidth label="Keycloak ID" value={keycloakSub} disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Username" value={formData.username ?? ""} disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Email" value={formData.email ?? ""} disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  label="First name"
                  name="firstName"
                  value={formData.firstName ?? ""}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
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
                  label="Phone"
                  name="phone"
                  value={formData.phone ?? ""}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label="Employee code"
                  name="employeeCode"
                  value={formData.employeeCode ?? ""}
                  onChange={handleChange}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
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
              <Grid size={{ xs: 12, sm: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Driver type</InputLabel>
                  <Select
                    name="driverType"
                    value={(formData.driverType as DriverType) ?? "TRUCK_DRIVER"}
                    onChange={handleChange}
                    label="Driver type"
                  >
                    {driverTypes.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
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
              <Grid size={{ xs: 12, sm: 6 }}>
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
                    {licenseClasses.map((licenseClass) => (
                      <MenuItem key={licenseClass} value={licenseClass}>
                        {licenseClass}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  label="Issue date"
                  name="licenseIssueDate"
                  type="date"
                  value={(formData.licenseIssueDate ?? "").slice(0, 10)}
                  onChange={handleChange}
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  label="Expiry date"
                  name="licenseExpiryDate"
                  type="date"
                  value={(formData.licenseExpiryDate ?? "").slice(0, 10)}
                  onChange={handleChange}
                  required
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  fullWidth
                  label="Years of experience"
                  name="yearsOfExperience"
                  type="number"
                  value={formData.yearsOfExperience ?? 0}
                  onChange={handleChange}
                  slotProps={{ htmlInput: { min: 0, step: 1 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <FormControl fullWidth required disabled={warehousesLoading}>
                  <InputLabel>Warehouse</InputLabel>
                  <Select
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
                        .filter((warehouse) => typeof warehouse.id === "string" && warehouse.id.length > 0)
                        .map((warehouse) => (
                          <MenuItem key={warehouse.id as string} value={warehouse.id as string}>
                            {warehouse.name} ({warehouse.id})
                          </MenuItem>
                        ))
                    )}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Contract number"
                  name="contractNumber"
                  value={formData.contractNumber ?? ""}
                  onChange={handleChange}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
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
              <Grid size={{ xs: 12, sm: 4 }}>
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
              <Grid size={{ xs: 12, sm: 5 }}>
                <TextField
                  fullWidth
                  label="Emergency contact"
                  name="emergencyContactName"
                  value={formData.emergencyContactName ?? ""}
                  onChange={handleChange}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
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
                />
              </Grid>
            </Grid>
          )}

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 3 }}>
            <Button onClick={handleCancel} disabled={loading || initialLoading} variant="outlined" size="large">
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
              ) : existingDriver ? (
                "Update"
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

import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Button,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import BadgeIcon from "@mui/icons-material/Badge";
import type { ReactNode } from "react";

import type { Driver } from "../../types";

interface DriverDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
}

const KNOWN_DRIVER_FIELDS = [
  "id",
  "employeeCode",
  "hireDate",
  "status",
  "driverType",
  "licenseNumber",
  "licenseClass",
  "licenseIssueDate",
  "licenseExpiryDate",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
  "yearsOfExperience",
  "totalTrips",
  "rating",
  "assignedVehicleId",
  "licensePlate",
  "warehouseId",
  "warehouseAddress",
  "contractNumber",
  "contractStartDate",
  "contractEndDate",
  "sub",
  "username",
  "email",
  "firstName",
  "lastName",
  "phone",
  "enabled",
  "emailVerified",
  "createdTimestamp",
  "createdAt",
  "updatedAt",
  "created_at",
  "updated_at",
  "attributes",
] as const;

function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function formatDate(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (value instanceof Date) return isNaN(value.getTime()) ? "N/A" : value.toLocaleString();
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatBoolean(value?: boolean): string {
  if (value === null || value === undefined) return "N/A";
  return value ? "Yes" : "No";
}

function formatValue(value: unknown): ReactNode {
  if (isEmptyValue(value)) return "N/A";
  if (typeof value === "boolean") return formatBoolean(value);
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") {
    return (
      <Box
        component="pre"
        sx={{
          m: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "monospace",
          fontSize: 12,
        }}
      >
        {JSON.stringify(value, null, 2)}
      </Box>
    );
  }
  return String(value);
}

function FieldRow({ label, value }: { label: string; value?: ReactNode }) {
  const display = isEmptyValue(value) ? "N/A" : value;
  return (
    <Box sx={{ display: "flex", gap: 2, py: 0.75 }}>
      <Typography sx={{ width: 220, color: "text.secondary", fontWeight: 600 }} variant="body2">
        {label}
      </Typography>
      <Typography component="div" sx={{ flex: 1, minWidth: 0, wordBreak: "break-word" }} variant="body2">
        {display}
      </Typography>
    </Box>
  );
}

function AdditionalFields({ data }: { data: Driver }) {
  const known = new Set<string>(KNOWN_DRIVER_FIELDS);
  const entries = Object.entries(data as unknown as Record<string, unknown>).filter(
    ([key, value]) => !known.has(key) && !isEmptyValue(value)
  );

  if (!entries.length) return null;

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Additional fields
      </Typography>
      {entries.map(([key, value]) => (
        <FieldRow key={key} label={key} value={formatValue(value)} />
      ))}
    </>
  );
}

export default function DriverDetailsModal({ isOpen, onClose, driver }: DriverDetailsModalProps) {
  const createdAt = driver?.createdAt ?? driver?.created_at;
  const updatedAt = driver?.updatedAt ?? driver?.updated_at;

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <BadgeIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Driver details
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {driver ? `${(driver.firstName ?? "").trim()} ${(driver.lastName ?? "").trim()}`.trim() || driver.username || driver.id : ""}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {!driver ? (
          <Typography variant="body2" color="text.secondary">
            No driver selected.
          </Typography>
        ) : (
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Account & Identity
            </Typography>
            <FieldRow label="ID" value={driver.id} />
            <FieldRow label="Keycloak subject" value={driver.sub} />
            <FieldRow label="Employee code" value={driver.employeeCode} />
            <FieldRow label="First name" value={driver.firstName} />
            <FieldRow label="Last name" value={driver.lastName} />
            <FieldRow label="Username" value={driver.username} />
            <FieldRow label="Email" value={driver.email} />
            <FieldRow label="Phone" value={driver.phone} />
            <FieldRow label="Enabled" value={formatBoolean(driver.enabled)} />
            <FieldRow label="Email verified" value={formatBoolean(driver.emailVerified)} />
            <FieldRow label="Created timestamp" value={formatDate(driver.createdTimestamp)} />
            <FieldRow label="Attributes" value={formatValue(driver.attributes)} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Employment & Performance
            </Typography>
            <FieldRow label="Status" value={driver.status} />
            <FieldRow
              label="Driver type"
              value={
                driver.driverType === "TRUCK_DRIVER"
                  ? "Tài xế nội bộ (Full-time)"
                  : driver.driverType === "SEASONAL"
                    ? "Shipper thời vụ / Freelancer"
                    : driver.driverType
              }
            />
            <FieldRow label="Hire date" value={formatDate(driver.hireDate)} />
            <FieldRow label="Years of experience" value={driver.yearsOfExperience} />
            <FieldRow label="Total trips" value={driver.totalTrips} />
            <FieldRow label="Rating" value={driver.rating} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              License
            </Typography>
            <FieldRow label="License number" value={driver.licenseNumber} />
            <FieldRow label="License class" value={driver.licenseClass?.length ? driver.licenseClass.join(", ") : "N/A"} />
            <FieldRow label="Issue date" value={formatDate(driver.licenseIssueDate)} />
            <FieldRow label="Expiry date" value={formatDate(driver.licenseExpiryDate)} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Contract & Assignment
            </Typography>
            <FieldRow label="Contract number" value={driver.contractNumber} />
            <FieldRow label="Contract start" value={formatDate(driver.contractStartDate)} />
            <FieldRow label="Contract end" value={formatDate(driver.contractEndDate)} />
            <FieldRow label="Warehouse ID" value={driver.warehouseId} />
            <FieldRow label="Warehouse address" value={driver.warehouseAddress} />
            <FieldRow
              label="Assigned vehicle"
              value={
                driver.licensePlate
                  ? `${driver.licensePlate}${driver.assignedVehicleId ? ` (id: ${driver.assignedVehicleId})` : ""}`
                  : driver.assignedVehicleId
                    ? `ID: ${driver.assignedVehicleId}`
                    : "Unassigned"
              }
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Emergency
            </Typography>
            <FieldRow label="Emergency contact name" value={driver.emergencyContactName} />
            <FieldRow label="Emergency contact phone" value={driver.emergencyContactPhone} />
            <FieldRow label="Emergency contact relation" value={driver.emergencyContactRelation} />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Metadata
            </Typography>
            <FieldRow label="Created at" value={formatDate(createdAt)} />
            <FieldRow label="Updated at" value={formatDate(updatedAt)} />
            <AdditionalFields data={driver} />
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}


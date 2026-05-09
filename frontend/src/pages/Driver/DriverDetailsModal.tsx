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

import type { Driver } from "../../types";

interface DriverDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
}

function formatDate(value?: string | number): string {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  }

  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function FieldRow({ label, value }: { label: string; value?: React.ReactNode }) {
  const display = value === null || value === undefined || value === "" ? "N/A" : value;
  return (
    <Box sx={{ display: "flex", gap: 2, py: 0.75 }}>
      <Typography sx={{ width: 220, color: "text.secondary", fontWeight: 600 }} variant="body2">
        {label}
      </Typography>
      <Typography sx={{ flex: 1 }} variant="body2">
        {display}
      </Typography>
    </Box>
  );
}

export default function DriverDetailsModal({ isOpen, onClose, driver }: DriverDetailsModalProps) {
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
            <FieldRow label="Employee code" value={driver.employeeCode} />
            <FieldRow label="Username" value={driver.username} />
            <FieldRow label="Email" value={driver.email} />
            <FieldRow label="Phone" value={driver.phone} />
            <FieldRow label="Enabled" value={driver.enabled === undefined ? "N/A" : driver.enabled ? "Yes" : "No"} />
            <FieldRow
              label="Email verified"
              value={driver.emailVerified === undefined ? "N/A" : driver.emailVerified ? "Yes" : "No"}
            />
            <FieldRow label="Created timestamp" value={formatDate(driver.createdTimestamp)} />

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
            <FieldRow label="Created at" value={formatDate(driver.createdAt)} />
            <FieldRow label="Updated at" value={formatDate(driver.updatedAt)} />
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


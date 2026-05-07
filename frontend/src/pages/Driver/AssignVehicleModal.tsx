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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";

import { useKeycloak } from "@react-keycloak/web";
import { request } from "../../api";
import type { Driver, Vehicle } from "../../types";

interface AssignVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  driver: Driver | null;
  vehicles: Vehicle[];
  vehiclesLoading?: boolean;
}

function vehicleLabel(vehicle: Vehicle): string {
  const plate = vehicle.licensePlate || vehicle.id;
  const brandModel = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim();
  const suffix = brandModel ? ` — ${brandModel}` : "";
  return `${plate}${suffix}`;
}

export default function AssignVehicleModal({
  isOpen,
  onClose,
  onSuccess,
  driver,
  vehicles,
  vehiclesLoading = false,
}: AssignVehicleModalProps) {
  const { keycloak } = useKeycloak();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleVehicles = useMemo(() => {
    if (!driver) return [];
    // Only allow assigning vehicles that are currently unassigned.
    return vehicles.filter((v) => !v.driverId);
  }, [vehicles, driver]);

  const currentVehicleId = driver?.assignedVehicleId ?? "";
  const isDriverAlreadyAssigned = Boolean(currentVehicleId);

  // Pre-fill selection when opening modal / switching driver
  useEffect(() => {
    if (!isOpen || !driver) return;
    if (selectedVehicleId) return;
    const defaultId = eligibleVehicles[0]?.id || "";
    setSelectedVehicleId(defaultId);
  }, [isOpen, driver, currentVehicleId, eligibleVehicles, selectedVehicleId]);

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    setSelectedVehicleId("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!driver) return;

    if (driver.assignedVehicleId) {
      setError("Tài xế đã được phân công xe. Vui lòng thu hồi xe trước khi phân công xe khác.");
      return;
    }

    if (!selectedVehicleId) {
      setError("Vui lòng chọn xe để phân công.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ownerEmail = (keycloak?.tokenParsed as any)?.email || "unknown";

      const nextVehicle = vehicles.find((v) => v.id === selectedVehicleId) || null;
      if (!nextVehicle) {
        throw new Error("Không tìm thấy xe được chọn.");
      }

      if (nextVehicle.driverId) {
        setError("Xe này đã được phân công. Vui lòng chọn xe khác.");
        return;
      }

      // Use domain event to assign vehicle to driver (backend will update both Driver & Vehicle).
      await request(
        "POST",
        `/v1/driver-vehicle`,
        undefined,
        undefined,
        {
          eventType: "DRIVER.VEHICLE.ASSIGNED",
          ownerEmail,
          timestamp: new Date().toISOString(),
          driver: {
            ...driver,
            assignedVehicleId: selectedVehicleId,
          },
        } as any
      );

      onSuccess();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Phân công xe thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
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
            <DirectionsCarIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h6" component="span">
            Phân công xe
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!driver ? (
          <Alert severity="warning">Chưa chọn tài xế.</Alert>
        ) : isDriverAlreadyAssigned ? (
          <Alert severity="info">
            Tài xế đã có xe (<b>{currentVehicleId}</b>). Vui lòng thu hồi xe trước khi phân công.
          </Alert>
        ) : vehiclesLoading ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <CircularProgress size={20} />
            <Typography>Đang tải danh sách xe…</Typography>
          </Box>
        ) : (
          <>
            <Typography sx={{ mb: 2 }}>
              Tài xế: <b>{`${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() || driver.username || driver.id}</b>
            </Typography>

            <FormControl fullWidth>
              <InputLabel id="assign-vehicle-select">Chọn xe</InputLabel>
              <Select
                labelId="assign-vehicle-select"
                label="Chọn xe"
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(String(e.target.value))}
              >
                {eligibleVehicles.length === 0 ? (
                  <MenuItem value="" disabled>
                    Không có xe trống
                  </MenuItem>
                ) : (
                  eligibleVehicles.map((v) => (
                    <MenuItem key={v.id} value={v.id}>
                      {vehicleLabel(v)}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>

            {currentVehicleId ? (
              <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                Hiện tại: {currentVehicleId}
              </Typography>
            ) : null}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting} variant="outlined">
          Hủy
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={submitting || !driver || vehiclesLoading || !selectedVehicleId || isDriverAlreadyAssigned}
          variant="contained"
        >
          {submitting ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Phân công"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

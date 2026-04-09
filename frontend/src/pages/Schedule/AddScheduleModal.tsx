import { useEffect, useState } from "react";
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
import Grid from "@mui/material/Grid";
import { CalendarPlus } from "lucide-react";

import { request } from "../../api";
import type { Schedule, ScheduleEvent, ScheduleType } from "../../types";

interface AddScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddScheduleModal({ isOpen, onClose, onSuccess }: AddScheduleModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type FormData = {
    origin: string;
    destination: string;
    scheduleType: ScheduleType;
    vehicleId: string;
    note: string;
    isActive: boolean;
  };

  const [formData, setFormData] = useState<FormData>({
    origin: "",
    destination: "",
    scheduleType: "ONCE_PER_WEEK",
    vehicleId: "",
    note: "",
    isActive: true,
  });

  const resetForm = () => {
    setError(null);
    setFormData({
      origin: "",
      destination: "",
      scheduleType: "ONCE_PER_WEEK",
      vehicleId: "",
      note: "",
      isActive: true,
    });
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.origin || !formData.destination) {
        setError("Vui lòng nhập Origin và Destination");
        return;
      }
      if (!formData.vehicleId) {
        setError("Vui lòng nhập Vehicle ID (scheduleConfig.vehicleId)");
        return;
      }

      const nowIso = new Date().toISOString();

      const schedule: Schedule = {
        id: window.crypto?.randomUUID?.() ? `template::${window.crypto.randomUUID()}` : "template::",
        origin: formData.origin,
        destination: formData.destination,
        scheduleType: formData.scheduleType,
        scheduleConfig: {
          vehicleId: formData.vehicleId,
        },
        note: formData.note || null,
        isActive: formData.isActive,
      };

      const payload: ScheduleEvent = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        ownerEmail: "unknown",
        eventType: "SCHEDULE.CREATED",
        schedule,
      };

      await request<ScheduleEvent>("POST", "/v1/schedules", undefined, undefined, payload);

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <CalendarPlus size={18} />
          <Typography variant="h6">Add Schedule</Typography>
        </Box>
        <IconButton onClick={handleClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Origin"
                name="origin"
                value={formData.origin}
                onChange={handleChange}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Destination"
                name="destination"
                value={formData.destination}
                onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                select
                label="Schedule Type"
                name="scheduleType"
                value={formData.scheduleType}
                onChange={handleChange}
              >
                <MenuItem value="ONCE_PER_WEEK">ONCE_PER_WEEK</MenuItem>
                <MenuItem value="DAILY">DAILY</MenuItem>
                <MenuItem value="TEMPERATURE_TRIGGER">TEMPERATURE_TRIGGER</MenuItem>
              </TextField>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Vehicle ID"
                name="vehicleId"
                value={formData.vehicleId}
                onChange={handleChange}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Note"
                name="note"
                value={formData.note}
                onChange={handleChange}
                multiline
                minRows={2}
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Active"
                name="isActive"
                value={String(formData.isActive)}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, isActive: e.target.value === "true" }))
                }
              >
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : "Create"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}





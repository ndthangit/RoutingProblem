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
import RouteIcon from "@mui/icons-material/Route";
import Grid from "@mui/material/Grid";
import { useKeycloak } from "@react-keycloak/web";

import { request } from "../../api";
import type { Route, RouteEvent, RouteType } from "../../types";

interface AddRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type FormData = {
  vehicleId: string;
  origin: string;
  destination: string;
  routeType: RouteType;
};

export default function AddRouteModal({ isOpen, onClose, onSuccess }: AddRouteModalProps) {
  const { keycloak } = useKeycloak();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    vehicleId: "",
    origin: "",
    destination: "",
    routeType: "TEMPERATURE",
  });

  const resetForm = () => {
    setError(null);
    setFormData({
      vehicleId: "",
      origin: "",
      destination: "",
      routeType: "TEMPERATURE",
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
      if (!formData.vehicleId) {
        setError("Vui lòng nhập Vehicle ID.");
        return;
      }
      if (!formData.origin || !formData.destination) {
        setError("Vui lòng nhập Origin và Destination.");
        return;
      }

      const nowIso = new Date().toISOString();

      const route: Route = {
        id: window.crypto?.randomUUID?.() ?? "",
        vehicleId: formData.vehicleId,
        origin: formData.origin,
        destination: formData.destination,
        startTime: nowIso,
        routeType: formData.routeType,
      };

      const payload: RouteEvent = {
        event_id: window.crypto?.randomUUID?.() ?? "",
        timestamp: nowIso,
        ownerEmail:
          ((keycloak?.tokenParsed as unknown) as { email?: string } | undefined)?.email ||
          "unknown",
        eventType: "ROUTE.STARTED",
        route,
      };
      console.log("Submitting new route event:", payload);

      await request<RouteEvent>("POST", "/v1/routes", undefined, undefined, payload);

      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add route");
    } finally {
      setLoading(false);
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
            <RouteIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h6" component="span">
            Add New Route
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

          <Grid container spacing={3}>
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
                select
                fullWidth
                required
                label="Route Type"
                name="routeType"
                value={formData.routeType}
                onChange={handleChange}
              >
                <MenuItem value="TEMPERATURE">TEMPERATURE</MenuItem>
                <MenuItem value="ONCE_PER_WEEK">ONCE_PER_WEEK</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} /> : undefined}
          >
            Create Route
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

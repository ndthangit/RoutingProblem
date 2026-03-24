import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  IconButton,
  Alert,
  CircularProgress,
  Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Grid from '@mui/material/Grid';
import { request } from '../../api';
import type { Vehicle, VehicleStatus, VehicleType } from '../../types';
import { useKeycloak } from '@react-keycloak/web';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddVehicleModal({ isOpen, onClose, onSuccess }: AddVehicleModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { keycloak, initialized } = useKeycloak();


  const [formData, setFormData] = useState<Partial<Vehicle>>({
    licensePlate: '',
    vehicleType: 'TRUCK' as VehicleType,
    status: 'ACTIVE' as VehicleStatus,
    capacity: 1,
    brand: null,
    model: null,
    year: new Date().getFullYear(),
    color: null,
    driverId: null,
  });

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | { target: { name: string; value: unknown } }
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: ['capacity', 'year'].includes(name) ? (value === '' ? null : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const vehicle = Object.fromEntries(
        Object.entries(formData).filter(([, v]) => v !== null && v !== undefined && v !== '')
      );

      const payload = {
        eventType: 'VEHICLE.REGISTERED',
        ownerEmail: keycloak.tokenParsed?.email || 'unknown',
        vehicle: vehicle as Partial<Vehicle>,
      };
      console.log('Submitting payload:', payload);

      await request(
        'POST',
        '/v1/vehicles',
        undefined,
        undefined,
        payload
      );

      setFormData({
        licensePlate: '',
        vehicleType: 'TRUCK' as VehicleType,
        status: 'ACTIVE' as VehicleStatus,
        capacity: 1,
        brand: null,
        model: null,
        year: new Date().getFullYear(),
        color: null,
        driverId: null,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vehicle');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={isOpen} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
            maxHeight: '90vh'
          }
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: 1,
        borderColor: 'divider',
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ 
            width: 40, 
            height: 40, 
            bgcolor: 'primary.main', 
            borderRadius: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center' 
          }}>
            <LocalShippingIcon sx={{ color: 'white' }} />
          </Box>
          <Typography variant="h6" component="span">
            Add New Vehicle
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
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
                label="License Plate"
                name="licensePlate"
                value={formData.licensePlate ?? ''}
                onChange={handleChange}
                required
                placeholder="e.g., 30A-12345"
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Vehicle Type</InputLabel>
                <Select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  label="Vehicle Type"
                >
                  <MenuItem value="SEDAN">Sedan</MenuItem>
                  <MenuItem value="SUV">SUV</MenuItem>
                  <MenuItem value="TRUCK">Truck</MenuItem>
                  <MenuItem value="VAN">Van</MenuItem>
                  <MenuItem value="BUS">Bus</MenuItem>
                  <MenuItem value="MOTORCYCLE">Motorcycle</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  label="Status"
                >
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="MAINTENANCE">Maintenance</MenuItem>
                  <MenuItem value="RESERVED">Reserved</MenuItem>
                  <MenuItem value="EXPIRED_DOCUMENTS">Expired Documents</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Brand"
                name="brand"
                value={formData.brand ?? ''}
                onChange={handleChange}
                placeholder="e.g., Ford, Mercedes, Toyota"
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Model"
                name="model"
                value={formData.model ?? ''}
                onChange={handleChange}
                placeholder="e.g., Transit, Sprinter"
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Year"
                name="year"
                type="number"
                value={formData.year ?? ''}
                onChange={handleChange}
                slotProps={{ htmlInput: { min: 1900, max: new Date().getFullYear() + 1 } }}
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Color"
                name="color"
                value={formData.color ?? ''}
                onChange={handleChange}
                placeholder="e.g., White"
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Capacity (kg)"
                name="capacity"
                type="number"
                value={formData.capacity ?? ''}
                onChange={handleChange}
                required
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                placeholder="e.g., 5000"
                variant="outlined"
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Driver ID (optional)"
                name="driverId"
                value={formData.driverId ?? ''}
                onChange={handleChange}
                placeholder="e.g., driver-uuid"
                variant="outlined"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 0, gap: 2 }}>
          <Button
            onClick={onClose}
            disabled={loading}
            variant="outlined"
            size="large"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            variant="contained"
            size="large"
            startIcon={loading && <CircularProgress size={20} color="inherit" />}
          >
            {loading ? 'Adding...' : 'Add Vehicle'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

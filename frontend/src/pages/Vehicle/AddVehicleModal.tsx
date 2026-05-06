import { useEffect, useState } from 'react';
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
import type { Vehicle, VehicleEvent, VehicleStatus, VehicleType, BrandWarehouse } from '../../types';
import { useKeycloak } from '@react-keycloak/web';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialVehicle?: Vehicle | null;
}

export default function AddVehicleModal({ isOpen, onClose, onSuccess, initialVehicle }: AddVehicleModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { keycloak } = useKeycloak();

  const [warehouses, setWarehouses] = useState<BrandWarehouse[]>([]);


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
    warehouseId: null,
  });

  const resetForm = () => {
    setError(null);
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
      warehouseId: null,
    });
  };

  const hydrateFromInitial = (v: Vehicle) => {
    setFormData({
      id: v.id,
      licensePlate: v.licensePlate,
      vehicleType: v.vehicleType,
      status: v.status,
      capacity: v.capacity,
      brand: v.brand,
      model: v.model,
      year: v.year,
      color: v.color,
      driverId: v.driverId,
      warehouseId: v.warehouseId ?? null,
    });
  };

  const fetchWarehouses = async () => {
    try {
      const res = await request<BrandWarehouse[]>('GET', '/v1/brand-warehouses');
      setWarehouses(res?.data ?? []);
    } catch (e) {
      console.error('Failed to fetch warehouses:', e);
      setWarehouses([]);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (initialVehicle) hydrateFromInitial(initialVehicle);
    else resetForm();

    // Load warehouses for dropdown
    fetchWarehouses();
  }, [isOpen, initialVehicle]);

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
      if (!formData.warehouseId) {
        setError('Vui lòng chọn Warehouse quản lý vehicle.');
        return;
      }

      const selectedWarehouse = warehouses.find((w) => w.id === formData.warehouseId) ?? null;

      const vehicle = Object.fromEntries(
        Object.entries(formData).filter(([, v]) => v !== null && v !== undefined && v !== '')
      ) as Partial<Vehicle>;

      const nowIso = new Date().toISOString();
      const payload: VehicleEvent = {
        event_id: window.crypto?.randomUUID?.() ?? '',
        timestamp: nowIso,
        ownerEmail: (keycloak.tokenParsed as { email?: string } | undefined)?.email || 'unknown',
        eventType: initialVehicle ? 'VEHICLE.UPDATED' : 'VEHICLE.REGISTERED',
        vehicle: {
          ...(vehicle as Vehicle),
          id: initialVehicle?.id ?? (vehicle.id as string),
          warehouseAddress: selectedWarehouse?.address ?? null,

        } as Vehicle,
      };
      console.log('Submitting payload:', payload);

      if (initialVehicle?.id) {
        await request<VehicleEvent>('PUT', `/v1/vehicles/${initialVehicle.id}`, undefined, undefined, payload);
      } else {
        await request<VehicleEvent>('POST', '/v1/vehicles', undefined, undefined, payload);
      }

      resetForm();

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (initialVehicle ? 'Failed to update vehicle' : 'Failed to add vehicle'));
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
            {initialVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
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
                <InputLabel>Warehouse</InputLabel>
                <Select
                  name="warehouseId"
                  value={formData.warehouseId ?? ''}
                  onChange={handleChange}
                  label="Warehouse"
                >
                  {warehouses.map((w) => (
                    <MenuItem key={w.id} value={w.id}>
                      {w.name} {w.address ? `- ${w.address}` : ''}
                    </MenuItem>
                  ))}
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
            {loading ? (initialVehicle ? 'Saving...' : 'Adding...') : (initialVehicle ? 'Save' : 'Add Vehicle')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

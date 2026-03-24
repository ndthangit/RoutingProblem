export type VehicleStatus = 
  | 'ACTIVE'
  | 'INACTIVE'
  | 'MAINTENANCE'
  | 'RESERVED'
  | 'EXPIRED_DOCUMENTS';

export type VehicleType = 
  | 'SEDAN'
  | 'SUV'
  | 'TRUCK'
  | 'VAN'
  | 'BUS'
  | 'MOTORCYCLE';

export interface Vehicle {
  id: string;
  licensePlate: string;
  model: string | null;
  brand: string | null;
  year: number | null;
  color: string | null;
  capacity: number | null;
  vehicleType: VehicleType;
  status: VehicleStatus;
  driverId: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
  // Optional snake_case timestamps if backend returns them without aliases
  created_at?: Date | string;
  updated_at?: Date | string;
}
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

export type VehicleEventType =
  | "VEHICLE.REGISTERED"
  | "VEHICLE.UPDATED"
  | "VEHICLE.DRIVER.ASSIGNED"
  | "VEHICLE.DRIVER.UNASSIGNED"
  | "VEHICLE.STATUS.CHANGED"
  | "VEHICLE.MAINTENANCE.SCHEDULED"
  | "VEHICLE.MAINTENANCE.COMPLETED"
  | "VEHICLE.DOCUMENTS.EXPIRED"
  | "VEHICLE.DOCUMENTS.RENEWED"
  | "VEHICLE.DELETED"
  | "VEHICLE.INSPECTION.REQUIRED";

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
  warehouseId?: string | null;
  coordinate?: { lon: number; lat: number } | null;
  location?: { latitude: number; longitude: number } | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
  // Optional snake_case timestamps if backend returns them without aliases
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface VehicleEvent {
  event_id: string;
  timestamp: string;
  ownerEmail?: string;
  eventType: VehicleEventType;
  vehicle: Vehicle;
}

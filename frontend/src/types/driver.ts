export type DriverStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "ON_DUTY"
  | "OFF_DUTY"
  | "SUSPENDED"
  | "ON_LEAVE"
  | "TERMINATED";

export type DriverType = "TRUCK_DRIVER" | "SEASONAL";

export type LicenseClass =
  | "A1"
  | "A2"
  | "A3"
  | "A4"
  | "B1"
  | "B2"
  | "C"
  | "D"
  | "E"
  | "F";

export type DriverEventType =
  | "DRIVER.HIRED"
  | "DRIVER.UPDATED"
  | "DRIVER.STATUS.CHANGED"
  | "DRIVER.ACTIVATED"
  | "DRIVER.DEACTIVATED"
  | "DRIVER.SUSPENDED"
  | "DRIVER.TERMINATED"
  | "DRIVER.LICENSE.UPDATED"
  | "DRIVER.LICENSE.EXPIRING"
  | "DRIVER.LICENSE.EXPIRED"
  | "DRIVER.HEALTH_CHECK.UPDATED"
  | "DRIVER.HEALTH_CHECK.EXPIRING"
  | "DRIVER.VEHICLE.ASSIGNED"
  | "DRIVER.VEHICLE.UNASSIGNED"
  | "DRIVER.TRIP.STARTED"
  | "DRIVER.TRIP.COMPLETED"
  | "DRIVER.TRIP.CANCELLED"
  | "DRIVER.RATED"
  | "DRIVER.ACHIEVEMENT.EARNED";

export interface DriverAttributes {
  [key: string]: unknown;
}

export interface Driver {
  id: string;

  // HR / employment
  employeeCode?: string;
  hireDate?: string;
  status?: DriverStatus;
  driverType?: DriverType;

  // License
  licenseNumber?: string;
  licenseClass?: LicenseClass[];
  licenseIssueDate?: string;
  licenseExpiryDate?: string;

  // Emergency
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;

  // Performance
  yearsOfExperience?: number;
  totalTrips?: number;
  rating?: number;

  // Assignment
  assignedVehicleId?: string | null;
  licensePlate?: string | null;
  warehouseId?: string;
  warehouseAddress?: string | null;

  // Contract
  contractNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;


  // Keycloak / identity
  sub?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  createdTimestamp?: number;
  attributes?: DriverAttributes;

  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DriverEvent {
  event_id?: string;
  timestamp?: string;
  ownerEmail?: string;
  eventType: DriverEventType;
  driver: Driver;
}

export interface DriverHiredEvent extends DriverEvent {
  eventType: "DRIVER.HIRED";
}

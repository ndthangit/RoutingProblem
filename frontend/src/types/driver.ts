export type DriverStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "ON_LEAVE";

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
  assignedVehicleId?: string;

  // Contract
  contractNumber?: string;
  contractStartDate?: string;
  contractEndDate?: string;

  // Health
  healthCheckDate?: string;
  healthCheckExpiry?: string;
  medicalConditions?: string;

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
}

export interface DriverHiredEvent {
  event_id?: string;
  timestamp?: string;
  ownerEmail?: string;
  eventType: "DRIVER.HIRED";
  driver: Driver;
}

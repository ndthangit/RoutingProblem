export type BrandWarehouseStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "FULL"
  | "MAINTENANCE"
  | "CLOSED";

export type BrandWarehouseType =
  | "HUB"
  | "DEPOT";

export type BrandWarehouseEventType =
  | "WAREHOUSE.REGISTERED"
  | "WAREHOUSE.UPDATED"
  | "WAREHOUSE.STATUS.CHANGED"
  | "WAREHOUSE.CAPACITY.FULL"
  | "WAREHOUSE.MANAGER.ASSIGNED"
  | "WAREHOUSE.DELETED";

export interface BrandWarehouse {
  id?: string;

  name: string;
  address: string;

  // OSRM-style coordinate (lon/lat). Backend will also keep latitude/longitude for compatibility.
  coordinate?: { lon: number; lat: number } | null;

  warehouseType?: BrandWarehouseType;
  status?: BrandWarehouseStatus;

  capacity?: number | null;
  managerId?: string | null;
  contactPhone?: string | null;

  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface BrandWarehouseEvent {
  event_id: string;
  timestamp: string;
  ownerEmail?: string;
  eventType: BrandWarehouseEventType;
  warehouse: BrandWarehouse;
}


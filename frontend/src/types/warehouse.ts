export type WarehouseStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "FULL"
  | "MAINTENANCE"
  | "CLOSED";

export type WarehouseType =
  | "HUB"
  | "DEPOT"
  | "CUSTOMER_LOCATION"
  | "RECEIVER_LOCATION";

export type WarehouseEventType =
  | "WAREHOUSE.REGISTERED"
  | "WAREHOUSE.UPDATED"
  | "WAREHOUSE.STATUS.CHANGED"
  | "WAREHOUSE.CAPACITY.FULL"
  | "WAREHOUSE.MANAGER.ASSIGNED"
  | "WAREHOUSE.DELETED";

export interface Warehouse {
  id?: string;

  name: string;
  address: string;

  // OSRM-style coordinate (lon/lat). Backend will also keep latitude/longitude for compatibility.
  coordinate?: { lon: number; lat: number } | null;

  warehouseType?: WarehouseType;
  status?: WarehouseStatus;

  capacity?: number | null;
  managerId?: string | null;
  customerId?: string | null;
  contactPhone?: string | null;

  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface WarehouseEvent {
  event_id: string;
  timestamp: string;
  ownerEmail?: string;
  eventType: WarehouseEventType;
  warehouse: Warehouse;
}

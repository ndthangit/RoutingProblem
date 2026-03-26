export type WarehouseStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "FULL"
  | "MAINTENANCE"
  | "CLOSED";

export type WarehouseType =
  | "HUB"
  | "DEPOT"
  | "CUSTOMER_LOCATION";

export type WarehouseEventType =
  | "WAREHOUSE.REGISTERED"
  | "WAREHOUSE.UPDATED"
  | "WAREHOUSE.STATUS.CHANGED"
  | "WAREHOUSE.CAPACITY.FULL"
  | "WAREHOUSE.MANAGER.ASSIGNED"
  | "WAREHOUSE.DELETED";

export interface Warehouse {
  id: string;

  name: string;
  address: string;

  latitude?: number | null;
  longitude?: number | null;

  warehouseType?: WarehouseType;
  status?: WarehouseStatus;

  capacity?: number | null;
  managerId?: string | null;
  customerId?: string | null;
  contactPhone?: string | null;

  createdAt?: Date | string;
  updatedAt?: Date | string;

  // Optional snake_case timestamps if backend returns them without aliases
  created_at?: Date | string;
  updated_at?: Date | string;
}

export interface WarehouseEvent {
  event_id: string;
  timestamp: string;
  ownerEmail?: string;
  eventType: WarehouseEventType;
  warehouse: Warehouse;
}

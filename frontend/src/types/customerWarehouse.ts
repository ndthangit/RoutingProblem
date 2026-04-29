import type { WarehouseStatus } from "./warehouse";

export interface Coordinate {
  lon: number;
  lat: number;
}

export interface CustomerWarehouse {
  id?: string;

  name: string;
  address: string;
  coordinate?: Coordinate | null;

  representativeName: string;
  contactPhone: string;

  pendingWeight?: number;
  totalPendingOrders?: number;

  status?: WarehouseStatus;

  hubResponsible?: string | null;

  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export type CustomerWarehouseEventType =
  | "CUSTOMER_LOCATION.REGISTERED"
  | "CUSTOMER_LOCATION.LOAD_UPDATED"
  | "CUSTOMER_LOCATION.REPRESENTATIVE_UPDATED"
  | "CUSTOMER_LOCATION.UPDATED"
  | "CUSTOMER_LOCATION.DELETED";

export interface CustomerWarehouseEvent {
  event_id: string;
  timestamp: string;
  ownerEmail?: string;

  eventType: CustomerWarehouseEventType;
  customerWarehouse: CustomerWarehouse;
}



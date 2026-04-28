import type { WarehouseStatus } from "./warehouse";

export interface Coordinate {
  lon: number;
  lat: number;
}

export interface CustomerHouse {
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

export type CustomerHouseEventType =
  | "CUSTOMER_LOCATION.REGISTERED"
  | "CUSTOMER_LOCATION.LOAD_UPDATED"
  | "CUSTOMER_LOCATION.REPRESENTATIVE_UPDATED"
  | "CUSTOMER_LOCATION.UPDATED"
  | "CUSTOMER_LOCATION.DELETED";

export interface CustomerHouseEvent {
  event_id: string;
  timestamp: string;
  ownerEmail?: string;

  eventType: CustomerHouseEventType;
  customerHouse: CustomerHouse;
}



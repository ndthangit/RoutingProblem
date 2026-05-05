export interface PickupPlanRequest {
  depot_id: string;
  vehicle_ids: string[];
  customer_warehouse_ids: string[];
}

export interface DeliveryPlanRequest {
  depot_id: string;
  vehicle_ids: string[];
  delivery_points: {
    id?: string;
    name?: string | null;
    address: string;
    coordinate?: { lon: number; lat: number } | null;
  }[];
  note?: string | null;
}

export interface MovingPlanRequest {
  depot_id: string;
  vehicle_ids: string[];
  brand_warehouse_ids: string[];
  note?: string | null;
}

export type PlanStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface Coordinate {
  lon: number;
  lat: number;
}

export interface PlanPoint {
  id?: string;
  name?: string | null;
  address?: string | null;
  coordinate?: Coordinate | null;
  // tolerate backend extensions
  [key: string]: unknown;
}

// Shape aligned with backend `src/models/plan.py` (serialized with camelCase aliases).
export interface Plan {
  id: string;
  vehicleId: string;
  status: PlanStatus;

  origin: string;
  originCoordinate?: Coordinate | null;

  destination: string;
  destinationCoordinate?: Coordinate | null;

  startTime?: string | null;
  endTime?: string | null;

  points?: PlanPoint[];
  routes?: unknown[];

  note?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // allow other backend fields without breaking compile
  [key: string]: unknown;
}


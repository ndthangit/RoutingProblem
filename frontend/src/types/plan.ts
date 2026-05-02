export interface PickupPlanRequest {
  depot_id: string;
  vehicle_ids: string[];
  customer_warehouse_ids: string[];
}

// Minimal shape for response from POST /v1/pickup-plans (backend returns list[Plan]).
// Extend later if you display plans in UI.
export interface Plan {
  id?: string;
  ownerEmail?: string;
  createdAt?: string;
  updatedAt?: string;
  // allow other backend fields without breaking compile
  [key: string]: unknown;
}


export interface PackageDetails {
  description?: string;
  weightKg?: number;
  declaredValue?: number;
}

export interface Order {
  id: string;

  senderName: string;
  receiverName: string;

  origin: string;
  origin_coordinate?: { lon: number; lat: number } | null;

  destination: string;
  destination_coordinate?: { lon: number; lat: number } | null;

  package: PackageDetails;

  codAmount?: number;
  shippingFee?: number;
  note?: string;

  createdAt?: Date | string;
  vehicleId?: string | null;

  // Route currently transporting this order. Null/undefined when not yet assigned.
  routeId?: string | null;
}

export type OrderEventType =
  | "ORDER.CREATED"
  | "ORDER.PICKED_UP"
  | "ORDER.ARRIVED_AT_HUB"
  | "ORDER.DISPATCHED"
  | "ORDER.OUT_FOR_DELIVERY"
  | "ORDER.DELIVERED"
  | "ORDER.PAYMENT_RECEIVED"
  | "ORDER.FAILED_ATTEMPT"
  | "ORDER.CANCELLED";

export interface OrderEvent {
  event_id: string;
  timestamp: string;
  ownerEmail?: string;
  eventType: OrderEventType;
  order: Order;
}

export type OrderCreatePayload = OrderEvent;


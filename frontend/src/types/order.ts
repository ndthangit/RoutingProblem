import type { Warehouse } from "./warehouse";

export interface PackageDetails {
  description?: string;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  declaredValue?: number;
}

export interface Order {
  id: string;
  trackingNumber?: string;

  origin?: Warehouse;
  destination?: Warehouse;

  senderName?: string;
  receiverName?: string;

  package?: PackageDetails;

  codAmount?: number;
  shippingFee?: number;
  note?: string;

  createdAt?: Date | string;

  // Optional snake_case timestamps if backend returns them
  created_at?: Date | string;
}

export type OrderCreatePayload = Order;


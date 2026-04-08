export interface Route {
  id: string;
  vehicleId: string;

  origin: string;
  origin_coordinate?: { lon: number; lat: number } | null;

  destination: string;
  destination_coordinate?: { lon: number; lat: number } | null;

  startTime?: string | Date | null;
}

export type RouteEventType = "ROUTE.STARTED" | "ROUTE.ENDED";

export interface RouteEvent {
  event_id: string;
  timestamp: string;
  ownerEmail: string;
  eventType: RouteEventType;
  route: Route;
}

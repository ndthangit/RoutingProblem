export interface RoutePoint {
  id?: string;
  name?: string | null;
  address?: string | null;
  coordinate?: { lon: number; lat: number } | null;
}

export type RouteStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface Route {
  id: string;
  vehicleId: string;

  routeType?: RouteType;
  routeStatus?: RouteStatus;

  origin: string | RoutePoint;
  origin_coordinate?: { lon: number; lat: number } | null;

  destination: string | RoutePoint;
  destination_coordinate?: { lon: number; lat: number } | null;

  startTime?: string | Date | null;
  endTime?: string | Date | null;
  createdAt?: string | Date | null;
}

export type RouteType = "TEMPERATURE" | "ONCE_PER_WEEK" | "AD_HOC";

export type RouteEventType =
  | "ROUTE.STARTED"
  | "ROUTE.WAYPOINT_REACHED"
  | "ROUTE.ENDED"
  | "ROUTE.STATUS_CHANGED";

export interface RouteEvent {
  event_id: string;
  timestamp: string;
  ownerEmail: string;
  eventType: RouteEventType;
  route: Route;
}

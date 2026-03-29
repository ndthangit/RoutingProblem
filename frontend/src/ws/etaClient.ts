import { keycloak } from "../config/keycloak";

export type Coordinate = { lon: number; lat: number };

export type RouteRequestMessage = {
  action: "route";
  vehicleId?: string;
  coordinates: Coordinate[];
};

export type EtaUpdate = {
  type: "eta.update";
  vehicleId?: string;
  routeId?: string;
  distanceM: number;
  durationS: number;
  geometry?: unknown;
};

export type EtaSocketCallbacks = {
  onUpdate?: (update: EtaUpdate) => void;
  onError?: (err: unknown) => void;
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
};

function toWsUrl(httpBase: string): string {
  // supports http://host:port or https://...
  if (httpBase.startsWith("https://")) return "wss://" + httpBase.slice("https://".length);
  if (httpBase.startsWith("http://")) return "ws://" + httpBase.slice("http://".length);
  // fallback (already ws?)
  if (httpBase.startsWith("ws://") || httpBase.startsWith("wss://")) return httpBase;
  return "ws://" + httpBase;
}

export async function connectEtaSocket(callbacks: EtaSocketCallbacks = {}) {
  if (!keycloak.authenticated) {
    await keycloak.login({
      redirectUri: window.location.origin + window.location.pathname,
    });
    throw new Error("Not authenticated");
  }

  await keycloak.updateToken(70);

  const httpBase = import.meta.env.VITE_HOST_BACKEND as string;
  const wsBase = toWsUrl(httpBase).replace(/\/$/, "");

  // backend currently excludes /ws/* from middleware; token is for future manual validation
  const token = keycloak.token;
  const url = token ? `${wsBase}/ws/eta?access_token=${encodeURIComponent(token)}` : `${wsBase}/ws/eta`;

  const socket = new WebSocket(url);

  socket.onopen = () => callbacks.onOpen?.();
  socket.onclose = (ev) => callbacks.onClose?.(ev);
  socket.onerror = (ev) => callbacks.onError?.(ev);

  socket.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data?.type === "eta.update") callbacks.onUpdate?.(data as EtaUpdate);
    } catch (e) {
      callbacks.onError?.(e);
    }
  };

  const sendRoute = (msg: RouteRequestMessage) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(msg));
  };

  const close = () => socket.close();

  return { socket, sendRoute, close };
}


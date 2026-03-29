import { keycloak } from "../config/keycloak";

export type VehicleLocation = {
  latitude: number;
  longitude: number;
  timestamp?: string;
};

export type VehicleLocationUpdate = {
  type: "vehicle.location.update";
  vehicleId: string;
  location: VehicleLocation;
};

export type VehicleLocationSubscribeMessage = {
  action: "subscribe";
  vehicleIds?: string[];
};

export type VehicleLocationSocketCallbacks = {
  onUpdate?: (update: VehicleLocationUpdate) => void;
  onError?: (err: unknown) => void;
  onOpen?: () => void;
  onClose?: (ev: CloseEvent) => void;
};

function toWsUrl(httpBase: string): string {
  if (httpBase.startsWith("https://")) return "wss://" + httpBase.slice("https://".length);
  if (httpBase.startsWith("http://")) return "ws://" + httpBase.slice("http://".length);
  if (httpBase.startsWith("ws://") || httpBase.startsWith("wss://")) return httpBase;
  return "ws://" + httpBase;
}

export async function connectVehicleLocationSocket(callbacks: VehicleLocationSocketCallbacks = {}) {
  if (!keycloak.authenticated) {
    await keycloak.login({
      redirectUri: window.location.origin + window.location.pathname,
    });
    throw new Error("Not authenticated");
  }

  await keycloak.updateToken(70);

  const httpBase = import.meta.env.VITE_HOST_BACKEND as string;
  const wsBase = toWsUrl(httpBase).replace(/\/$/, "");

  const token = keycloak.token;
  const url = token
    ? `${wsBase}/ws/vehicles/locations?access_token=${encodeURIComponent(token)}`
    : `${wsBase}/ws/vehicles/locations`;

  const socket = new WebSocket(url);

  socket.onopen = () => callbacks.onOpen?.();
  socket.onclose = (ev) => callbacks.onClose?.(ev);
  socket.onerror = (ev) => callbacks.onError?.(ev);

  socket.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data?.type === "vehicle.location.update") callbacks.onUpdate?.(data as VehicleLocationUpdate);
    } catch (e) {
      callbacks.onError?.(e);
    }
  };

  const subscribe = (msg: VehicleLocationSubscribeMessage) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(msg));
  };

  const close = () => socket.close();

  return { socket, subscribe, close };
}


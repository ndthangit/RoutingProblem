import { useEffect, useMemo, useState } from "react";
import L, { type LatLngBounds, type PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";

import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import { request } from "../api";
import type { BrandWarehouse, CustomerWarehouse } from "../types";

// Fix default marker icon paths for bundlers (Vite)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

type WarehouseMapPoint = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
};

type WarehouseLike = {
  id?: string;
  name?: string | null;
  address?: string | null;
  coordinate?: { lat?: number; lon?: number } | null;
};

const customerWarehousePathOptions: PathOptions = {
  color: "#ffffff",
  fill: true,
  fillColor: "#dc2626",
  fillOpacity: 0.95,
  weight: 2,
};

function toMapPoints(warehouses: WarehouseLike[]): WarehouseMapPoint[] {
  const points: WarehouseMapPoint[] = [];

  for (const warehouse of warehouses) {
    const id = warehouse.id;
    const coordinate = warehouse.coordinate;
    if (typeof id !== "string" || id.length === 0) continue;
    if (!coordinate || typeof coordinate.lat !== "number" || typeof coordinate.lon !== "number") continue;

    points.push({
      id,
      name: warehouse.name || "Warehouse",
      address: warehouse.address || "",
      lat: coordinate.lat,
      lon: coordinate.lon,
    });
  }

  return points;
}

function filterPointsInBounds(points: WarehouseMapPoint[], bounds: LatLngBounds) {
  return points.filter((p) => bounds.contains([p.lat, p.lon]));
}

function debounce<TArgs extends unknown[]>(fn: (...args: TArgs) => void, ms: number) {
  let t: number | undefined;
  return (...args: TArgs) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

function boundsToParams(bounds: LatLngBounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return {
    minLat: sw.lat,
    minLon: sw.lng,
    maxLat: ne.lat,
    maxLon: ne.lng,
  };
}

function MapEvents({ onViewportChange }: { onViewportChange: () => void }) {
  const map = useMap();

  useEffect(() => {
    const handler = () => onViewportChange();
    map.on("moveend", handler);
    map.on("zoomend", handler);
    onViewportChange();
    return () => {
      map.off("moveend", handler);
      map.off("zoomend", handler);
    };
  }, [map, onViewportChange]);

  return null;
}

export default function Geography() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandPoints, setBrandPoints] = useState<WarehouseMapPoint[]>([]);
  const [customerPoints, setCustomerPoints] = useState<WarehouseMapPoint[]>([]);

  const [map, setMap] = useState<L.Map | null>(null);

  const fetchWarehousesInView = useMemo(
    () =>
      debounce(async () => {
        if (!map) return;

        const zoom = map.getZoom();
        const limit = zoom <= 5 ? 1000 : 5000;
        const bounds = map.getBounds();
        const bbox = boundsToParams(bounds);
        const bboxQuery = `minLat=${bbox.minLat}&minLon=${bbox.minLon}&maxLat=${bbox.maxLat}&maxLon=${bbox.maxLon}&limit=${limit}`;

        async function fetchPoints<TWarehouse extends WarehouseLike>(geoUrl: string, fallbackUrl: string) {
          try {
            const res = await request<TWarehouse[]>("GET", geoUrl);
            if (res?.data) return toMapPoints(res.data);
          } catch (e) {
            console.error(e);
          }

          const fallbackRes = await request<TWarehouse[]>("GET", fallbackUrl);
          return filterPointsInBounds(toMapPoints(fallbackRes?.data ?? []), bounds);
        }

        setLoading(true);
        setError(null);

        try {
          const [nextBrandPoints, nextCustomerPoints] = await Promise.all([
            fetchPoints<BrandWarehouse>(
              `/v1/brand-warehouses/geo?${bboxQuery}`,
              `/v1/brand-warehouses?limit=${limit}&offset=0`
            ),
            fetchPoints<CustomerWarehouse>(
              `/v1/customer-warehouses/geo?${bboxQuery}`,
              `/v1/customer-warehouses?limit=${limit}&offset=0`
            ),
          ]);

          setBrandPoints(nextBrandPoints);
          setCustomerPoints(nextCustomerPoints);
        } catch (e) {
          console.error(e);
          setError("Không thể tải dữ liệu warehouse");
        } finally {
          setLoading(false);
        }
      }, 350),
    [map]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Geography</h2>
          <p className="text-slate-600 text-sm">Hiển thị vị trí brand warehouses và customer warehouses trên bản đồ.</p>
        </div>
        <div className="text-sm text-slate-600">
          {loading
            ? "Đang tải..."
            : `${brandPoints.length} brand warehouses / ${customerPoints.length} customer warehouses`}
        </div>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
        <div style={{ height: 600, width: "100%" }}>
          <MapContainer
            center={[16.0471, 108.2068]}
            zoom={6}
            style={{ height: "100%", width: "100%" }}
            preferCanvas
            ref={(instance) => {
              if (instance) setMap(instance);
            }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapEvents onViewportChange={() => fetchWarehousesInView()} />

            <MarkerClusterGroup
              chunkedLoading={true}
              chunkInterval={200}
              chunkDelay={50}
              disableClusteringAtZoom={18}
              maxClusterRadius={60}
              spiderfyOnMaxZoom={true}
              showCoverageOnHover={false}
              zoomToBoundsOnClick={true}
              removeOutsideVisibleBounds={true}
            >
              {brandPoints.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lon]}>
                  <Popup>
                    <div className="min-w-55">
                      <div className="text-xs font-semibold text-slate-500">Brand warehouse</div>
                      <div className="font-semibold mb-1">{p.name}</div>
                      <div className="text-xs text-slate-600">{p.address}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>

            {customerPoints.map((p) => (
              <CircleMarker
                key={`customer-${p.id}`}
                center={[p.lat, p.lon]}
                radius={7}
                pathOptions={customerWarehousePathOptions}
              >
                <Popup>
                  <div className="min-w-55">
                    <div className="text-xs font-semibold text-red-600">Customer warehouse</div>
                    <div className="font-semibold mb-1">{p.name}</div>
                    <div className="text-xs text-slate-600">{p.address}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

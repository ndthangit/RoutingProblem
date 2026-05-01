import { useEffect, useMemo, useState } from "react";
import L, { type LatLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";

import { MapContainer, TileLayer, Popup, useMap, Marker } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

import { request } from "../api";
import type { BrandWarehouse } from "../types";

// Fix default marker icon paths for bundlers (Vite)
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Import CSS cho clustering (BẮT BUỘC với v4.x)
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

// Cấu hình icon cho Leaflet (cách mới cho v4.x)
delete (L.Icon.Default.prototype as any)._getIconUrl;
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
    // initial
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
  const [points, setPoints] = useState<WarehouseMapPoint[]>([]);

  // Keep last map instance (for viewport queries)
  const [map, setMap] = useState<L.Map | null>(null);

  const fetchWarehousesInView = useMemo(
    () =>
      debounce(async () => {
        if (!map) return;

        const zoom = map.getZoom();
        // At very low zoom, fetching everything could be big.
        // For now (only warehouses) we still fetch, but keep a conservative cap.
        const limit = zoom <= 5 ? 1000 : 5000;

        setLoading(true);
        setError(null);

        // Preferred: bbox endpoint (if available)
        const bbox = boundsToParams(map.getBounds());
        const url = `v1/warehouses/geo?minLat=${bbox.minLat}&minLon=${bbox.minLon}&maxLat=${bbox.maxLat}&maxLon=${bbox.maxLon}&limit=${limit}`;

        try {
          const res = await request<BrandWarehouse[]>("GET", url);
          const warehouses = res?.data ?? [];

          const next = warehouses
            .filter((w) => typeof w.id === "string" && w.id.length > 0)
            .filter((w) => w.coordinate && typeof w.coordinate.lat === "number" && typeof w.coordinate.lon === "number")
            .map((w) => ({
              id: w.id as string,
              name: w.name,
              address: w.address,
              lat: w.coordinate!.lat,
              lon: w.coordinate!.lon,
            }));

          setPoints(next);
        } catch (e) {
          console.error(e);
          // Fallback to old list endpoint if bbox endpoint isn't implemented yet
          try {
            const res2 = await request<BrandWarehouse[]>("GET", `/warehouses?limit=${limit}&offset=0`);
            const warehouses = res2?.data ?? [];
            const next = warehouses
              .filter((w) => typeof w.id === "string" && w.id.length > 0)
              .filter((w) => w.coordinate && typeof w.coordinate.lat === "number" && typeof w.coordinate.lon === "number")
              .map((w) => ({
                id: w.id as string,
                name: w.name,
                address: w.address,
                lat: w.coordinate!.lat,
                lon: w.coordinate!.lon,
              }));
            setPoints(next);
          } catch {
            setError("Không thể tải dữ liệu warehouse");
          }
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
          <p className="text-slate-600 text-sm">Hiển thị vị trí warehouses trên bản đồ (tạm thời).</p>
        </div>
        <div className="text-sm text-slate-600">
          {loading ? "Đang tải..." : `${points.length} warehouses`}
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

            {/* Cấu hình cluster tối ưu cho hàng nghìn điểm */}
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
              {points.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lon]}>
                  <Popup>
                    <div className="min-w-55">
                      <div className="font-semibold mb-1">{p.name}</div>
                      <div className="text-xs text-slate-600">{p.address}</div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>
      </div>

      {/*<div className="text-xs text-slate-500">*/}
      {/*  Thiết kế scale: map chỉ tải theo viewport (bbox) + debounce. Khi thêm orders (hàng triệu), backend nên cung cấp server-side clustering hoặc vector tiles.*/}
      {/*</div>*/}
    </div>
  );
}
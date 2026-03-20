import { useEffect, useState } from "react";
import { request } from "../api";

interface Vehicle {
  [key: string]: unknown;
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newVehicleJson, setNewVehicleJson] = useState<string>("{}\n");

  useEffect(() => {
    const controller = new AbortController();

    const fetchVehicles = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await request<Vehicle[]>(
          "GET",
          "/v1/vehicles",
          undefined,
          undefined,
          undefined,
          {},
          controller
        );

        if (res && Array.isArray(res.data)) {
          setVehicles(res.data);
        } else {
          setError("Dữ liệu phương tiện không hợp lệ.");
        }
      } catch (err) {
        setError("Không thể tải danh sách phương tiện.");
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();

    return () => {
      controller.abort();
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-white">Đang tải danh sách phương tiện...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl font-bold mb-4">Danh sách phương tiện</h1>
      <div className="mb-6 p-4 border border-slate-700 rounded-lg bg-slate-900/60">
        <h2 className="text-lg font-semibold mb-2">Thêm phương tiện mới</h2>
        <p className="text-xs text-slate-400 mb-2">
          Nhập dữ liệu JSON theo schema VehicleCreate rồi bấm "Tạo phương tiện".
        </p>
        <textarea
          className="w-full h-32 bg-slate-950 border border-slate-700 rounded-md p-2 text-xs font-mono text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={newVehicleJson}
          onChange={(e) => setNewVehicleJson(e.target.value)}
        />
        {createError && (
          <div className="mt-2 text-xs text-red-400">{createError}</div>
        )}
        <button
          className="mt-3 inline-flex items-center px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 text-sm font-medium"
          disabled={creating}
          onClick={async () => {
            setCreateError(null);

            let payload: unknown;
            try {
              payload = JSON.parse(newVehicleJson);
            } catch {
              setCreateError("JSON không hợp lệ. Vui lòng kiểm tra lại.");
              return;
            }

            setCreating(true);
            try {
              const res = await request<Vehicle>(
                "POST",
                "/v1/vehicles",
                undefined,
                undefined,
                payload as Vehicle,
                {}
              );

              if (res && res.data) {
                setVehicles((prev) => [res.data, ...prev]);
                setNewVehicleJson("{}\n");
              }
            } catch {
              setCreateError("Không thể tạo phương tiện mới.");
            } finally {
              setCreating(false);
            }
          }}
        >
          {creating ? "Đang tạo..." : "Tạo phương tiện"}
        </button>
      </div>
      {vehicles.length === 0 ? (
        <p className="text-slate-400">Chưa có phương tiện nào.</p>
      ) : (
        <div className="overflow-x-auto border border-slate-700 rounded-lg">
          <table className="min-w-full bg-slate-900">
            <thead>
              <tr className="bg-slate-800 text-left text-sm text-slate-300">
                <th className="px-4 py-2 border-b border-slate-700">#</th>
                <th className="px-4 py-2 border-b border-slate-700">Thông tin</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle, index) => (
                <tr key={index} className="border-t border-slate-800 hover:bg-slate-800/60">
                  <td className="px-4 py-2 align-top text-sm text-slate-300">
                    {index + 1}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-200 font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(vehicle, null, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

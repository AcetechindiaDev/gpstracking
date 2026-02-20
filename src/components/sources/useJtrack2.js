// import { useCallback, useEffect, useRef, useState } from "react";
// import axios from "axios";

// export function useJtrack2({ applyMaster }) {
//   const USE_CRA_PROXY = true;
//   const BASE = USE_CRA_PROXY ? "/api/jtrack/api" : "https://jtrack.in/api";
//   const API_KEY = process.env.REACT_APP_JTRACK_API_KEY_2 || "";
//   const URL = `${BASE}/pull_vts_details.php?api_key=${encodeURIComponent(API_KEY)}`;
//   const REFRESH_MS = 3000;

//   const [vehicles, setVehicles] = useState([]);
//   const [error, setError] = useState(null);

//   const inflight = useRef(false);

//   const fetchLive = useCallback(async () => {
//     if (!API_KEY) {
//       setError("JTrack2: Missing REACT_APP_JTRACK_API_KEY_2");
//       setVehicles([]);
//       return;
//     }
//     if (inflight.current) return;
//     inflight.current = true;

//     try {
//       setError(null);
//       const res = await axios.get(URL, { timeout: 15000, headers: { Accept: "application/json" } });
//       const json = res.data;

//       const raw = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

//       const mapped = raw
//         .map((item, idx) => {
//           const latRaw = item.lat_message ?? item.lat ?? item.latitude ?? item.Lat ?? item.Latitude;
//           const lngRaw =
//             item.lon_message ??
//             item.lng ??
//             item.lon ??
//             item.longitude ??
//             item.Lng ??
//             item.Lon ??
//             item.Longitude;

//           const lat = latRaw != null ? parseFloat(latRaw) : null;
//           const lng = lngRaw != null ? parseFloat(lngRaw) : null;
//           if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

//           const baseId = item.vehicle_id || item.vehicle_number || `j2-${idx}`;
//           const base = {
//             id: baseId,
//             trackKey: `j2:${baseId}`,
//             lat,
//             lng,
//             label: item.vehicle_number || String(baseId),
//             regNo: item.vehicle_number || "",
//             vehicleType: item.vehicle_type ?? item.vehicleType ?? "-",
//             fuelCapacity: item.fuel_capacity ?? item.fuelCapacity ?? "-",
//             speed: item.speed ?? "-",
//             ts: item.gps_datetime ?? Date.now(),
//             raw: item,
//           };

//           return applyMaster ? applyMaster(base) : base;
//         })
//         .filter(Boolean);

//       setVehicles(mapped);
//     } catch (err) {
//       setError(String(err?.response?.data?.message || err?.message || "JTrack2 failed"));
//     } finally {
//       inflight.current = false;
//     }
//   }, [API_KEY, URL, applyMaster]);

//   useEffect(() => {
//     fetchLive();
//     const id = setInterval(fetchLive, REFRESH_MS);
//     return () => clearInterval(id);
//   }, [fetchLive]);

//   return { vehicles, error };
// }


import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

export function useJtrack2({ applyMaster }) {
  // ✅ No proxy. Direct base (configurable)
  const BASE = process.env.REACT_APP_JTRACK2_BASE || "https://jtrack.in/api";

  // ✅ Key from .env
  const API_KEY = process.env.REACT_APP_JTRACK_API_KEY_2 || "";

  const URL = `${BASE}/pull_vts_details.php?api_key=${encodeURIComponent(API_KEY)}`;

  // ✅ 3s is aggressive; 7s is safer (configurable)
  const REFRESH_MS = Number(process.env.REACT_APP_JTRACK2_REFRESH_MS || 7000);

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);

  const inflight = useRef(false);

  const fetchLive = useCallback(async () => {
    if (!API_KEY) {
      setError("JTrack2: Missing REACT_APP_JTRACK_API_KEY_2");
      setVehicles([]);
      return;
    }
    if (inflight.current) return;
    inflight.current = true;

    try {
      setError(null);

      // ✅ cache buster to avoid stale responses
      const res = await axios.get(URL, {
        timeout: 20000,
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        params: { _: Date.now() },
      });

      const json = res.data;
      const raw = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

      const mapped = raw
        .map((item, idx) => {
          const latRaw =
            item?.lat_message ??
            item?.latitude ??
            item?.lat ??
            item?.Lat ??
            item?.Latitude;

          const lngRaw =
            item?.lon_message ?? // ✅ important
            item?.lng ??
            item?.lon ??
            item?.longitude ??
            item?.Lng ??
            item?.Lon ??
            item?.Longitude;

          const lat = latRaw != null ? parseFloat(String(latRaw).replace(",", ".")) : null;
          const lng = lngRaw != null ? parseFloat(String(lngRaw).replace(",", ".")) : null;

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          if (lat === 0 && lng === 0) return null;

          const reg = String(item?.vehicle_number || "").trim();
          const baseId = reg || String(item?.vehicle_id || `j2-${idx}`);

          // ✅ Align with your project logic
          const base = {
            source: "jtrack2",
            id: baseId,
            trackKey: baseId, // ✅ keep simple; your getVehicleKey() picks this
            regNo: reg,
            label: reg || baseId,

            lat,
            lng,

            vehicleType: item?.vehicle_type ?? item?.vehicleType ?? "-",
            fuelCapacity: item?.fuel_capacity ?? item?.fuelCapacity ?? "-",
            speed: item?.speed ?? "-",

            gps_datetime: item?.gps_datetime,
            ts: item?.gps_datetime ?? Date.now(),

            raw: item,
          };

          return applyMaster ? applyMaster(base) : base;
        })
        .filter(Boolean);

      setVehicles(mapped);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || "JTrack2 failed";
      setError(status ? `JTrack2 ${status}: ${String(msg)}` : String(msg));
    } finally {
      inflight.current = false;
    }
  }, [API_KEY, URL, applyMaster]);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchLive, REFRESH_MS]);

  return { vehicles, error };
}




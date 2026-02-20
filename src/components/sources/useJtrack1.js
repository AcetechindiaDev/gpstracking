// import { useCallback, useEffect, useRef, useState } from "react";
// import axios from "axios";

// export function useJtrack1({ applyMaster }) {
//   const BASE = "https://jtrack.in/api";
//   const API_KEY = process.env.REACT_APP_JTRACK_API_KEY_1 || ""; // put key in .env
//   const URL = `${BASE}/pull_vts_details.php?api_key=${encodeURIComponent(API_KEY)}`;
//   const REFRESH_MS = 3000;

//   const [vehicles, setVehicles] = useState([]);
//   const [error, setError] = useState(null);

//   const inflight = useRef(false);

//   const fetchLive = useCallback(async () => {
//     if (!API_KEY) {
//       setError("JTrack1: Missing REACT_APP_JTRACK_API_KEY_1");
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

//           const baseId = item.vehicle_id || item.vehicle_number || `j1-${idx}`;
//           const base = {
//             id: baseId,
//             trackKey: `j1:${baseId}`,
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
//       setError(String(err?.response?.data?.message || err?.message || "JTrack1 failed"));
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

export function useJtrack1({ applyMaster }) {
  // ✅ Direct URL (no proxy). Make base configurable via .env
  const BASE = process.env.REACT_APP_JTRACK1_BASE || "https://jtrack.in/api";

  // ✅ API key from .env
  const API_KEY = process.env.REACT_APP_JTRACK_API_KEY_1 || "";

  // ✅ add cache-buster so browsers/CDN don't return old data
  const URL = `${BASE}/pull_vts_details.php?api_key=${encodeURIComponent(API_KEY)}`;

  // ✅ 3s is aggressive and can cause overlaps / rate limits; 7s is safer
  const REFRESH_MS = Number(process.env.REACT_APP_JTRACK1_REFRESH_MS || 7000);

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);

  const inflight = useRef(false);

  const fetchLive = useCallback(async () => {
    if (!API_KEY) {
      setError("JTrack1: Missing REACT_APP_JTRACK_API_KEY_1");
      setVehicles([]);
      return;
    }
    if (inflight.current) return;
    inflight.current = true;

    try {
      setError(null);

      // ✅ cache buster
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

      // JTrack sometimes returns {data:[...]} or [...]
      const raw = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

      const mapped = raw
        .map((item, idx) => {
          // ✅ latitude keys (your main file already supports lon_message too)
          const latRaw =
            item?.lat_message ??
            item?.latitude ??
            item?.lat ??
            item?.Lat ??
            item?.Latitude;

          const lngRaw =
            item?.lon_message ?? // ✅ IMPORTANT
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

          // ✅ prefer reg no as id, else vehicle_id
          const reg = String(item?.vehicle_number || "").trim();
          const baseId = reg || String(item?.vehicle_id || `j1-${idx}`);

          // ✅ IMPORTANT: align with your project expectations
          const base = {
            source: "jtrack1",                 // ✅ so getSource() works even if missing
            id: baseId,
            trackKey: baseId,                  // ✅ NOT "j1:..." because your map uses getVehicleKey()
            regNo: reg,
            label: reg || baseId,

            lat,
            lng,

            vehicleType: item?.vehicle_type ?? item?.vehicleType ?? "-",
            fuelCapacity: item?.fuel_capacity ?? item?.fuelCapacity ?? "-",
            speed: item?.speed ?? "-",

            // ✅ time field
            gps_datetime: item?.gps_datetime,  // keep original
            ts: item?.gps_datetime ?? Date.now(),

            raw: item,
          };

          return applyMaster ? applyMaster(base) : base;
        })
        .filter(Boolean);

      setVehicles(mapped);
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || "JTrack1 failed";
      setError(status ? `JTrack1 ${status}: ${String(msg)}` : String(msg));
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


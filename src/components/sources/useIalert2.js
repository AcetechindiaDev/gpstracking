import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { normalizeReg } from "../utils";

export function useIalert2({ applyMaster }) {
  const USE_CRA_PROXY = true;
  const BASE = USE_CRA_PROXY
    ? "/api/ialert/ialert/daas/api"
    : "https://ialertelite.ashokleyland.com/ialert/daas/api";

  const TOKEN = process.env.REACT_APP_IALERT2_TOKEN || "";
  const URL = `${BASE}/getdata?token=${encodeURIComponent(TOKEN)}`;
  const REFRESH_MS = 7000;

  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState(null);

  const inflight = useRef(false);

  const fetchLive = useCallback(async () => {
    if (!TOKEN) {
      setError("iALERT2: Missing REACT_APP_IALERT2_TOKEN");
      setVehicles([]);
      return;
    }
    if (inflight.current) return;
    inflight.current = true;

    try {
      setError(null);

      const res = await axios.get(URL, { headers: { Accept: "application/json" }, timeout: 20000 });
      const json = res.data;

      let rows = [];
      if (Array.isArray(json)) rows = json;
      else if (Array.isArray(json?.data)) rows = json.data;

      const mapped = (rows || [])
        .map((r, idx) => {
          const lat = r?.latitude != null ? parseFloat(r.latitude) : null;
          const lng = r?.longitude != null ? parseFloat(r.longitude) : null;
          if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

          const reg = r?.vehicleregnumber || "";
          const base = {
            id: reg || `ialert2-${idx}`,
            trackKey: `ialert2:${reg || idx}`,
            regNo: reg,
            label: normalizeReg(reg || `IALERT2-${idx}`),
            lat,
            lng,
            speed: r?.speed ?? "-",
            ignition: r?.ignition,
            heading: r?.heading,
            odometer: r?.odometer,
            batlevel: r?.batlevel,
            altitude: r?.altitude,
            ts: r?.datetime ?? Date.now(),
            raw: r,
          };

          return applyMaster ? applyMaster(base) : base;
        })
        .filter(Boolean);

      setVehicles(mapped);
    } catch (err) {
      setError(String(err?.response?.data?.message || err?.message || "iALERT2 failed"));
    } finally {
      inflight.current = false;
    }
  }, [TOKEN, URL, applyMaster]);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchLive]);

  return { vehicles, error };
}


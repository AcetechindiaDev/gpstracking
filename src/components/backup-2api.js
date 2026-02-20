import React, { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, LoadScript, Marker, InfoWindow, Polyline } from "@react-google-maps/api";


import axios from "axios";

const containerStyle = { width: "100%", height: "400px" };
const defaultCenter = { lat: 13.0827, lng: 80.2707 }; // Chennai

const GOOGLE_MAPS_API_KEY = "AIzaSyDLdx6a4kC7pWaM5axn5h9jjRMbxmBDLOw";

// ✅ JTRACK via CRA proxy
const JTRACK_URL =
  "/api/jtrack/api/pull_vts_details.php?api_key=f3fa2cb4cfa4f7a1e7f1b1b9157978aa";

// ✅ VECV via CRA proxy
const VECV_TOKEN_URL = "/api/vecv/service-gateway/secure/genrateToken"; // GET
const VECV_LIVE_URL = "/api/vecv/live-location-service/vehicle/v1/getlivedata/location"; // POST

// ✅ Hardcode API key (as you requested)
const VECV_API_KEY = "6c441a37-fe94-4fcb-a07f-beb4b637bf3a";

// ✅ ClientId (put FULL value here)
const VECV_CLIENT_ID = "08a1f851-5ece-42"; // <-- replace with full clientId

// refresh
const JTRACK_REFRESH_MS = 5000;
const VECV_REFRESH_MS = 60000; // 60s to avoid 429

// token cache (avoid calling genrateToken repeatedly)
let vecvTokenPromise = null;
const TOKEN_STORAGE_KEY = "vecv_token_cache_v1";

const loadToken = () => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};
const saveToken = (t) => {
  try {
    if (!t) localStorage.removeItem(TOKEN_STORAGE_KEY);
    else localStorage.setItem(TOKEN_STORAGE_KEY, t);
  } catch {}
};

export default function GoogleMapComponent() {
  // JTrack
  const [jVehicles, setJVehicles] = useState([]);
  const [tracks, setTracks] = useState({});

  // VECV
  const [vVehicles, setVVehicles] = useState([]);
  const [vLoading, setVLoading] = useState(false);
  const [vError, setVError] = useState(null);
  const [vRaw, setVRaw] = useState(null);

  // UI
  const [center, setCenter] = useState(defaultCenter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const mapRef = useRef(null);
  const hasFitBoundsRef = useRef(false);
  const [hovered, setHovered] = useState(null); // {source, data}

  const jInFlightRef = useRef(false);
  const vInFlightRef = useRef(false);

  const vecvTokenRef = useRef(loadToken());
  const vecvCooldownUntilRef = useRef(0);

  // ✅ Prevent CRA StrictMode (dev) double-call
  const didInitRef = useRef(false);

  // ----------------------------
  // ✅ VECV token (GET)
  // ----------------------------
  const getVecvToken = useCallback(async () => {
    if (!VECV_API_KEY) throw new Error("VECV_API_KEY missing.");

    if (vecvTokenRef.current) return vecvTokenRef.current;
    if (vecvTokenPromise) return vecvTokenPromise;

    vecvTokenPromise = (async () => {
      const res = await axios.get(VECV_TOKEN_URL, {
        headers: {
          Accept: "application/json",
          "API-KEY": VECV_API_KEY,
        },
        timeout: 15000,
      });

      const token = res?.data?.token;
      if (!token) throw new Error("Token not found (response.token missing)");

      vecvTokenRef.current = token;
      saveToken(token);
      return token;
    })();

    try {
      return await vecvTokenPromise;
    } finally {
      vecvTokenPromise = null;
    }
  }, []);

  // ----------------------------
  // ✅ VECV live (POST) using clientId
  // ----------------------------
  const fetchVecvLive = useCallback(async () => {
    if (Date.now() < vecvCooldownUntilRef.current) return;
    if (vInFlightRef.current) return;
    vInFlightRef.current = true;

    try {
      setVError(null);
      setVLoading(true);

      if (!VECV_CLIENT_ID || VECV_CLIENT_ID.length < 10) {
        throw new Error("ClientId looks incomplete. Paste the FULL clientId from VECV.");
      }

      let token = await getVecvToken();

      const body = {
        clientId: VECV_CLIENT_ID,
      };

      const callLive = async (tkn) =>
        axios.post(VECV_LIVE_URL, body, {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "API-KEY": VECV_API_KEY,
            Authorization: `Bearer ${tkn}`,
          },
          timeout: 20000,
        });

      try {
        const res = await callLive(token);
        const json = res.data;
        setVRaw(json);

        // Expected: { locationData: [...] }
        const rows = Array.isArray(json?.locationData) ? json.locationData : [];

        const mapped = rows
          .map((r, idx) => {
            const lat = r?.latitude != null ? parseFloat(r.latitude) : null;
            const lng = r?.longitude != null ? parseFloat(r.longitude) : null;

            if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

            return {
              id: r?.regNo || r?.chassisNo || `vecv-${idx}`,
              regNo: r?.regNo,
              chassisNo: r?.chassisNo,
              lat,
              lng,
              vehicleStatus: r?.vehicleStatus,
              lastUpdated: r?.lastUpdated,
              vehicleSpeed: r?.vehicleSpeed,
              odometer: r?.odometer,
              vehicleDirection: r?.vehicleDirection,
            };
          })
          .filter(Boolean);

        setVVehicles(mapped);

        if (mapped.length > 0 && !hasFitBoundsRef.current) {
          setCenter({ lat: mapped[0].lat, lng: mapped[0].lng });
        }
      } catch (err) {
        const status = err?.response?.status;

        // token expired -> refresh once
        if (status === 401) {
          vecvTokenRef.current = "";
          saveToken("");

          token = await getVecvToken();
          const res2 = await callLive(token);

          const json2 = res2.data;
          setVRaw(json2);

          const rows2 = Array.isArray(json2?.locationData) ? json2.locationData : [];
          const mapped2 = rows2
            .map((r, idx) => {
              const lat = r?.latitude != null ? parseFloat(r.latitude) : null;
              const lng = r?.longitude != null ? parseFloat(r.longitude) : null;
              if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

              return {
                id: r?.regNo || r?.chassisNo || `vecv-${idx}`,
                regNo: r?.regNo,
                chassisNo: r?.chassisNo,
                lat,
                lng,
                vehicleStatus: r?.vehicleStatus,
                lastUpdated: r?.lastUpdated,
                vehicleSpeed: r?.vehicleSpeed,
              };
            })
            .filter(Boolean);

          setVVehicles(mapped2);
          return;
        }

        // rate limit
        if (status === 429) {
          const ra = err?.response?.headers?.["retry-after"];
          const retrySeconds = Number(ra || "60");
          vecvCooldownUntilRef.current = Date.now() + retrySeconds * 1000;
          setVError(`429 Too Many Requests. Retry after ${retrySeconds}s`);
          return;
        }

        const msg =
          err?.response?.data?.message ||
          err?.response?.data ||
          err.message ||
          "VECV live API failed";
        setVError(String(msg));
      }
    } catch (e) {
      setVError(String(e.message || e));
    } finally {
      setVLoading(false);
      vInFlightRef.current = false;
    }
  }, [getVecvToken]);

  // ----------------------------
  // ✅ JTrack fetch
  // ----------------------------
  const fetchJtrackLive = useCallback(async () => {
    if (jInFlightRef.current) return;
    jInFlightRef.current = true;

    try {
      setError(null);
      setLoading(true);

      const res = await axios.get(JTRACK_URL, {
        headers: { Accept: "application/json" },
        timeout: 15000,
      });

      const json = res.data;

      let rawVehicles = [];
      if (Array.isArray(json?.data)) rawVehicles = json.data;
      else if (Array.isArray(json)) rawVehicles = json;

      const mapped = (rawVehicles || [])
        .map((item, idx) => {
          const latRaw =
            item.lat_message ?? item.lat ?? item.latitude ?? item.Lat ?? item.Latitude;
          const lngRaw =
            item.lon_message ?? item.lng ?? item.lon ?? item.longitude ?? item.Lng ?? item.Lon ?? item.Longitude;

          const lat = latRaw != null ? parseFloat(latRaw) : null;
          const lng = lngRaw != null ? parseFloat(lngRaw) : null;

          if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

          return {
            id: item.vehicle_id || item.vehicle_number || `j-${idx}`,
            lat,
            lng,
            label: item.vehicle_number || "",
            vehicle_number: item.vehicle_number,
            branch_name: item.branch_name,
            model_name: (item.model_name || "").replace(/\s+/g, " ").trim(),
            gps_datetime: item.gps_datetime,
            speed: item.speed,
          };
        })
        .filter(Boolean);

      setJVehicles(mapped);

      setTracks((prev) => {
        const next = { ...prev };
        mapped.forEach((v) => {
          const existing = next[v.id] ? [...next[v.id]] : [];
          const last = existing[existing.length - 1];

          const same =
            last &&
            last.lat === v.lat &&
            last.lng === v.lng &&
            last.gps_datetime === v.gps_datetime;

          if (!same) {
            existing.push({ lat: v.lat, lng: v.lng, gps_datetime: v.gps_datetime });
            if (existing.length > 100) existing.shift();
          }
          next[v.id] = existing;
        });
        return next;
      });

      if (mapped.length > 0 && !hasFitBoundsRef.current) {
        setCenter({ lat: mapped[0].lat, lng: mapped[0].lng });
      }
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data ||
        err.message ||
        "JTrack API failed";
      setError(String(msg));
    } finally {
      setLoading(false);
      jInFlightRef.current = false;
    }
  }, []);

  // Polling
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    fetchVecvLive();
    fetchJtrackLive();

    const jId = setInterval(fetchJtrackLive, JTRACK_REFRESH_MS);
    const vId = setInterval(fetchVecvLive, VECV_REFRESH_MS);

    return () => {
      clearInterval(jId);
      clearInterval(vId);
    };
  }, [fetchVecvLive, fetchJtrackLive]);

  // Fit bounds once using both sources
  useEffect(() => {
    const map = mapRef.current;
    const all = [...jVehicles, ...vVehicles];
    if (!map || all.length === 0) return;
    if (hasFitBoundsRef.current) return;

    const bounds = new window.google.maps.LatLngBounds();
    all.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds);
    hasFitBoundsRef.current = true;
  }, [jVehicles, vVehicles]);

  const hoveredTrack =
    hovered?.source === "jtrack" && tracks[hovered.data.id]
      ? tracks[hovered.data.id].map((p) => ({ lat: p.lat, lng: p.lng }))
      : [];

  const hasHistory =
    hovered?.source === "jtrack" &&
    tracks[hovered.data.id] &&
    tracks[hovered.data.id].length > 1;

  return (
    <div style={{ position: "relative" }}>
      {/* VECV status */}
      {/* <div style={{ marginBottom: 8, padding: 8, border: "1px solid #ddd", borderRadius: 6, fontSize: 12, background: "#fafafa" }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          VECV Vehicles Loaded: {vVehicles.length}
        </div>
        {vLoading ? <div>Loading VECV…</div> : null}
        {vError ? <div style={{ color: "#b71c1c" }}>VECV Error: {vError}</div> : null}

        {vRaw ? (
          <details style={{ marginTop: 6 }}>
            <summary style={{ cursor: "pointer" }}>Show VECV raw response</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(vRaw, null, 2)}</pre>
          </details>
        ) : null}
      </div> */}

      <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={12}
          onLoad={(map) => (mapRef.current = map)}
          onUnmount={() => (mapRef.current = null)}
        >
          {/* JTrack markers */}
          {jVehicles.map((v) => (
            <Marker
              key={`j-${v.id}`}
              position={{ lat: v.lat, lng: v.lng }}
              label={v.label ? { text: v.label, fontSize: "10px" } : undefined}
              onMouseOver={() => setHovered({ source: "jtrack", data: v })}
              onClick={() => setHovered({ source: "jtrack", data: v })}
            />
          ))}

          {/* VECV markers */}
          {vVehicles.map((v) => (
            <Marker
              key={`v-${v.id}`}
              position={{ lat: v.lat, lng: v.lng }}
              label={v.regNo ? { text: v.regNo, fontSize: "10px" } : undefined}
              onMouseOver={() => setHovered({ source: "vecv", data: v })}
              onClick={() => setHovered({ source: "vecv", data: v })}
            />
          ))}

          {/* JTrack history polyline */}
          {hovered && hovered.source === "jtrack" && hasHistory && (
            <Polyline
              path={hoveredTrack}
              options={{ strokeColor: "#FF0000", strokeOpacity: 0.9, strokeWeight: 3 }}
            />
          )}

          {/* InfoWindow */}
          {hovered && (
            <InfoWindow
              position={{ lat: hovered.data.lat, lng: hovered.data.lng }}
              onCloseClick={() => setHovered(null)}
            >
              <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {hovered.source === "vecv"
                    ? (hovered.data.regNo || hovered.data.id)
                    : (hovered.data.vehicle_number || hovered.data.id)}
                </div>

                {hovered.source === "vecv" ? (
                  <>
                    <div><strong>Status:</strong> {hovered.data.vehicleStatus || "-"}</div>
                    <div><strong>Speed:</strong> {hovered.data.vehicleSpeed ?? "-"}</div>
                    <div><strong>Last Updated:</strong> {hovered.data.lastUpdated ?? "-"}</div>
                  </>
                ) : (
                  <>
                    <div><strong>Branch:</strong> {hovered.data.branch_name || "-"}</div>
                    <div><strong>Speed:</strong> {hovered.data.speed ?? "-"}</div>
                    <div><strong>Last GPS:</strong> {hovered.data.gps_datetime || "-"}</div>
                  </>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </LoadScript>

      {loading && (
        <div style={{ position: "absolute", top: 8, left: 8, padding: "4px 8px", background: "white", borderRadius: 4, boxShadow: "0 0 4px rgba(0,0,0,0.2)", fontSize: 12 }}>
          Loading JTrack…
        </div>
      )}

      {error && (
        <div style={{ position: "absolute", bottom: 8, left: 8, padding: "4px 8px", background: "#ffebee", color: "#b71c1c", borderRadius: 4, boxShadow: "0 0 4px rgba(0,0,0,0.2)", fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  );
}

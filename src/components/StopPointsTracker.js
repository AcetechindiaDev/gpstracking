/* =========================================================
   StopPointsTracker.js  (Single file)

   ✅ Clean + Working version (NO duplicate stores)

   Features:
   - Detect stop points from live GPS samples (per vehicle)
   - Store stop points in tracker.store (per vehicle)
   - TA count increases when a stop is added/merged
   - Draw stop markers + polyline connecting stops on Google Map
   - Safe datetime parsing (handles "YYYY-MM-DD HH:mm:ss.0")
   - Optional ignition-based stop rule

   Works with: mapRef.current from @react-google-maps/api
========================================================= */

/* ======================
   INTERNAL HELPERS
====================== */

function safeTimeMs(t) {
  if (t == null) return Date.now();
  if (typeof t === "number") return t;

  const s = String(t).trim();
  // Support "YYYY-MM-DD HH:mm:ss.S" => "YYYY-MM-DDTHH:mm:ss.S"
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const ms = Date.parse(iso);

  return Number.isFinite(ms) ? ms : Date.now();
}

function parseSpeed(s) {
  if (s == null) return null;
  const n =
    typeof s === "number" ? s : parseFloat(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseIgnition(v) {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function fmtMin(ms) {
  const m = ms / 60000;
  return Number.isFinite(m) ? m.toFixed(1) : "0.0";
}

/* ======================
   FACTORY
====================== */

export function createStopTracker(customDefaults = {}) {
  return {
    // key => { points: StopPoint[], cluster: Cluster|null, ta:number }
    store: new Map(),

    // key => { markers: google.maps.Marker[], polyline: google.maps.Polyline|null }
    overlays: new Map(),

    defaults: {
      stopRadiusMeters: 25, // within this radius -> same stop cluster
      minStopMs: 60 * 1000, // stop qualifies if duration >= this (unless speed/ign stop)
      speedStopKmph: 0.5, // <= this speed means stopped
      useIgnitionStop: true, // ignition==0 also treated as stop
      mergeRadiusMeters: 40, // merge consecutive stops if within this distance
      maxStops: 200, // cap stored stop points
      strokeColor: "#111",
      strokeWeight: 2,
      ...customDefaults,
    },
  };
}

/* ======================
   CORE: UPSERT STOP SAMPLE
   returns true ONLY when a NEW stop is added/merged
====================== */

/**
 * sample shape expected:
 * { lat, lng, t, speed, ignition? }
 */
export function upsertStopSample(tracker, vehicleKey, sample, opts = {}) {
  if (!tracker || !tracker.store) throw new Error("StopTracker not initialized.");

  const cfg = { ...tracker.defaults, ...opts };

  const p = {
    lat: Number(sample.lat),
    lng: Number(sample.lng),
    t: safeTimeMs(sample.t),
    speed: parseSpeed(sample.speed),
    ignition: parseIgnition(sample.ignition),
  };

  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !Number.isFinite(p.t)) {
    return false;
  }

  const entry =
    tracker.store.get(vehicleKey) || { points: [], cluster: null, ta: 0 };

  const isSpeedStop = p.speed != null && p.speed <= cfg.speedStopKmph;
  const isIgnStop =
    cfg.useIgnitionStop && p.ignition != null && Number(p.ignition) === 0;

  const isStopish = isSpeedStop || isIgnStop;

  // init cluster
  if (!entry.cluster) {
    entry.cluster = {
      latSum: p.lat,
      lngSum: p.lng,
      count: 1,
      startT: p.t,
      endT: p.t,
      hadStopSignal: !!isStopish,
    };
    tracker.store.set(vehicleKey, entry);
    return false;
  }

  const c = entry.cluster;
  const center = { lat: c.latSum / c.count, lng: c.lngSum / c.count };
  const dist = haversineMeters(center, p);

  // ✅ extend cluster only if within stop radius
  // (also allow small drift when stop signal exists)
  const allowDist = isStopish ? cfg.mergeRadiusMeters : cfg.stopRadiusMeters;

  if (dist <= allowDist) {
    c.latSum += p.lat;
    c.lngSum += p.lng;
    c.count += 1;
    c.endT = p.t;
    if (isStopish) c.hadStopSignal = true;
    tracker.store.set(vehicleKey, entry);
    return false;
  }

  // cluster ended -> decide if it was a stop
  const durationMs = c.endT - c.startT;
  const qualifies = c.hadStopSignal || durationMs >= cfg.minStopMs;
  let changed = false;

  if (qualifies) {
    const stop = {
      lat: c.latSum / c.count,
      lng: c.lngSum / c.count,
      startT: c.startT,
      endT: c.endT,
      durationMs,
      count: c.count,
    };

    const last = entry.points[entry.points.length - 1];
    if (last && haversineMeters(last, stop) <= cfg.mergeRadiusMeters) {
      // merge into last stop
      const w1 = last.count || 1;
      const w2 = stop.count || 1;
      last.lat = (last.lat * w1 + stop.lat * w2) / (w1 + w2);
      last.lng = (last.lng * w1 + stop.lng * w2) / (w1 + w2);
      last.startT = Math.min(last.startT, stop.startT);
      last.endT = Math.max(last.endT, stop.endT);
      last.durationMs = last.endT - last.startT;
      last.count = w1 + w2;
      changed = true;
    } else {
      entry.points.push(stop);
      if (entry.points.length > cfg.maxStops) {
        entry.points.splice(0, entry.points.length - cfg.maxStops);
      }
      changed = true;
    }

    // ✅ TA count increases when stop added/merged
    entry.ta = (entry.ta || 0) + 1;
  }

  // start new cluster with current point
  entry.cluster = {
    latSum: p.lat,
    lngSum: p.lng,
    count: 1,
    startT: p.t,
    endT: p.t,
    hadStopSignal: !!isStopish,
  };

  tracker.store.set(vehicleKey, entry);
  return changed;
}

/* ======================
   GET STORED STOPS
====================== */

export function getVehicleStops(tracker, vehicleKey) {
  const entry = tracker?.store?.get(vehicleKey);
  return entry?.points ? [...entry.points] : [];
}

export function getStopSummary(tracker) {
  if (!tracker || !tracker.store) return [];
  return Array.from(tracker.store.entries()).map(([vehicle, entry]) => ({
    vehicle,
    ta: entry.ta ?? (entry.points ? entry.points.length : 0),
    stops: entry.points ? [...entry.points] : [],
  }));
}

/* ======================
   DRAW: stop markers + stop polyline
====================== */

export function drawVehicleStops(map, tracker, vehicleKey, opts = {}) {
  if (!map || !window.google?.maps) return { markers: [], polyline: null };

  const cfg = { ...tracker.defaults, ...opts };
  const stopPoints = getVehicleStops(tracker, vehicleKey);

  // clear old overlays
  clearVehicleStops(map, tracker, vehicleKey);

  // create markers
  const markers = stopPoints.map((s, idx) => {
    const isLast = idx === stopPoints.length - 1;
    return new window.google.maps.Marker({
      map,
      position: { lat: s.lat, lng: s.lng },
      label: { text: `S${idx + 1}`, fontSize: "11px", fontWeight: "700" },
      title: `Stop ${idx + 1} | ${fmtMin(s.durationMs)} min`,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: isLast ? 6 : 4,
        fillColor: isLast ? "#D32F2F" : "#00897B",
        fillOpacity: 0.9,
        strokeColor: "#ffffff",
        strokeWeight: 1,
      },
      zIndex: 90,
    });
  });

  // polyline between stops
  const path = stopPoints.map((s) => ({ lat: s.lat, lng: s.lng }));
  const polyline =
    path.length >= 2
      ? new window.google.maps.Polyline({
          map,
          path,
          geodesic: true,
          strokeColor: cfg.strokeColor,
          strokeOpacity: 0.9,
          strokeWeight: cfg.strokeWeight,
          zIndex: 80,
        })
      : null;

  tracker.overlays.set(vehicleKey, { markers, polyline });
  return { markers, polyline };
}

/* ======================
   CLEAR overlays for one vehicle
====================== */

export function clearVehicleStops(map, tracker, vehicleKey) {
  const existing = tracker?.overlays?.get(vehicleKey);
  if (!existing) return;

  if (existing.markers) existing.markers.forEach((m) => m.setMap(null));
  if (existing.polyline) existing.polyline.setMap(null);

  tracker.overlays.delete(vehicleKey);
}

/* ======================
   CLEAR everything (data + overlays)
====================== */

export function clearAllStops(map, tracker) {
  if (!tracker) return;

  for (const key of tracker.overlays.keys()) {
    clearVehicleStops(map, tracker, key);
  }

  tracker.store.clear();
}

/* =========================================================
   ✅ MAIN INTEGRATION HELPER (use this in your live polling)

   rows expected like your API:
   {
     vehicleregnumber, latitude, longitude, datetime, speed, ignition
   }

   - Updates tracker stops
   - Redraws ONLY when stop list changes (efficient)
   - Returns summary (vehicle, ta, stops)
========================================================= */

export function processLiveRowsForStops(map, tracker, rows, opts = {}) {
  if (!tracker) throw new Error("tracker required");

  (rows || []).forEach((r) => {
    const key = (r.vehicleregnumber || r.vehicle_number || "").trim();
    if (!key) return;

    const changed = upsertStopSample(
      tracker,
      key,
      {
        lat: r.latitude ?? r.lat ?? r.lat_message,
        lng: r.longitude ?? r.lng ?? r.lon_message,
        t: r.datetime ?? r.gps_datetime ?? r.time,
        speed: r.speed,
        ignition: r.ignition,
      },
      opts
    );

    // redraw only when a stop was added/merged
    if (changed && map) {
      drawVehicleStops(map, tracker, key, opts);
    }
  });

  return getStopSummary(tracker);
}

/* =========================================================
   Example usage (React):

   const stopTrackerRef = useRef(createStopTracker());

   // inside your live API handler:
   const summary = processLiveRowsForStops(
     mapRef.current,
     stopTrackerRef.current,
     rows,
     { minStopMs: 60_000, stopRadiusMeters: 25 }
   );

   // summary => [{vehicle, ta, stops:[...]}]
========================================================= */

/* =========================================================
   ✅ POLYLINE PATH BUILDERS (for vehicle movement tracking)

   - Convert API rows into lat/lng point arrays (per vehicle)
   - Build polyline paths for Google Maps rendering
========================================================= */

/**
 * ✅ Convert one API row into a {lat,lng,t,veh} point
 */
export function toPoint(row) {
  const lat = Number(row?.latitude ?? row?.lat ?? row?.lat_message);
  const lng = Number(
    row?.longitude ?? row?.lng ?? row?.lon ?? row?.lon_message ?? row?.Longitude
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    t: safeTimeMs(row?.datetime ?? row?.gps_datetime ?? row?.time ?? Date.now()),
    veh: String(row?.vehicleregnumber ?? row?.vehicle_number ?? row?.regNo ?? ""),
  };
}

/**
 * ✅ Store lat/lng as array + increment on every call
 * history shape:
 * {
 *   "TN04BF8955": [{lat,lng,t,veh}, ...],
 *   "TN04BF8984": [{lat,lng,t,veh}, ...]
 * }
 */
export function appendPolylinePoints(history, apiRows, opts = {}) {
  const maxPointsPerVehicle = opts.maxPointsPerVehicle ?? 2000;
  const next = { ...history };

  for (const row of apiRows || []) {
    const p = toPoint(row);
    if (!p || !p.veh) continue;

    const arr = next[p.veh] ? [...next[p.veh]] : [];

    // avoid duplicate consecutive points (same lat/lng)
    const last = arr[arr.length - 1];
    if (last && last.lat === p.lat && last.lng === p.lng) continue;

    arr.push(p);

    // keep time order (safe if API order changes)
    arr.sort((a, b) => a.t - b.t);

    // cap memory
    if (arr.length > maxPointsPerVehicle) {
      arr.splice(0, arr.length - maxPointsPerVehicle);
    }

    next[p.veh] = arr;
  }

  return next;
}

/**
 * ✅ Build Polyline paths for Google Maps
 * Returns array:
 * [{ veh: "TN04...", path: [{lat,lng}, ...] }, ...]
 */
export function buildPolylinePaths(historyByVehicle) {
  return Object.entries(historyByVehicle || {})
    .map(([veh, points]) => ({
      veh,
      path: (points || []).map((p) => ({ lat: p.lat, lng: p.lng })),
    }))
    .filter((x) => x.path.length >= 2);
}


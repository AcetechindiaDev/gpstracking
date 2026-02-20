export const SOURCE_META = {
  jtrack1: { name: "JTrack (API-1)", color: "#D32F2F" },
  jtrack2: { name: "JTrack (API-2)", color: "#FB8C00" },
  batch: { name: "Batchmaster", color: "#2E7D32" },
  vecv: { name: "VECV", color: "#1565C0" },
  gpstrack: { name: "GPS Track", color: "#6A1B9A" },
  ialert2: { name: "iAlert2", color: "#00838F" },
  fleetx: { name: "FleetX", color: "#5E35B1" },
//   health: { name: "Health Vehicles", color: "#00C853" },
};

export const normalizeReg = (x) => (x ?? "").toString().trim().toUpperCase();

export function haversineMeters(a, b) {
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

// export function getLatLng(row) {
//   const latRaw =
//     row?.latitude ?? row?.lat ?? row?.Lat ?? row?.Latitude ?? row?.LATITUDE ?? row?.lat_message;
//   const lngRaw =
//     row?.longitude ??
//     row?.lng ??
//     row?.lon ??
//     row?.Lng ??
//     row?.Longitude ??
//     row?.LONGITUDE ??
//     row?.lon_message;

//   const lat = latRaw != null ? parseFloat(latRaw) : null;
//   const lng = lngRaw != null ? parseFloat(lngRaw) : null;
//   if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
//   return { lat, lng };
// }

export function getLatLng(row) {
  if (!row) return null;

  const toNum = (v) => {
    if (v == null) return null;
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const pickLat = (o) =>
    o?.latitude ??
    o?.lat ??
    o?.Lat ??
    o?.Latitude ??
    o?.LATITUDE ??
    o?.lat_message ??
    o?.gpsLat ??
    o?.gps_lat ??
    o?.gpsLatitude ??
    o?.y ??
    o?.Y ??
    null;

  const pickLng = (o) =>
    o?.longitude ??
    o?.lng ??
    o?.lon ??
    o?.long ??
    o?.Lng ??
    o?.Longitude ??
    o?.LONGITUDE ??
    o?.lon_message ??
    o?.gpsLng ??
    o?.gps_lng ??
    o?.gpsLongitude ??
    o?.x ??
    o?.X ??
    null;

  // Try in multiple likely containers
  const candidates = [
    row,
    row?.raw,
    row?.data,
    row?.vehicle,
    row?.location,
    row?.position,
    row?.coordinates,
    row?.otherAttributes,
    row?.otherAttributes?.location,
  ];

  for (const c of candidates) {
    if (!c) continue;

    // Case: coordinates array [lng, lat] OR [lat, lng] (we try both safely)
    if (Array.isArray(c) && c.length >= 2) {
      const a = toNum(c[0]);
      const b = toNum(c[1]);
      // try [lat,lng]
      if (a != null && b != null && Math.abs(a) <= 90 && Math.abs(b) <= 180)
        return { lat: a, lng: b };
      // try [lng,lat]
      if (a != null && b != null && Math.abs(b) <= 90 && Math.abs(a) <= 180)
        return { lat: b, lng: a };
    }

    const lat = toNum(pickLat(c));
    const lng = toNum(pickLng(c));

    if (
      lat != null &&
      lng != null &&
      !(lat === 0 && lng === 0) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    ) {
      return { lat, lng };
    }
  }

  return null;
}


export const noCacheHeaders = {
  "Cache-Control": "no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export const withBuster = (url) =>
  `${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`;

export function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function downsamplePath(path, maxPoints = 200) {
  if (!path || path.length <= maxPoints) return path || [];
  const step = Math.ceil(path.length / maxPoints);
  const out = [];
  for (let i = 0; i < path.length; i += step) out.push(path[i]);
  const last = path[path.length - 1];
  const lastOut = out[out.length - 1];
  if (!lastOut || lastOut.lat !== last.lat || lastOut.lng !== last.lng) out.push(last);
  return out;
}

export function calculateHeading(from, to) {
  if (!from || !to) return 0;
  if (!window.google?.maps?.geometry?.spherical) return 0;
  const p1 = new window.google.maps.LatLng(from.lat, from.lng);
  const p2 = new window.google.maps.LatLng(to.lat, to.lng);
  const heading = window.google.maps.geometry.spherical.computeHeading(p1, p2);
  return Number.isFinite(heading) ? heading : 0;
}

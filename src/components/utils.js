export const MAP_LIBRARIES = ["maps"];

export const normalizeReg = (x) => (x ?? "").toString().trim().toUpperCase();

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

export function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getLatLng(row) {
  const latRaw = row?.latitude ?? row?.lat ?? row?.Lat ?? row?.Latitude ?? row?.LATITUDE;
  const lngRaw =
    row?.longitude ??
    row?.lng ??
    row?.lon ??
    row?.Lng ??
    row?.Longitude ??
    row?.LONGITUDE;

  const lat = latRaw != null ? parseFloat(latRaw) : null;
  const lng = lngRaw != null ? parseFloat(lngRaw) : null;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

export function pickVehicleType(r) {
  return (
    r?.vehicle_type ??
    r?.vehicleType ??
    r?.type ??
    r?.model ??
    r?.model_name ??
    r?.vehicleModel ??
    "-"
  );
}

export function pickFuelCapacity(r) {
  const val =
    r?.fuel_capacity ??
    r?.fuelCapacity ??
    r?.fuel_tank_capacity ??
    r?.tank_capacity ??
    r?.tankCapacity ??
    r?.fuelCapcity;
  return val ?? "-";
}

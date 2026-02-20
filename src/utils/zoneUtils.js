/**
 * Zone utilities: parse KML zones and point-in-polygon for zone-crossing detection.
 */

/**
 * Parse KML text (ZONE_2022.kml) and return array of { name, ring } where ring is [lng, lat][].
 * Expects <Placemark><name>X</name>...<coordinates>lng,lat,0 lng,lat,0 ...</coordinates>...
 */
export function parseKmlZones(kmlText) {
  if (!kmlText || typeof kmlText !== "string") return [];
  const zones = [];
  const placemarkRe = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi;
  let m;
  while ((m = placemarkRe.exec(kmlText)) !== null) {
    const block = m[1];
    const nameMatch = block.match(/<name>([^<]*)<\/name>/i);
    const name = nameMatch ? nameMatch[1].trim() : "";
    const coordMatch = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    if (!coordMatch) continue;
    const coordStr = coordMatch[1].replace(/\s+/g, " ").trim();
    const ring = [];
    const parts = coordStr.split(/\s+/);
    for (const p of parts) {
      const nums = p.split(",").map((s) => parseFloat(s.trim()));
      if (nums.length >= 2 && Number.isFinite(nums[0]) && Number.isFinite(nums[1])) {
        ring.push([nums[0], nums[1]]);
      }
    }
    if (ring.length >= 3) zones.push({ name, ring });
  }
  return zones;
}

/**
 * Ray-casting point-in-polygon. Point is [lng, lat] or { lat, lng }; ring is [lng, lat][].
 */
export function pointInPolygon(point, ring) {
  if (!ring || ring.length < 3) return false;
  const x = point.lng != null ? point.lng : point[0];
  const y = point.lat != null ? point.lat : point[1];
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Get zone name for a point (lat, lng). Returns first matching zone name or null if outside all.
 */
export function getZoneForPoint(lat, lng, zones) {
  if (lat == null || lng == null || !Array.isArray(zones) || zones.length === 0) return null;
  const point = { lat, lng };
  for (const z of zones) {
    if (pointInPolygon(point, z.ring)) return z.name;
  }
  return null;
}

/**
 * Get ward name for a point (lat, lng). Returns first matching ward name or null if outside all.
 */
export function getWardForPoint(lat, lng, wards) {
  if (lat == null || lng == null || !Array.isArray(wards) || wards.length === 0) return null;
  const point = { lat, lng };
  for (const w of wards) {
    if (pointInPolygon(point, w.ring)) return w.name;
  }
  return null;
}

// // components/utils/jtrack1Zones.js

// // Extract all zones from PM array (your response.PM)
// export function extractJtrack1Zones(pmArray = []) {
//   const rows = [];

//   (pmArray || []).forEach((veh) => {
//     (veh?.zones || []).forEach((z) => {
//       rows.push({
//         vehicle: veh?.vehicle || "-",
//         zone: z?.zone || "-",
//         branchId: String(z?.branch_id ?? ""),
//         planned: Number(z?.planned ?? 0),
//         marchOut: Number(z?.marchOut ?? 0),
//       });
//     });
//   });

//   return rows;
// }

// // Build lookup map: { "7034": "ZONE 8", ... }
// export function buildJtrack1ZoneMap(pmArray = []) {
//   const zones = extractJtrack1Zones(pmArray);
//   const map = {};
//   zones.forEach((z) => {
//     if (z.branchId) map[z.branchId] = z.zone;
//   });
//   return map;
// }


// src/store/jtrack1Zones.js

/** Build branch_id => zone map from the "AM" zone master API response */
export function buildBranchIdToZoneMap(zoneApiJson) {
  const map = {};

  // Example response:
  // { "AM": [ { vehicle: "...", zones: [ { zone:"ZONE 1", branch_id:"7052" }, ... ] } ] }

  if (!zoneApiJson || typeof zoneApiJson !== "object") return map;

  // The top-level key can be "AM" (as you showed), or could vary.
  const buckets = Object.values(zoneApiJson).filter(Array.isArray);

  for (const arr of buckets) {
    for (const item of arr || []) {
      const zones = item?.zones;
      if (!Array.isArray(zones)) continue;

      for (const z of zones) {
        const bid = String(z?.branch_id ?? "").trim();
        const zone = String(z?.zone ?? "").trim();
        if (bid && zone) map[bid] = zone; // ex: "7052" => "ZONE 1"
      }
    }
  }

  return map;
}

/** Parse branch_name like "ZONE-8" or "ZONE 8" or "z-08" -> "ZONE 8" */
export function zoneFromBranchName(branchName) {
  const s = String(branchName ?? "").trim();
  if (!s) return null;

  const m = s.match(/zone\W*0*(\d{1,2})/i);
  if (m) return `ZONE ${Number(m[1])}`;

  const m2 = s.match(/^z\W*0*(\d{1,2})$/i);
  if (m2) return `ZONE ${Number(m2[1])}`;

  return null;
}

/** Final picker for JTrack-1 live row */
export function pickJtrack1ZoneFromRow(liveRow, branchIdToZoneMap) {
  const bid = String(liveRow?.branch_id ?? "").trim();
  if (bid && branchIdToZoneMap?.[bid]) return branchIdToZoneMap[bid];

  const byName = zoneFromBranchName(liveRow?.branch_name);
  if (byName) return byName;

  return null;
}



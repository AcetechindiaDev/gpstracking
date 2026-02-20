
    /* =========================================================
========================================================= */

import React, {
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
  useDeferredValue,
} from "react";
import { useParams } from "react-router-dom";


import "bootstrap-icons/font/bootstrap-icons.css";


// 👇 IMPORT YOUR API FUNCTIONS
// import {
//   fetchFleetx,
//   fetchGpstrack,
//   fetchVecv,
//   fetchVamosys,
//   fetchIalert2,
// } from "";

// import { fetchFleetx,fetchGpstrack,fetchVecv,fetchVamosys,fetchIalert2 } from "./sources/vendorapi";

import {
  GoogleMap,
  InfoWindow,
  Polyline,
  useJsApiLoader,
  OverlayView,
  Marker,
  KmlLayer,
} from "@react-google-maps/api";
import { useDispatch, useSelector } from "react-redux";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Badge,
  Alert,
  Button,
} from "react-bootstrap";

// import MovingVehiclesPanel from "./MovingVehiclesPanel";
import { SOURCE_META, downsamplePath } from "../store/utils";
import {
  startPolling,
  stopPolling,
  selectAllVehicles,
} from "../store/vehiclesSlice";
import { setSelectedVendor, setActive } from "../store/uiSlice";
import {
  selectTrackTick,
  selectTrack,
  selectMovingMap,
} from "../store/tracksSlice";

import { Offcanvas, Toast, ToastContainer } from "react-bootstrap";
import { parseKmlZones, getZoneForPoint, getWardForPoint } from "../utils/zoneUtils";



/* ======================
   MAP CONFIG
====================== */
// const containerStyle = { width: "100%", height: "520px" };
// const containerStyle = { width: "100%", height: "min(520px, 70vh)" };

const containerStyle = { width: "100%", height: "80vh", minHeight: "700px" };
const defaultCenter = { lat: 13.0827, lng: 80.2707 };

const GOOGLE_MAPS_API_KEY =
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
  "AIzaSyDLdx6a4kC7pWaM5axn5h9jjRMbxmBDLOw";

const MAP_LIBRARIES = ["geometry"];

/* ======================
   PERF: option cap
====================== */
const MAX_OPTIONS = 500;

/* ======================
   ✅ Global font-size bump
====================== */
const PAGE_SCALE = 1.08;
const pageScaleStyle = { fontSize: `${Math.round(14 * PAGE_SCALE)}px` };

/* ======================
   ✅ Status freshness threshold (No Data)
====================== */
const NO_DATA_AFTER_MINUTES = 60;

// ✅ Prevent History mode from drawing 100s of polylines (History only)
const MAX_HISTORY_POLYLINES = 60;


/* ======================
   DATE HELPERS
====================== */
function todayYYYYMMDD() {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function formatDateTime(value) {
  if (value === undefined || value === null || value === "") return "-";

  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d+$/.test(s)) return formatDateTime(Number(s));
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toLocaleString();
    return s;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "-";
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString();
  }

  return String(value);
}

function toDateSafe(value) {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const s = String(value).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return toDateSafe(Number(s));

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inDateRange(dateValue, fromYYYYMMDD, toYYYYMMDD) {
  if (!fromYYYYMMDD || !toYYYYMMDD) return true;

  const d = toDateSafe(dateValue);
  if (!d) return true;

  const from = new Date(`${fromYYYYMMDD}T00:00:00`);
  const to = new Date(`${toYYYYMMDD}T23:59:59`);
  return d >= from && d <= to;
}

/* =========================================================
   ✅ NEW DATE RULE HELPERS
========================================================= */
function cmpYYYYMMDD(a, b) {
  const A = String(a || "");
  const B = String(b || "");
  if (A === B) return 0;
  return A < B ? -1 : 1;
}

// ✅ If ToDate is today (or later) => treat as "current view" => show ALL vehicles
function isCurrentDateView(fromYYYYMMDD, toYYYYMMDD) {
  const t = todayYYYYMMDD();
  if (!toYYYYMMDD) return true;
  return cmpYYYYMMDD(toYYYYMMDD, t) >= 0;
}

// ✅ For previous dates: allow vehicles if ANY track point is in selected range
function trackHasPointInRange(trackArr, fromYYYYMMDD, toYYYYMMDD) {
  if (!Array.isArray(trackArr) || trackArr.length === 0) return false;
  if (!fromYYYYMMDD || !toYYYYMMDD) return true;

  for (const p of trackArr) {
    const pt = pickFirst(
      p,
      [
        "gps_datetime",
        "datetime",
        "ts",
        "timestamp",
        "time",
        "epochTime",
        "created_at",
        "createdAt",
      ],
      ""
    );
    if (pt && inDateRange(pt, fromYYYYMMDD, toYYYYMMDD)) return true;
  }
  return false;
}

/* ======================
   Distance & Heading helpers
====================== */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// function calculateHeading(lat1, lng1, lat2, lng2) {
//   const dLng = ((lng2 - lng1) * Math.PI) / 180;
//   const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
//   const x =
//     Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
//     Math.sin((lat1 * Math.PI) / 180) *
//       Math.cos((lat2 * Math.PI) / 180) *
//       Math.cos(dLng);
//   return (Math.atan2(y, x) * 180) / Math.PI;
// }

/* ======================
   Vendor colors (fallback)
====================== */
const VENDOR_COLORS = {
  jtrack1: "#F59E0B",
  jtrack2: "#F97316",
  batch: "#22C55E",
  vecv: "#3B82F6",
  gpstrack: "#06B6D4",
  ialert2: "#A855F7",
  fleetx: "#EF4444",
  vamosys: "#14B8A6",
};
function getVendorColor(source) {
  return SOURCE_META?.[source]?.color || VENDOR_COLORS[source] || "#1565C0";
}

/* ======================
   ✅ SOURCE NORMALIZER (Fix alias mismatch)
   ✅ Added Amphibious + more BatchMaster aliases
====================== */
function normalizeSourceName(source) {
  const s = String(source ?? "").trim();
  if (!s) return "unknown";

  const key = s.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (key === "ialert2" || key === "ialert" || key === "ialert02") return "ialert2";
  if (key === "jtrack1" || key === "jtrack01") return "jtrack1";
  if (key === "jtrack2" || key === "jtrack02") return "jtrack2";

  // ✅ Amphibious / GPS Track variants => gpstrack
  if (
    key === "gps" ||
    key === "gpstrack" ||
    key === "gpstracker" ||
    key === "gpstracker" ||
    key === "gpstracking" ||
    key === "amphibious"
  ) return "gpstrack";

  if (key === "fleetx") return "fleetx";
  if (key === "vamosys") return "vamosys";
  if (key === "vecv") return "vecv";

  // ✅ BatchMaster variants => batch
  if (
    key === "batch" ||
    key === "batchmaster" ||
    key === "batchmastergps" ||
    key === "batchmastertracking" ||
    key === "batchmaster1" ||
    key === "batchmaster2" ||
    key === "batchmaster3" ||
    key === "batchmaster4" ||
    key === "batchmaster5" ||
    key === "batchmaster6" ||
    key === "batchmaster7" ||
    key === "batchmaster8" ||
    key === "batchmaster9" ||
    key === "batchmaster10" ||
    key === "batchmaster11" ||
    key === "batchmaster12" ||
    key === "batchmaster13" ||
    key === "batchmaster14" ||
    key === "batchmaster15" ||
    key === "batch_master" ||
    key === "batchmastertracking" ||
    key === "batchmastertrack"
  ) return "batch";

  return s.toLowerCase();
}

// function getSource(v) {
//   // ✅ HARD FALLBACK: detect iAlert2 shape even if source missing
//   if (!v?.source && v?.vehicleregnumber && (v?.latitude || v?.lat) && (v?.longitude || v?.lng)) {
//     return "ialert2";
//   }

//   // ✅ HARD FALLBACK: detect GPS/Amphibious shape if source missing (common)
//   if (
//     !v?.source &&
//     (v?.lat_message || v?.lng_message || v?.gps_lat || v?.gps_lng || v?.latitude || v?.longitude) &&
//     (v?.vehicle_number || v?.vehicle_no || v?.vehicleNumber || v?.regNo)
//   ) {
//     return "gpstrack";
//   }

//   // ✅ HARD FALLBACK: detect BatchMaster shape if source missing
//   if (
//     !v?.source &&
//     (v?.device_id || v?.deviceId || v?.imei || v?.imei_no) &&
//     (v?.lat || v?.lng || v?.latitude || v?.longitude || v?.gps_lat || v?.gps_lng)
//   ) {
//     return "batch";
//   }

//   return normalizeSourceName(v?.source);
// }



// function getSource(v) {
//   // ✅ HARD FALLBACK: detect iAlert2 shape even if source missing
//   if (!v?.source && v?.vehicleregnumber && (v?.latitude || v?.lat) && (v?.longitude || v?.lng)) {
//     return "ialert2";
//   }

//   // ✅ HARD FALLBACK: detect BatchMaster shape if source missing (MOVE UP)
//   if (
//     !v?.source &&
//     (v?.device_id || v?.deviceId || v?.imei || v?.imei_no) &&
//     (v?.lat || v?.lng || v?.latitude || v?.longitude || v?.gps_lat || v?.gps_lng)
//   ) {
//     return "batch";
//   }

//   // ✅ HARD FALLBACK: detect GPS/Amphibious shape if source missing
//   // (DON'T steal BatchMaster vehicles)
//   if (
//     !v?.source &&
//     !(v?.device_id || v?.deviceId || v?.imei || v?.imei_no) &&
//     (v?.lat_message || v?.lng_message || v?.gps_lat || v?.gps_lng || v?.latitude || v?.longitude) &&
//     (v?.vehicle_number || v?.vehicle_no || v?.vehicleNumber || v?.regNo)
//   ) {
//     return "gpstrack";
//   }

//   return normalizeSourceName(v?.source);
// }


function getSource(v) {
  // ✅ iAlert2 fallback
  if (
    !v?.source &&
    v?.vehicleregnumber &&
    (v?.latitude || v?.lat) &&
    (v?.longitude || v?.lng)
  ) {
    return "ialert2";
  }

  // ✅ BatchMaster fallback — DROP ONLY (NO PICKUP)
  if (
    !v?.source &&
    pickFirst(
      v,
      [
        "Drop Place",
        "DropPlace",
        "Drop Location",
        "DropLocation",
        "drop_place",
        "dropPlace",
        "drop_location",
        "dropLocation",
        "drop_address",
        "dropAddress",
      ],
      ""
    )
  ) {
    return "batch";
  }

  // ✅ BatchMaster fallback — device based (keeps reliability)
  if (
    !v?.source &&
    (v?.device_id || v?.deviceId || v?.imei || v?.imei_no) &&
    (v?.lat || v?.lng || v?.latitude || v?.longitude || v?.gps_lat || v?.gps_lng)
  ) {
    return "batch";
  }

  // ✅ gpstrack fallback (DON’T steal batch vehicles)
  if (
    !v?.source &&
    !(v?.device_id || v?.deviceId || v?.imei || v?.imei_no) &&
    (v?.lat_message ||
      v?.lng_message ||
      v?.gps_lat ||
      v?.gps_lng ||
      v?.latitude ||
      v?.longitude) &&
    (v?.vehicle_number || v?.vehicle_no || v?.vehicleNumber || v?.regNo)
  ) {
    return "gpstrack";
  }

  return normalizeSourceName(v?.source);
}


/* ======================
   Premium Vendor Truck Icon (SVG)
====================== */
const iconCache = new Map();

// ✅ FAST icon: 1 per vendor color (no moving/active variants)
function getVendorTruckIconStatic(color = "#F59E0B", size = 58) {
  const key = `VTRUCK_STATIC|${color}|${size}`;
  const hit = iconCache.get(key);
  if (hit) return hit;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
    <defs>
      <filter id="ds" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="5" stdDeviation="3" flood-color="rgba(0,0,0,0.28)"/>
      </filter>
    </defs>
    <g filter="url(#ds)">
      <path d="M32 6 L38 16 L26 16 Z" fill="rgba(255,255,255,.95)"/>
      <path d="M15 30 C15 24, 19 21, 26 21 H39 C45 21, 48 24, 48 30 V39 C48 43, 46 45, 42 45 H21 C17 45, 15 43, 15 39 Z"
            fill="${color}" stroke="rgba(255,255,255,.92)" stroke-width="2"/>
      <rect x="19.5" y="25" width="16" height="8" rx="3.5"
            fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
      <path d="M38 25 H50 L56 35 V45 H38 Z"
            fill="${color}" stroke="rgba(255,255,255,.92)" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="24" cy="48" r="6.4" fill="#111827"/>
      <circle cx="46" cy="48" r="6.4" fill="#111827"/>
      <circle cx="24" cy="48" r="2.4" fill="rgba(255,255,255,.85)"/>
      <circle cx="46" cy="48" r="2.4" fill="rgba(255,255,255,.85)"/>
      <circle cx="28" cy="56" r="2.2" fill="#EF4444"/>
    </g>
  </svg>
  `.trim();

  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  iconCache.set(key, url);
  return url;
}

/* ======================
   Start / End Pin icons
====================== */
function makePinDataUrl({ label = "S", fill = "#22C55E" }) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <defs>
      <filter id="sh" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="2" flood-color="rgba(0,0,0,0.30)"/>
      </filter>
    </defs>
    <g filter="url(#sh)">
      <path d="M22 4c-7.2 0-13 5.8-13 13 0 10 13 23 13 23s13-13 13-23c0-7.2-5.8-13-13-13z"
            fill="${fill}" stroke="rgba(255,255,255,0.85)" stroke-width="2" />
      <circle cx="22" cy="17" r="9" fill="rgba(255,255,255,0.92)"/>
      <text x="22" y="20.8" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="900"
            fill="rgba(15,23,42,0.92)">${label}</text>
    </g>
  </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
const START_ICON = {
  url: makePinDataUrl({ label: "S", fill: "#22C55E" }),
  scaledSize: { width: 34, height: 34 },
  anchor: { x: 17, y: 34 },
};
const END_ICON = {
  url: makePinDataUrl({ label: "E", fill: "#EF4444" }),
  scaledSize: { width: 34, height: 34 },
  anchor: { x: 17, y: 34 },
};

/* ======================
   Helpers for API fields
====================== */
// function pickFirst(obj, keys, fallback = "-") {
//   for (const k of keys) {
//     const v = obj?.[k];
//     if (v !== undefined && v !== null && String(v).trim() !== "") return v;
//   }
//   return fallback;
// }
// function normalizeText(x) {
//   return String(x ?? "").trim();
// }

// function pickFirst(obj, keys, fallback = "-") {
//   for (const k of keys) {
//     const v = obj?.[k];
//     if (v !== undefined && v !== null && String(v).trim() !== "") return v;
//   }
//   return fallback;
// }

// function pickFirstDeep(v, keys, fallback = "-") {
//   const direct = pickFirst(v, keys, "");
//   if (direct) return direct;

//   const raw = pickFirst(v?.raw, keys, "");
//   if (raw) return raw;

//   const data = pickFirst(v?.data, keys, "");
//   if (data) return data;

//   const vehicle = pickFirst(v?.vehicle, keys, "");
//   if (vehicle) return vehicle;

//   return fallback;
// }

// function normalizeText(x) {
//   return String(x ?? "").trim();
// }


function normKey(k) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // removes spaces, underscores, hyphens etc.
}

function pickFirst(obj, keys, fallback = "-") {
  // 1) direct key access
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }

  // 2) normalized key match (handles "Drop Place " / "drop_place" / "DropPlace")
  const wanted = new Set(keys.map(normKey));
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      if (!wanted.has(normKey(k))) continue;
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
  }

  return fallback;
}

function pickFirstDeep(v, keys, fallback = "-") {
  const direct = pickFirst(v, keys, "");
  if (direct) return direct;

  const raw = pickFirst(v?.raw, keys, "");
  if (raw) return raw;

  const data = pickFirst(v?.data, keys, "");
  if (data) return data;

  const vehicle = pickFirst(v?.vehicle, keys, "");
  if (vehicle) return vehicle;

  return fallback;
}

function normalizeText(x) {
  return String(x ?? "").trim();
}


/* ✅ Vehicle key - robust (UPDATED: checks v.raw/v.data/v.vehicle) */
function getVehicleKey(v) {
  const read = (obj) =>
    pickFirst(
      obj,
      [
        "trackKey",
        "track_key",
        "vehicleregnumber",
        "vehicle_number",
        "vehicleNumber",
        "vehicle_no",
        "regNo",
        "label",
        "imei",
        "imei_no",
        "deviceId",
        "device_id",
        "vehicle_id",
        "vehicleId",
        "vehicleid",
        "unit_id",
        "unitId",
        "gps_id",
        "gpsId",
        "id",
      ],
      ""
    );

  const direct = read(v);
  if (direct) return direct;

  const raw = read(v?.raw);
  if (raw) return raw;

  const data = read(v?.data);
  if (data) return data;

  const vehicle = read(v?.vehicle);
  if (vehicle) return vehicle;

  return "";
}

// ✅ ADD THIS RIGHT HERE (after getVehicleKey)
function getTrackKeySafe(v) {
  const k = String(getVehicleKey(v) || "").trim();
  if (k) return k;

  const reg = normalizeRegNo(getRegText(v));
  if (reg) return reg;

  return "";
}

/* ✅ NEW: deterministic hash + jitter to avoid overlap */
function stableHash(str) {
  const s = String(str ?? "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function jitterLatLng(pos, seedStr) {
  if (!pos) return null;
  const h = stableHash(seedStr);
  const a = (h % 360) * (Math.PI / 180);
  const r = ((h >>> 8) % 12) / 100000; // 0..0.00011 approx
  const dLat = Math.cos(a) * r;
  const dLng = Math.sin(a) * r;
  return { lat: pos.lat + dLat, lng: pos.lng + dLng };
}

/* =========================================================
   ✅ COORD PARSER (Fix "13,0827" / stray chars)
========================================================= */
function toNumberCoord(x) {
  if (x === undefined || x === null) return NaN;
  if (typeof x === "number") return x;
  const s = String(x).trim();
  if (!s) return NaN;
  // replace comma decimal -> dot
  const s2 = s.replace(",", ".");
  // keep digits, dot, minus
  const cleaned = s2.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return n;
}

/* ✅ Calculate heading/bearing between two points (in degrees) */
function calculateHeading(lat1, lng1, lat2, lng2) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/* ✅ Ray-casting algorithm: check if point is inside polygon */
function isPointInPolygon(lat, lng, polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;
    
    const intersect = (yi > lng) !== (yj > lng) &&
      lng < (xj - xi) * (lng - yi) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/* ✅ Get zone name from KML polygon data */
function getZoneNameFromKml(lat, lng, zones) {
  if (!zones || zones.length === 0) return null;
  for (const zone of zones) {
    if (zone.polygon && isPointInPolygon(lat, lng, zone.polygon)) {
      return zone.name || null;
    }
  }
  return null;
}

/* ✅ Get ward name from KML polygon data */
function getWardNameFromKml(lat, lng, wards) {
  if (!wards || wards.length === 0) return null;
  for (const ward of wards) {
    if (ward.polygon && isPointInPolygon(lat, lng, ward.polygon)) {
      return ward.name || null;
    }
  }
  return null;
}

/* ✅ Robust lat/lng extraction (NOW supports more keys + nested) */
function getLatLng(v) {
  const read = (obj) => {
    const latRaw = pickFirst(
      obj,
      [
        "lat",
        "latitude",
        "Latitude",
        "gps_lat",
        "gpsLat",
        "LAT",
        "y",
        "lat_message",
        "Lat_message",
        "LAT_MESSAGE",
        "latMessage",
        "gpsLatitude",
        "gps_latitude",

        // ✅ more vendor keys (Batch/Amphibious seen variants)
        "vehicle_lat",
        "vehicleLatitude",
        "veh_lat",
        "lat_value",
        "latValue",
        "LatitudeValue",
        "latt",
        "latitud",
        "latitute",
      ],
      null
    );

    const lngRaw = pickFirst(
      obj,
      [
        "lng",
        "lon",
        "long",
        "longitude",
        "Longitude",
        "gps_lng",
        "gpsLng",
        "LNG",
        "x",
        "lng_message",
        "lon_message",   // ⭐ ADD THIS LINE
        "Lng_message",
        "LNG_MESSAGE",
        "lngMessage",
        "gpsLongitude",
        "gps_longitude",

        // ✅ more vendor keys (Batch/Amphibious seen variants)
        "vehicle_lng",
        "vehicle_long",
        "vehicleLongitude",
        "veh_lng",
        "veh_long",
        "lng_value",
        "lngValue",
        "LongitudeValue",
        "longitud",
        "longitute",
      ],
      null
    );

    const lat = toNumberCoord(latRaw);
    const lng = toNumberCoord(lngRaw);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;

    // basic sanity (prevents weird 99999)
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

    return { lat, lng };
  };

  const direct = read(v);
  if (direct) return direct;

  const raw = read(v?.raw);
  if (raw) return raw;

  const data = read(v?.data);
  if (data) return data;
  const vehicle = read(v?.vehicle);
  if (vehicle) return vehicle;

  return null;
}

/* ======================
   ✅ Type & Reg helpers (ROBUST - supports nested)
====================== */
function getTypeText(v) {
  const read = (obj) =>
    pickFirst(
      obj,
      [
        "vehicleType",
        "type",
        "model_name",
        "model",
        "vehicle_model",
        "vehicle_category",
        "vehicle",
      ],
      ""
    );

  const d = read(v);
  if (String(d || "").trim()) return String(d).trim();

  const r = read(v?.raw);
  if (String(r || "").trim()) return String(r).trim();

  const da = read(v?.data);
  if (String(da || "").trim()) return String(da).trim();

  const ve = read(v?.vehicle);
  return String(ve || "").trim();
}
function getRegText(v) {
  const read = (obj) =>
    pickFirst(
      obj,
      [
        "regNo",
        "label",
        "vehicleNumber",
        "vehicle_no",
        "vehicle_number",
        "vehicleregnumber",

        // ✅ extra common vendor keys
        "vehicle_reg_no",
        "vehicleRegNo",
        "registration",
        "registration_no",
        "reg_no",
      ],
      ""
    );

  const d = read(v);
  if (String(d || "").trim()) return String(d).trim();

  const r = read(v?.raw);
  if (String(r || "").trim()) return String(r).trim();

  const da = read(v?.data);
  if (String(da || "").trim()) return String(da).trim();

  const ve = read(v?.vehicle);
  return String(ve || "").trim();
}

/* normalize "ZONE-8" => "ZONE 8" */
function normalizeZoneText(x) {
  const s = String(x ?? "").trim();
  if (!s) return "-";
  const m = s.match(/zone\W*0*(\d{1,2})/i);
  if (m) return `ZONE ${Number(m[1])}`;
  if (/^zone\s+\d{1,2}$/i.test(s)) return s.toUpperCase();
  return s;
}
function zoneFromBranchName(branchName) {
  const s = normalizeText(branchName);
  if (!s) return null;
  const m = s.match(/zone\W*0*(\d{1,2})/i);
  if (m) return `ZONE ${Number(m[1])}`;
  const m2 = s.match(/^z\W*0*(\d{1,2})$/i);
  if (m2) return `ZONE ${Number(m2[1])}`;
  return null;
}
function getZoneText(v) {
  const direct = pickFirst(
    v,
    [
      "zoneNo",
      "zone_no",
      "zone",
      "zoneName",
      "zoneno",
      "zone_name",
      "zone_number",
      "zoneNumber",
      "ZoneNo",
      "Zone",
      "ZoneName",
      "zoneId",
      "zone_id",
      "zoneid",
    ],
    ""
  );
  if (direct) return normalizeZoneText(direct);

  const z1 = zoneFromBranchName(v?.branch_name || v?.branchName);
  if (z1) return normalizeZoneText(z1);

  const z2 = zoneFromBranchName(v?.raw?.branch_name || v?.raw?.branchName);
  if (z2) return normalizeZoneText(z2);

  const rawDirect = pickFirst(
    v?.raw,
    ["zoneNo", "zone", "zone_name", "zoneNumber", "zone_no", "ZoneNo", "Zone"],
    ""
  );
  if (rawDirect) return normalizeZoneText(rawDirect);

  return "-";
}
function getWardText(v) {
  return pickFirst(
    v,
    ["wardNo", "ward_no", "ward", "wardName", "wardno", "ward_name", "WardNo", "Ward", "WardName"],
    "-"
  );
}
function toSpeedText(v) {
  if (v === "-" || v === undefined || v === null) return "-";
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(n)) return "-";
  return `${n} KM/H`;
}

/* ======================
   Status helpers
====================== */
function getIgnitionValue(v) {
  const raw = pickFirst(
    v,
    [
      "ignition",
      "ignition_status",
      "ignitionStatus",
      "Ignition",
      "ign",
      "IGN",
      "acc",
      "ACC",
      "engine",
      "engineStatus",
      "engine_status",
    ],
    ""
  );

  if (raw === "-" || raw === "") return null;

  const s = String(raw).trim().toLowerCase();
  if (s === "on" || s === "1" || s === "true" || s === "yes") return 1;
  if (s === "off" || s === "0" || s === "false" || s === "no") return 0;

  const n = Number(String(raw).replace(/[^\d]/g, ""));
  if (Number.isFinite(n)) return n ? 1 : 0;
  return null;
}
function getLastUpdateDateObj(v) {
  const dt = pickFirst(
    v,
    ["gps_datetime", "datetime", "ts", "lastUpdated", "epochTime", "time", "timestamp"],
    ""
  );
  return toDateSafe(dt);
}
function isNoDataVehicle(v) {
  const pos = getLatLng(v);
  if (!pos) return true;

  const d = getLastUpdateDateObj(v);
  if (!d) return true;

  const ageMs = Date.now() - d.getTime();
  const ageMin = ageMs / (60 * 1000);
  return ageMin > NO_DATA_AFTER_MINUTES;
}
function getVehicleStatus({ v, movingMap }) {
  if (isNoDataVehicle(v)) return "nodata";

  const src = getSource(v);
  const keySafe = getVehicleKey(v) || "";
  const movingKey = `${src}:${keySafe}`;

  const sp = Number(pickFirst(v, ["speed", "vehicleSpeed"], "0"));
  const movingBySpeed = Number.isFinite(sp) && sp > 0;
  const movingByMap = !!movingMap?.[movingKey];

  if (movingByMap || movingBySpeed) return "running";

  const ign = getIgnitionValue(v);
  if (ign === 0) return "parked";

  return "idle";
}

/* ======================
   ✅ Render key (always unique)
====================== */
function normalizeRegNo(x) {
  const s = String(x ?? "").trim().toUpperCase();
  if (!s || s === "-") return "";
  return s.replace(/[\s-]+/g, "");
}

function getRenderKey(v, idx) {
  const src = getSource(v);
  const id = String(
    pickFirst(v, ["uid", "vehicle_id", "vehicleId", "id", "imei", "device_id"], "")
  ).trim();
  const reg = normalizeRegNo(getRegText(v));
  const key = String(getVehicleKey(v) || "").trim();

  const pos = getLatLng(v);
  const latKey = pos ? Number(pos.lat).toFixed(6) : "nolat";
  const lngKey = pos ? Number(pos.lng).toFixed(6) : "nolng";

  return `${src}::${id || key || reg || "nokey"}::${latKey},${lngKey}::${idx}`;
}


function getVehicleUpdatedMs(v) {
  const d = getLastUpdateDateObj(v);
  return d ? d.getTime() : 0;
}

/* ======================
   ✅ Dedupe by vendor+reg; strong fallback includes lat/lng
====================== */
function dedupeVehiclesByRegNo(list) {
  const arr = Array.isArray(list) ? list : [];
  const best = new Map();

  for (const v of arr) {
    const src = getSource(v);
    const reg = normalizeRegNo(getRegText(v));

    const pos = getLatLng(v);
    const latKey = pos ? Number(pos.lat).toFixed(6) : "nolat";
    const lngKey = pos ? Number(pos.lng).toFixed(6) : "nolng";

    if (!reg) {
      const k1 = (getVehicleKey(v) || "").trim();
      const k2 = String(
        pickFirst(v, ["imei", "imei_no", "deviceId", "device_id", "vehicle_id", "vehicleId", "id"], "")
      ).trim();

      // ✅ include idx-independent data points so we don't collapse too aggressively
      const fk = `${src}::${k1 || "nokey"}::${k2 || "noid"}::${latKey},${lngKey}`;

      const prev = best.get(fk);
      if (!prev) best.set(fk, v);
      else if (getVehicleUpdatedMs(v) >= getVehicleUpdatedMs(prev)) best.set(fk, v);
      continue;
    }

    const key = `${src}::${reg}`;
    const prev = best.get(key);
    if (!prev) best.set(key, v);
    else if (getVehicleUpdatedMs(v) >= getVehicleUpdatedMs(prev)) best.set(key, v);
  }

  return Array.from(best.values());
}

/* ======================
   Path start/end helpers
====================== */
function getStartEndFromPath(path) {
  if (!Array.isArray(path) || path.length < 2) return { start: null, end: null };
  const start = path[0];
  const end = path[path.length - 1];
  if (!start || !end) return { start: null, end: null };
  if (!Number.isFinite(start.lat) || !Number.isFinite(start.lng)) return { start: null, end: null };
  if (!Number.isFinite(end.lat) || !Number.isFinite(end.lng)) return { start: null, end: null };
  return { start, end };
}
function fitBoundsForPath(map, path) {
  if (!map || !Array.isArray(path) || path.length < 2) return;
  if (!window.google || !window.google.maps) return;

  const bounds = new window.google.maps.LatLngBounds();
  let added = 0;

  for (const p of path) {
    if (!p) continue;
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    bounds.extend({ lat, lng });
    added += 1;
  }

  if (added >= 2) map.fitBounds(bounds, 70);
}

/* ======================
   requestIdleCallback helper
====================== */
function idle(cb) {
  if (typeof window !== "undefined" && window.requestIdleCallback) {
    return window.requestIdleCallback(cb, { timeout: 800 });
  }
  return setTimeout(() => cb({ timeRemaining: () => 0, didTimeout: true }), 0);
}
function cancelIdle(id) {
  if (typeof window !== "undefined" && window.cancelIdleCallback) window.cancelIdleCallback(id);
  else clearTimeout(id);
}

/* ======================
   ✅ stable signature (ORDER-INDEPENDENT)
====================== */
function buildOptionsSignatureStable(list, signatureKey) {
  const arr = Array.isArray(list) ? list : [];
  const keys = [];

  for (const v of arr) {
    const src = getSource(v);
    const k = getVehicleKey(v) || normalizeRegNo(getRegText(v)) || "";
    if (k) keys.push(`${src}:${k}`);
  }

  keys.sort();
  const N = Math.min(keys.length, 140);
  const head = keys.slice(0, N).join(";");
  return `${signatureKey}|len=${arr.length}|${head}`;
}

// ✅ Deep scan ANY nested object (v / v.raw / v.data / v.vehicle / any depth)
function pickFirstDeepAny(v, keys, fallback = "-") {
  if (!v || typeof v !== "object") return fallback;

  const wanted = new Set(keys.map(normKey)); // uses your existing normKey()

  const stack = [v];
  const seen = new Set();

  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;

    // prevent circular loops
    if (seen.has(cur)) continue;
    seen.add(cur);

    for (const [k, val] of Object.entries(cur)) {
      if (wanted.has(normKey(k))) {
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          return val;
        }
      }
      if (val && typeof val === "object") stack.push(val);
    }
  }

  return fallback;
}


/* ======================
   COMPONENT
====================== */

// added code for logic start

// ===========================
// ✅ FILTERS: defaults + validation + localStorage
// ===========================

const LS_FILTER_KEY = "gpslive_filters_v2";

const ALLOWED_MODES = ["Live All", "Live Only", "History"];
const ALLOWED_VENDORS = [
  "all",
  "jtrack1",
  "jtrack2",
  "batch",
  "vecv",
  "gpstrack",
  "ialert2",
  "fleetx",
  "vamosys",
];

const DEFAULT_STATUS = { running: true, idle: true, parked: true, nodata: true };

function isYYYYMMDD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function clampDateRange(fromDate, toDate) {
  const fromOk = isYYYYMMDD(fromDate) ? fromDate : todayYYYYMMDD();
  const toOk = isYYYYMMDD(toDate) ? toDate : fromOk;
  return toOk < fromOk ? { from: fromOk, to: fromOk } : { from: fromOk, to: toOk };
}

function safeVendor(v) {
  return ALLOWED_VENDORS.includes(v) ? v : "all";
}

function safeMode(m) {
  return ALLOWED_MODES.includes(m) ? m : "Live All";
}

// typeFilter is free text but we keep "Type" as default sentinel
function safeTypeFilter(t) {
  if (!t || typeof t !== "string") return "Type";
  return t.trim() ? t : "Type";
}

// vehNoFilter can be "Vehicle Number" OR reg string OR "src::reg" (when vendor=all)
function safeVehNoFilter(v) {
  if (!v || typeof v !== "string") return "Vehicle Number";
  return v.trim() ? v : "Vehicle Number";
}

function safeStatusFilter(st) {
  const out = { ...DEFAULT_STATUS };
  if (!st || typeof st !== "object") return out;

  for (const k of Object.keys(out)) {
    if (typeof st[k] === "boolean") out[k] = st[k];
  }
  // ensure at least 1 selected
  const any = Object.values(out).some(Boolean);
  return any ? out : { ...DEFAULT_STATUS };
}

// ✅ One sanitizer to rule them all
function sanitizeAppliedFilters(raw) {
  const r = raw && typeof raw === "object" ? raw : {};

  const mode = safeMode(r.mode);
  const selectedVendor = safeVendor(r.selectedVendor);

  const { from, to } = clampDateRange(r.fromDate, r.toDate);

  const typeFilter = safeTypeFilter(r.typeFilter);
  let vehNoFilter = safeVehNoFilter(r.vehNoFilter);

  // ✅ Validate cross-field logic:
  // If vendor is NOT "all", then vehNoFilter should NOT be "src::reg" format
  if (selectedVendor !== "all" && vehNoFilter.includes("::")) {
    vehNoFilter = "Vehicle Number";
  }

  const statusFilter = safeStatusFilter(r.statusFilter);

  return {
    mode,
    fromDate: from,
    toDate: to,
    selectedVendor,
    typeFilter,
    vehNoFilter,
    statusFilter,
  };
}

// function loadAppliedFilters() {
//   try {
//     const raw = localStorage.getItem(LS_FILTER_KEY);
//     if (!raw) return null;
//     const parsed = JSON.parse(raw);
//     return sanitizeAppliedFilters(parsed);
//   } catch {
//     return null;
//   }
// }

function loadAppliedFilters() {
  try {
    const raw = localStorage.getItem(LS_FILTER_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // ✅ merged defaults + compact saved values
    const merged = {
      mode: "Live All",
      selectedVendor: "all",
      typeFilter: "Type",
      vehNoFilter: "Vehicle Number",
      statusFilter: { ...DEFAULT_STATUS },

      // ✅ dates not persisted
      fromDate: todayYYYYMMDD(),
      toDate: todayYYYYMMDD(),

      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };

    return sanitizeAppliedFilters(merged);
  } catch {
    return null;
  }
}


// function saveAppliedFilters(filters) {
//   try {
//     const clean = sanitizeAppliedFilters(filters);
//     localStorage.setItem(
//       LS_FILTER_KEY,
//       JSON.stringify({ ...clean, updatedAt: Date.now() })
//     );
//   } catch {
//     // ignore quota/private mode
//   }
// }


function isDefaultStatus(st) {
  if (!st || typeof st !== "object") return true;
  return (
    st.running === true &&
    st.idle === true &&
    st.parked === true &&
    st.nodata === true
  );
}

// ✅ store only minimal non-default values
function compactFiltersForStorage(clean) {
  const out = {};

  if (clean.mode && clean.mode !== "Live All") out.mode = clean.mode;

  // ✅ store vendor only if not "all"
  if (clean.selectedVendor && clean.selectedVendor !== "all") {
    out.selectedVendor = clean.selectedVendor;
  }

  if (clean.typeFilter && clean.typeFilter !== "Type") out.typeFilter = clean.typeFilter;

  if (clean.vehNoFilter && clean.vehNoFilter !== "Vehicle Number") {
    out.vehNoFilter = clean.vehNoFilter;
  }

  if (clean.statusFilter && !isDefaultStatus(clean.statusFilter)) {
    out.statusFilter = clean.statusFilter;
  }

  return out;
}

function saveAppliedFilters(filters) {
  try {
    const clean = sanitizeAppliedFilters(filters);
    const compact = compactFiltersForStorage(clean);

    // ✅ if everything is default, clear localStorage
    if (Object.keys(compact).length === 0) {
      localStorage.removeItem(LS_FILTER_KEY);
      return;
    }

    localStorage.setItem(LS_FILTER_KEY, JSON.stringify(compact));
  } catch {
    // ignore quota/private mode
  }
}


export default function GpsLiveTracking() {
  // ✅ Detect if we're on a vendor-specific page (/vendor/:vendorId)
  const { vendorId } = useParams();
  const isVendorPage = !!vendorId;

  // const dispatch = useDispatch();
  // const mapRef = useRef(null);

  // const { isLoaded, loadError } = useJsApiLoader({
  //   googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  //   libraries: MAP_LIBRARIES,
  // });



  // const ui = useSelector((s) => s.ui);
  // const {
  //   selectedVendor = "all",
  //   showAllPolylines = true,
  //   showMovingFlow = true,
  //   denseMode = false,
  //   active = null,
  //   center = defaultCenter,
  //   loading = false,
  //   error = null,
  // } = ui || {};

  // const allVehicles = useSelector(selectAllVehicles);
  // const trackTick = useSelector(selectTrackTick);
  // const movingMap = useSelector(selectMovingMap);
  // const tracksBySource = useSelector((s) => s.tracks?.tracks || s.tracks?.bySource || {});

  // const [mode, setMode] = useState("Live All");

  // const [modeReady, setModeReady] = useState(true);

  // inside component
// ✅ Gate: show map by default - always true to load vehicles on initial page load
const [showMap, setShowMap] = useState(true);

// ✅ Filters
const [showFilters, setShowFilters] = useState(true);
const openFilters = () => setShowFilters(true);
const closeFilters = () => setShowFilters(false);

    const dispatch = useDispatch();
  const mapRef = useRef(null);

  // zoom in 

  // ✅ map zoom state (must be inside the component)
const [mapZoom, setMapZoom] = useState(12);

// KML layers (Ward / Zone) – src/kml is source; copied to public/kml at start/build for map URL
const [showKmlLayers, setShowKmlLayers] = useState(true);
const kmlBaseUrl = `${window.location.origin}${process.env.PUBLIC_URL || ""}/kml`;

// ✅ ZONE CROSSING COMMENTED OUT
// // Zone-crossing: parsed zones and wards from KML + last zone per vehicle + toasts
// const [zones, setZones] = useState([]);
// const [wards, setWards] = useState([]);
// const [zoneCrossingToasts, setZoneCrossingToasts] = useState([]);
// const lastZoneByKeyRef = useRef({});
// const zoneNotificationPermissionRef = useRef(null);

// ✅ called when user zooms (+ / - / mouse wheel)
const handleZoomChanged = useCallback(() => {
  const z = mapRef.current?.getZoom?.();
  if (typeof z === "number") setMapZoom(z);
}, []);

// zoom in end 

const hydratedRef = useRef(false); 


  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAP_LIBRARIES,
  });

const markerSize42 = useMemo(() => {
  if (!isLoaded || !window.google?.maps) return undefined;
  return new window.google.maps.Size(42, 42);
}, [isLoaded]);



const startIcon = useMemo(() => {
  if (!isLoaded || !window.google?.maps) return null;
  return {
    url: makePinDataUrl({ label: "S", fill: "#22C55E" }),
    scaledSize: new window.google.maps.Size(34, 34),
    anchor: new window.google.maps.Point(17, 34),
  };
}, [isLoaded]);

const endIcon = useMemo(() => {
  if (!isLoaded || !window.google?.maps) return null;
  return {
    url: makePinDataUrl({ label: "E", fill: "#EF4444" }),
    scaledSize: new window.google.maps.Size(34, 34),
    anchor: new window.google.maps.Point(17, 34),
  };
}, [isLoaded]);


  // ✅ Reverse geocode cache (lat,lng -> address)
  const [geoAddrMap, setGeoAddrMap] = useState({}); // key -> address
  const geocodeCacheRef = useRef(new Map());        // in-memory cache (fast)
  const geocoderRef = useRef(null);


  const clearGeoCache = useCallback(() => {
  geocodeCacheRef.current.clear();
  setGeoAddrMap({});
}, []);




  // ✅ init geocoder once maps are loaded
  // useEffect(() => {
  //   if (window.google?.maps && !geocoderRef.current) {
  //     geocoderRef.current = new window.google.maps.Geocoder();
  //   }
  // }, [isLoaded]);


  useEffect(() => {
  if (!isLoaded) return;

  const G = window.google?.maps?.Geocoder;
  if (typeof G !== "function") return; // ✅ prevents "not a constructor"

  if (!geocoderRef.current) {
    geocoderRef.current = new G();
  }
}, [isLoaded]);


  const ui = useSelector((s) => s.ui);
  const {
    selectedVendor = "all",
    showAllPolylines = true,
    showMovingFlow = true,
    denseMode = false,
    active = null,
    center = defaultCenter,
    loading = false,
    error = null,
  } = ui || {};

  const allVehicles = useSelector(selectAllVehicles);
  const trackTick = useSelector(selectTrackTick);
  const movingMap = useSelector(selectMovingMap);
  const tracksBySource = useSelector((s) => s.tracks?.tracks || s.tracks?.bySource || {});

  const [mode, setMode] = useState("Live All");
  const [modeReady, setModeReady] = useState(true);


useEffect(() => {
  setModeReady(false);
  const t = setTimeout(() => setModeReady(true), 0);
  return () => clearTimeout(t);
}, [mode]);


useEffect(() => {
  clearGeoCache();
}, [mode, clearGeoCache]);


  const [fromDate, setFromDate] = useState(todayYYYYMMDD());
  const [toDate, setToDate] = useState(todayYYYYMMDD());

  const [typeFilter, setTypeFilter] = useState("Type");
  const [vehNoFilter, setVehNoFilter] = useState("Vehicle Number");

  // ✅ Auto-set vendor when on vendor page
  useEffect(() => {
    if (isVendorPage && vendorId) {
      dispatch(setSelectedVendor(vendorId));
    }
  }, [isVendorPage, vendorId, dispatch]);

  /* =====================================================
   ✅ DRAFT FILTER STATE (Offcanvas only)
   ===================================================== */
const [draft, setDraft] = useState({
  mode: "Live All",
  fromDate: todayYYYYMMDD(),
  toDate: todayYYYYMMDD(),
  selectedVendor: "all",
  typeFilter: "Type",
  vehNoFilter: "Vehicle Number",
});

/* =====================================================
   ✅ Sync real filters → draft when Offcanvas opens
   ===================================================== */
useEffect(() => {
  if (showFilters) {
    // ✅ If on vendor page, always use that vendor
    const vendorForDraft = isVendorPage && vendorId ? vendorId : selectedVendor;
    setDraft({
      mode,
      fromDate,
      toDate,
      selectedVendor: vendorForDraft,
      typeFilter,
      vehNoFilter,
    });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [showFilters, isVendorPage, vendorId]);

  /* =====================================================
   ✅ Effective values (draft while Offcanvas open)
===================================================== */
// const effVendor = showFilters ? draft.selectedVendor : selectedVendor;
// const effType = showFilters ? draft.typeFilter : typeFilter;
// const effFromDate = showFilters ? draft.fromDate : fromDate;
// const effToDate = showFilters ? draft.toDate : toDate;
// const effMode = showFilters ? draft.mode : mode;



    /* =====================================================
   ✅ Applied values (MAP uses applied only -> FAST)
===================================================== */
const effVendor = selectedVendor;
const effType = typeFilter;
const effFromDate = fromDate;
const effToDate = toDate;
const effMode = mode;

/* =====================================================
   ✅ Draft values only for dropdown option-building
===================================================== */
const optVendor = showFilters ? draft.selectedVendor : selectedVendor;
const optType = showFilters ? draft.typeFilter : typeFilter;


  // added new line start 
    /* =====================================================
     ✅ CURRENT LOCATION (Reverse Geocode) HELPERS
  ===================================================== */
  const roundCoord = (n, d = 5) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return null;
    return Number(x.toFixed(d));
  };

  const makeGeoKey = (pos) => {
    if (!pos) return "";
    const la = roundCoord(pos.lat, 5);
    const ln = roundCoord(pos.lng, 5);
    if (la === null || ln === null) return "";
    return `${la},${ln}`;
  };

  const reverseGeocode = useCallback(
    async (pos) => {
      if (!pos || !window.google?.maps) return null;

      const key = makeGeoKey(pos);
      if (!key) return null;

      // ✅ in-memory cache first
      if (geocodeCacheRef.current.has(key)) {
        return geocodeCacheRef.current.get(key);
      }

      // ✅ state cache second
      if (geoAddrMap[key]) {
        geocodeCacheRef.current.set(key, geoAddrMap[key]);
        return geoAddrMap[key];
      }

      // ✅ geocoder
      // if (!geocoderRef.current) {
      //   geocoderRef.current = new window.google.maps.Geocoder();
      // }

      // ✅ geocoder (lazy + safe)
    if (!geocoderRef.current) {
      const G = window.google?.maps?.Geocoder;
      if (typeof G !== "function") return null; // ⛔ maps not ready yet
    geocoderRef.current = new G();
}
const geocoder = geocoderRef.current;


      try {
        const addr = await new Promise((resolve) => {
          geocoderRef.current.geocode({ location: pos }, (results, status) => {
            if (status === "OK" && Array.isArray(results) && results[0]?.formatted_address) {
              resolve(results[0].formatted_address);
            } else {
              resolve(null);
            }
          });
        });

        if (addr) {
          geocodeCacheRef.current.set(key, addr);
          setGeoAddrMap((prev) => (prev[key] ? prev : { ...prev, [key]: addr }));
        }

        return addr;
      } catch {
        return null;
      }
    },
    [geoAddrMap]
  );

  const ensureCurrentAddressForVehicle = useCallback(
    async (veh) => {
      const pos = getLatLng(veh);
      if (!pos) return;
      await reverseGeocode(pos);
    },
    [reverseGeocode]
  );

  // added new line end

  /* ======================
     ✅ Status filter: SINGLE SELECT
  ====================== */
  const ALL_STATUS = useMemo(() => ({ running: true, idle: true, parked: true, nodata: true }), []);
  const STATUS_KEYS = useMemo(() => ["running", "idle", "parked", "nodata"], []);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUS);


  // hydrate effect local start 

  // ✅ NOW add hydrate effect here (after states exist)
// useEffect(() => {
//   const saved = loadAppliedFilters();
//   if (saved) {
//     setMode(saved.mode);
//     // setFromDate(saved.fromDate);
//     // setToDate(saved.toDate);

//     setFromDate(todayYYYYMMDD());
//     setToDate(todayYYYYMMDD());
//     dispatch(setSelectedVendor(saved.selectedVendor));
//     setTypeFilter(saved.typeFilter);
//     setVehNoFilter(saved.vehNoFilter);
//     setStatusFilter(saved.statusFilter);
//   }
//   hydratedRef.current = true;
// }, [dispatch]);

// useEffect(() => {
//   const saved = loadAppliedFilters();
//   const t = todayYYYYMMDD();

//   if (saved) {
//     setMode(saved.mode);
//     setFromDate(t);          // ✅ always today
//     setToDate(t);            // ✅ always today
//     dispatch(setSelectedVendor(saved.selectedVendor));
//     setTypeFilter(saved.typeFilter);
//     setVehNoFilter(saved.vehNoFilter);
//     setStatusFilter(saved.statusFilter);
//   } else {
//     // ✅ first load / no saved filters
//     setFromDate(t);
//     setToDate(t);
//   }

//   hydratedRef.current = true;
// }, [dispatch]);


useEffect(() => {
  const saved = loadAppliedFilters();
  const t = todayYYYYMMDD();

  // ✅ Always start as All Vendors
  dispatch(setSelectedVendor("all"));

  if (saved) {
    setMode(saved.mode);
    setFromDate(t);
    setToDate(t);

    // ❌ Do NOT apply saved vendor at startup
    // dispatch(setSelectedVendor(saved.selectedVendor));

    setTypeFilter(saved.typeFilter);
    setVehNoFilter(saved.vehNoFilter);
    setStatusFilter(saved.statusFilter);
  } else {
    setFromDate(t);
    setToDate(t);
  }

  // ✅ Keep filters open at startup
  setShowFilters(true);

  hydratedRef.current = true;
}, [dispatch]);


// useEffect(() => {
//   if (!hydratedRef.current) return;

//   saveAppliedFilters({
//     mode,
//     fromDate,
//     toDate,
//     selectedVendor,
//     typeFilter,
//     vehNoFilter,
//     statusFilter,
//   });
// }, [mode, fromDate, toDate, selectedVendor, typeFilter, vehNoFilter, statusFilter]);

  useEffect(() => {
  if (!hydratedRef.current) return;

  // ✅ save only necessary values (no dates)
  saveAppliedFilters({
    mode,
    selectedVendor,
    typeFilter,
    vehNoFilter,
    statusFilter,
  });
}, [mode, selectedVendor, typeFilter, vehNoFilter, statusFilter]);


// hydrate effect local end 

  const setSingleStatus = useCallback(
    (key) => {
      setStatusFilter((prev) => {
        const isOnlyThisSelected = STATUS_KEYS.every((k) => (k === key ? !!prev[k] : !prev[k]));
        if (isOnlyThisSelected) return ALL_STATUS;
        return { running: false, idle: false, parked: false, nodata: false, [key]: true };
      });
    },
    [ALL_STATUS, STATUS_KEYS]
  );

  // const isHistoryMode = mode === "History";
  // const showVehicles = mode !== "History";
  // const showLines = mode === "Live All" || mode === "History";
  // const isLiveAll = mode === "Live All";


  const isLiveAll = mode === "Live All";
const isLiveOnly = mode === "Live Only";
const isHistoryMode = mode === "History";

// ✅ Vehicles only in Live modes
// const showVehicles = isLiveAll || isLiveOnly;

const showVehicles = mode === "Live All" || mode === "Live Only";

// ✅ Polylines only in Live All + History
const showLines = isLiveAll || isHistoryMode;




  // useEffect(() => {
  //   dispatch(startPolling());
  //   return () => dispatch(stopPolling());
  // }, [dispatch]);



  const shouldUseApi = useMemo(() => {
  // Live modes -> API
  if (mode === "Live All" || mode === "Live Only") return true;

  // History mode
  if (mode === "History") {
    // If toDate is today or later -> still API
    return isCurrentDateView(fromDate, toDate);
  }

  return true;
}, [mode, fromDate, toDate]);

useEffect(() => {
  if (!shouldUseApi) {
    dispatch(stopPolling());   // ✅ ensure polling OFF
    return;
  }

  dispatch(startPolling());
  return () => dispatch(stopPolling());
}, [dispatch, shouldUseApi]);
  

  useEffect(() => {
    if (isHistoryMode) dispatch(setActive(null));
  }, [isHistoryMode, dispatch]);

  const [dashOffset, setDashOffset] = useState(0);
  useEffect(() => {
    if (!showMovingFlow) return;
    const id = setInterval(() => setDashOffset((v) => (v + 8) % 4000), 40);
    return () => clearInterval(id);
  }, [showMovingFlow]);

  /* ✅ Vendor filtering WITHOUT cloning objects */
  // const visibleVehiclesVendorOnly = useMemo(() => {
  //   const arr = Array.isArray(allVehicles) ? allVehicles : [];
  //   // if (selectedVendor === "all") return arr;
  //   // return arr.filter((v) => getSource(v) === selectedVendor);
  //   if (selectedVendor === "all") return arr;
  //  return arr.filter((v) => getSource(v) === selectedVendor);

  // // }, [allVehicles, selectedVendor]);

  // }, [allVehicles, effVendor]);

  const visibleVehiclesVendorOnly = useMemo(() => {
  const arr = Array.isArray(allVehicles) ? allVehicles : [];
  if (selectedVendor === "all") return arr;
  return arr.filter((v) => getSource(v) === selectedVendor);
}, [allVehicles, selectedVendor]);


  // ✅ IMPORTANT: deferred to avoid cancel loop during polling
  const deferredVendorVehicles = useDeferredValue(visibleVehiclesVendorOnly);

  /* =========================================================
     ✅ movingSet + vendorIconUrlBySource
  ======================================================== */
  const movingSet = useMemo(() => new Set(Object.keys(movingMap || {})), [movingMap]);

  const vendorIconUrlBySource = useMemo(() => {
    const sources = [
      "jtrack1",
      "jtrack2",
      "batch",
      "vecv",
      "gpstrack",
      "ialert2",
      "fleetx",
      "vamosys",
    ];
    const out = {};
    for (const s of sources) out[s] = getVendorTruckIconStatic(getVendorColor(s), 58);
    return out;
  }, []);

  /* =========================================================
     ✅ dropdown base should be deduped and stable
  ======================================================== */
  function buildVehicleIdentitySig(list) {
    const arr = Array.isArray(list) ? list : [];
    const keys = [];
    for (const v of arr) {
      const src = getSource(v);
      const k = getVehicleKey(v) || normalizeRegNo(getRegText(v)) || "";
      if (k) keys.push(`${src}:${k}`);
    }
    keys.sort();
    return `${arr.length}|${keys.slice(0, 220).join(";")}`;
  }

  const vendorIdentitySig = useMemo(
    () => buildVehicleIdentitySig(deferredVendorVehicles),
    [deferredVendorVehicles]
  );

  const dropdownBaseVehicles = useMemo(() => {
    return dedupeVehiclesByRegNo(deferredVendorVehicles);
  }, [vendorIdentitySig]);

  // ✅ cascading reg list
//   const dropdownVehiclesForRegNo = useMemo(() => {
//     // if (!typeFilter || typeFilter === "Type") return dropdownBaseVehicles;
//     // return dropdownBaseVehicles.filter((v) => String(getTypeText(v) || "").trim() === typeFilter);

//     if (!effType || effType === "Type") return dropdownBaseVehicles;
// return dropdownBaseVehicles.filter((v) => String(getTypeText(v) || "").trim() === effType);


//   // }, [dropdownBaseVehicles, typeFilter]);

//   }, [dropdownBaseVehicles, effType]);


  const dropdownVehiclesForRegNo = useMemo(() => {
  if (!optType || optType === "Type") return dropdownBaseVehicles;
  return dropdownBaseVehicles.filter((v) => String(getTypeText(v) || "").trim() === optType);
}, [dropdownBaseVehicles, optType]);


  /* =========================================================
     OPTIONS BUILD (FIXED)
  ======================================================== */
  const [typeOptions, setTypeOptions] = useState([]);
  const [vehNoOptions, setVehNoOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // ✅ build dropdown options ONLY when user actually opens/focuses dropdown
const [optionsTouched, setOptionsTouched] = useState(false);

// const clearDropdownCache = useCallback(() => {
//   setTypeOptions([]);
//   setVehNoOptions([]);
//   setOptionsLoading(false);
//   setOptionsTouched(false);
//   lastOptionsSigRef.current = "";
// }, []);


  // Added new lines - recent - loading issues 

  // ✅ Ensure dropdown options exist immediately on click/focus (no waiting)
const ensureOptionsNow = useCallback(() => {
  setOptionsTouched(true); // ✅ user opened dropdown => now allowed to build

  if (optionsLoading) return;

  // if already built, do nothing
  if (typeOptions.length > 0 && vehNoOptions.length > 0) return;


  const baseList = Array.isArray(dropdownBaseVehicles) ? dropdownBaseVehicles : [];
  const regList = Array.isArray(dropdownVehiclesForRegNo) ? dropdownVehiclesForRegNo : [];

  if (baseList.length === 0) {
    setOptionsLoading(false);
    return;
  }

  const typeSet = new Set();
  const regMap = new Map();

  // ✅ Quick sync build (capped) so click opens with options immediately
  const limit = Math.min(baseList.length, 4000);
  for (let i = 0; i < limit; i += 1) {
    const v = baseList[i];
    const tv = String(getTypeText(v) || "").trim();
    if (tv) typeSet.add(tv);
    if (typeSet.size >= MAX_OPTIONS) break;
  }

  for (let j = 0; j < regList.length; j += 1) {
    const v = regList[j];
    const rv = String(getRegText(v) || "").trim();
    if (!rv) continue;

    const src = getSource(v);
    const vendorName = SOURCE_META?.[src]?.name || src;

    // if (selectedVendor === "all") {
    //   const value = `${src}::${rv}`;
    //   const label = `${rv} (${vendorName})`;
    //   regMap.set(value, label);
    // } else {
    //   regMap.set(rv, rv);
    // }

    if (optVendor === "all") {
  const value = `${src}::${rv}`;
  const label = `${rv} (${vendorName})`;
  regMap.set(value, label);
} else {
  regMap.set(rv, rv);
}

    if (regMap.size >= MAX_OPTIONS) break;
  }

  setTypeOptions(Array.from(typeSet).sort((a, b) => a.localeCompare(b)));
  setVehNoOptions(
    Array.from(regMap.entries())
      .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
      .map(([value, label]) => ({ value, label }))
  );

// }, [
//   optionsLoading,
//   typeOptions.length,
//   vehNoOptions.length,
//   dropdownBaseVehicles,
//   dropdownVehiclesForRegNo,
//   selectedVendor
// ]);

}, [
  optionsLoading,
  typeOptions.length,
  vehNoOptions.length,
  dropdownBaseVehicles,
  dropdownVehiclesForRegNo,
  optVendor
]);

  // const optionsSignature = useMemo(
  //   () => buildOptionsSignatureStable(dropdownBaseVehicles, `${effVendor}|${effType}`),
  //   [dropdownBaseVehicles, selectedVendor, typeFilter]
  // );
  // const lastOptionsSigRef = useRef("");

const optionsSignature = useMemo(
  () => buildOptionsSignatureStable(dropdownBaseVehicles, `${optVendor}|${optType}`),
  [dropdownBaseVehicles, optVendor, optType]
);

  const lastOptionsSigRef = useRef("");

  useEffect(() => {
  // ✅ IMPORTANT: don't build dropdown options while map is loading
  if (!optionsTouched) {
    setOptionsLoading(false);
    return;
  }

  if (optionsSignature === lastOptionsSigRef.current) return;
  lastOptionsSigRef.current = optionsSignature;

  let cancelled = false;
  let idleId = null;

    const baseList = Array.isArray(dropdownBaseVehicles) ? dropdownBaseVehicles : [];
    const regList = Array.isArray(dropdownVehiclesForRegNo) ? dropdownVehiclesForRegNo : [];

    if (baseList.length === 0) {
      setTypeOptions([]);
      setVehNoOptions([]);
      setOptionsLoading(false);
      return () => {};
    }

    setOptionsLoading(true);

    const typeSet = new Set();
    const regMap = new Map();

    let idx = 0;
    const CHUNK = 1200; // ✅ safer on slower machines

    const work = () => {
      if (cancelled) return;

      const end = Math.min(idx + CHUNK, baseList.length);
      for (; idx < end; idx += 1) {
        const v = baseList[idx];
        const tv = String(getTypeText(v) || "").trim();
        if (tv) typeSet.add(tv);
      }

      if (idx < baseList.length) {
        idleId = idle(work);
        return;
      }

      for (let j = 0; j < regList.length; j += 1) {
        const v = regList[j];
        const rv = String(getRegText(v) || "").trim();
        if (!rv) continue;

        const src = getSource(v);
        const vendorName = SOURCE_META?.[src]?.name || src;

    if (optVendor === "all") {
  const value = `${src}::${rv}`;
  const label = `${rv} (${vendorName})`;
  regMap.set(value, label);
} else {
  regMap.set(rv, rv);
}

      }

      if (cancelled) return;

      const typeArr = Array.from(typeSet).sort((a, b) => a.localeCompare(b));
      const regArr = Array.from(regMap.entries())
        .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
        .map(([value, label]) => ({ value, label }));

      setTypeOptions(typeArr);
      setVehNoOptions(regArr);
      setOptionsLoading(false);
    };

    // ✅ Run first chunk immediately so dropdown gets data fast (no idle wait)
    work();

// ✅ Continue remaining chunks in idle (only if still pending)
if (!cancelled && idx < baseList.length) {
  idleId = idle(work);
}

    return () => {
      cancelled = true;
      if (idleId) cancelIdle(idleId);
    };
    }, [optionsSignature, optVendor, dropdownBaseVehicles, dropdownVehiclesForRegNo]);
    
  const typeOptionsLimited = useMemo(() => typeOptions.slice(0, MAX_OPTIONS), [typeOptions]);
  const vehNoOptionsLimited = useMemo(() => vehNoOptions.slice(0, MAX_OPTIONS), [vehNoOptions]);

  // ✅ If Type changed and current RegNo not in list => reset
  useEffect(() => {
    if (!vehNoFilter || vehNoFilter === "Vehicle Number") return;
    const exists = (vehNoOptions || []).some((o) => o.value === vehNoFilter);
    if (!exists) setVehNoFilter("Vehicle Number");
  }, [typeFilter, vehNoOptions, vehNoFilter]);

  /* =========================================================
     Visible vehicles (filters) + dedupe
  ======================================================== */
  const visibleVehicles = useMemo(() => {
    let arr = visibleVehiclesVendorOnly;

    // const skipDateFilter = isCurrentDateView(fromDate, toDate);

    const skipDateFilter = isCurrentDateView(effFromDate, effToDate);

    if (!skipDateFilter) {
      arr = arr.filter((v) => {
        const src = getSource(v);
        // const key = getVehicleKey(v) || "";
        const keySafe = getTrackKeySafe(v);

        const dt = pickFirst(
          v,
          ["gps_datetime", "datetime", "ts", "lastUpdated", "epochTime", "time", "timestamp"],
          ""
        );

        // if (inDateRange(dt, fromDate, toDate)) return true;

        if (inDateRange(dt, effFromDate, effToDate)) return true;

        // const trackArr = tracksBySource?.[src]?.[key] || [];
        const trackArr = tracksBySource?.[src]?.[keySafe] || [];

        // return trackHasPointInRange(trackArr, fromDate, toDate);

        return trackHasPointInRange(trackArr, effFromDate, effToDate);
      });
    }

    // if (typeFilter && typeFilter !== "Type") {
    //   arr = arr.filter((v) => String(getTypeText(v) || "").trim() === typeFilter);
    // }

if (effType && effType !== "Type") {
  arr = arr.filter((v) => String(getTypeText(v) || "").trim() === effType);
}

if (vehNoFilter && vehNoFilter !== "Vehicle Number") {
  arr = arr.filter((v) => {
    const rv = String(getRegText(v) || "").trim();
    const src = getSource(v);

    if (effVendor === "all" && vehNoFilter.includes("::")) {
      const [s0, reg0] = vehNoFilter.split("::");
      return src === s0 && rv === reg0;
    }
    return rv === vehNoFilter;
  });
}

    arr = arr.filter((v) => {
      const st = getVehicleStatus({ v, movingMap });
      return !!statusFilter?.[st];
    });

    return arr;
  }, [
  visibleVehiclesVendorOnly,
  effFromDate,
  effToDate,
  effType,
  vehNoFilter,
  effVendor,
  movingMap,
  statusFilter,
  tracksBySource,
]);


  const visibleVehiclesDeduped = useMemo(
    () => dedupeVehiclesByRegNo(visibleVehicles),
    [visibleVehicles]
  );

  // ✅ prevents heavy marker/polyline loop before browser paints
const vehiclesToRender = useMemo(
  () => (modeReady ? visibleVehiclesDeduped : []),
  [modeReady, visibleVehiclesDeduped]
);


  // ✅ Auto-perf mode: native markers when huge list
  // ✅ lowered threshold so 500+ reliably renders
  // const useSimpleMarkers = useMemo(() => {
  //   return visibleVehiclesDeduped.length >= 200;
  // }, [visibleVehiclesDeduped.length]);

  const useSimpleMarkers = useMemo(() => {
//   return visibleVehiclesDeduped.length >= 80;
// return visibleVehiclesDeduped.length >= 30;

  return visibleVehiclesDeduped.length >= 150; // or 200

  
}, [visibleVehiclesDeduped.length]);


  const summaryCounts = useMemo(() => {
    const list = Array.isArray(visibleVehicles) ? visibleVehicles : [];

    let total = 0;
    let moving = 0;
    let idleCount = 0;
    let noDataCount = 0;

    for (const v of list) {
      total += 1;

      const st = getVehicleStatus({ v, movingMap });

      if (st === "running") moving += 1;
      else if (st === "nodata") noDataCount += 1;
      else idleCount += 1; // idle + parked
    }

    return {
      total,
      moving,
      idle: idleCount,
      nodata: noDataCount,
    };
  }, [visibleVehicles, movingMap]);

  // Fetch zone and ward KML and parse once (for zone-crossing detection)
  // ✅ ZONE CROSSING COMMENTED OUT
  // useEffect(() => {
  //   const zoneUrl = `${kmlBaseUrl}/ZONE_2022.kml`;
  //   const wardUrl = `${kmlBaseUrl}/WARD_2022.kml`;
  //   
  //   Promise.all([
  //     fetch(zoneUrl).then((r) => r.text()).then((text) => parseKmlZones(text)).catch(() => []),
  //     fetch(wardUrl).then((r) => r.text()).then((text) => parseKmlZones(text)).catch(() => []),
  //   ]).then(([parsedZones, parsedWards]) => {
  //     setZones(parsedZones);
  //     setWards(parsedWards);
  //   });
  // }, [kmlBaseUrl]);

  // Request browser notification permission once (for zone-crossing alerts)
  // ✅ ZONE CROSSING COMMENTED OUT
  // useEffect(() => {
  //   if (typeof Notification === "undefined" || zoneNotificationPermissionRef.current !== null) return;
  //   if (Notification.permission === "default") {
  //     Notification.requestPermission().then((p) => {
  //       zoneNotificationPermissionRef.current = p;
  //     });
  //   } else {
  //     zoneNotificationPermissionRef.current = Notification.permission;
  //   }
  // }, []);

  // Zone-crossing: when a vehicle moves from one zone/ward to another (or in/out), show notification
  // ✅ ZONE CROSSING COMMENTED OUT
  // useEffect(() => {
  //   if (!showVehicles || zones.length === 0 || !Array.isArray(vehiclesToRender)) return;
  //   const prev = lastZoneByKeyRef.current; // key -> { zone, ward, location }
  //   const toasts = [];
  //
  //   for (const v of vehiclesToRender) {
  //     const pos = getLatLng(v);
  //     if (!pos) continue;
  //
  //     const key = getTrackKeySafe(v);
  //     if (!key) continue;
  //
  //     const reg = String(getRegText(v) || key).trim().toUpperCase();
  //
  //     const newZone = getZoneForPoint(pos.lat, pos.lng, zones);
  //     const newWard = getWardForPoint(pos.lat, pos.lng, wards);
  //     
  //     // ✅ Get CURRENT location and place information (where vehicle is NOW)
  //     const posNow = getLatLng(v);
  //     const geoKey = posNow ? makeGeoKey(posNow) : "";
  //     const currentLocation = geoKey ? (geoAddrMap[geoKey] || "") : "";
  //     const dropPlace = pickFirstDeepAny(v, ["Drop Place", "DropPlace", "drop_place", "drop_location", "drop_address"], "");
  //     const newLocation = currentLocation || dropPlace || "-";
  //
  //     const prevInfo = prev[key]; // { zone, ward, location }
  //
  //     // Only notify when we have a previous zone/ward and it changed
  //     if (
  //       prevInfo &&
  //       (prevInfo.zone !== newZone || prevInfo.ward !== newWard)
  //     ) {
  //       const fromZone = prevInfo.zone || "Outside";
  //       const fromWard = prevInfo.ward || "-";
  //       const toZone = newZone || "Outside";
  //       const toWard = newWard || "-";
  //       
  //       // ✅ fromLocation = where vehicle WAS (previous location from last update)
  //       // ✅ toLocation = where vehicle IS NOW (current location)
  //       const fromLocation = prevInfo.location || "-";
  //       const toLocation = newLocation;
  //
  //       const msg = `${reg} crossed: Zone ${fromZone}${fromWard !== "-" ? `, Ward ${fromWard}` : ""} → Zone ${toZone}${toWard !== "-" ? `, Ward ${toWard}` : ""}`;
  //
  //       toasts.push({
  //         id: `${key}-${Date.now()}-${Math.random()}`,
  //         reg,
  //         fromZone,
  //         fromWard,
  //         toZone,
  //         toWard,
  //         fromLocation,
  //         toLocation,
  //       });
  //
  //       if (typeof Notification !== "undefined" && Notification.permission === "granted") {
  //         try {
  //           new Notification("Zone crossed", { body: msg });
  //         } catch (_) {}
  //       }
  //       if (zoneNotificationPermissionRef.current === null && typeof Notification !== "undefined") {
  //         zoneNotificationPermissionRef.current = Notification.permission;
  //       }
  //     }
  //
  //     // ✅ ALWAYS update: zone/ward/location for next cycle (even if no zone change)
  //     // This ensures we capture the location at each position update
  //     prev[key] = { 
  //       zone: newZone, 
  //       ward: newWard,
  //       location: newLocation  // ✅ Store current location for next comparison
  //     };
  //   }
  //
  //   if (toasts.length > 0) {
  //     setZoneCrossingToasts((t) => [...t.slice(-4), ...toasts].slice(-8));
  //   }
  // }, [showVehicles, zones, wards, vehiclesToRender, geoAddrMap]);

  // Remove zone crossing toast notification
  // ✅ ZONE CROSSING COMMENTED OUT
  // const removeZoneToast = useCallback((id) => {
  //   setZoneCrossingToasts((t) => t.filter((x) => x.id !== id));
  // }, []);

  // const locateOnMap = useCallback(
  //   (veh) => {
  //     if (!veh) return;

  //     const pos = getLatLng(veh);
  //     const keySafe = getVehicleKey(veh);
  //     const src = getSource(veh);

        const locateOnMap = useCallback(
    (veh) => {
      if (!veh) return;

      // ✅ always fetch current address for popup (all vendors)
      ensureCurrentAddressForVehicle(veh);

      const pos = getLatLng(veh);
      const keySafe = getTrackKeySafe(veh);
      const src = getSource(veh);

      dispatch(
        setActive({
          source: src,
          trackKey: keySafe,
          lat: pos?.lat,
          lng: pos?.lng,
        })
      );

      const map = mapRef.current;
      if (map && pos) {
        map.panTo(pos);
        map.setZoom(16);
      }

      const trackArr = tracksBySource?.[src]?.[keySafe] || [];
      if (map && Array.isArray(trackArr) && trackArr.length >= 2) {
        const pts = trackArr
          .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
          .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

        const path = downsamplePath(pts, denseMode ? 320 : 220);
        if (path.length >= 2) fitBoundsForPath(map, path);
      }
    },
   [dispatch, tracksBySource, denseMode, ensureCurrentAddressForVehicle]
  );

  const activeVehicle = useMemo(() => {
    if (!active?.source || !active?.trackKey) return null;
    const list = Array.isArray(visibleVehiclesDeduped) ? visibleVehiclesDeduped : [];
    return (
list.find((v) => getSource(v) === active.source && getTrackKeySafe(v) === active.trackKey)    );
  }, [active, visibleVehiclesDeduped]);

  // ✅ auto zoom when selecting/clearing active vehicle
useEffect(() => {
  setMapZoom(activeVehicle ? 16 : 12);
}, [activeVehicle]);

  const activePos = useMemo(() => (activeVehicle ? getLatLng(activeVehicle) : null), [activeVehicle]);

  const activeTrack = useSelector((s) => {
    if (!active?.source || !active?.trackKey) return [];
    return selectTrack(s, active.source, active.trackKey);
  });

  const activePath = useMemo(() => {
    const pts = (activeTrack || [])
      .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    return downsamplePath(pts, 220);
  }, [activeTrack, trackTick]);

  const activeColor = activeVehicle ? getVendorColor(getSource(activeVehicle)) : "#1565C0";
  const activeStartEnd = useMemo(() => getStartEndFromPath(activePath), [activePath]);

  // const effectiveShowAllPolylines = isHistoryMode ? true : showAllPolylines;

  // ✅ Polylines allowed ONLY when showLines is true
// const effectiveShowAllPolylines = showLines;

// ✅ respect UI toggle in Live modes; History always ok
const effectiveShowAllPolylines = isHistoryMode ? true : showAllPolylines;


//   const allVehiclePolylines = useMemo(() => {
//     if (!showLines) return [];

//     if (!effectiveShowAllPolylines && !isHistoryMode) return [];

      
//     const maxPts = denseMode ? 320 : 180;
//     const out = [];

//     // for (const v of visibleVehiclesDeduped) {

//     const polylineVehicles =
//   isHistoryMode && activeVehicle
//     ? [activeVehicle]       // ✅ ONLY ONE vehicle in History
//     : visibleVehiclesDeduped;

// for (const v of polylineVehicles) {
      
//       const src = getSource(v);
//       const key = getVehicleKey(v);
//       if (!src || !key) continue;

//       const trackArr = tracksBySource?.[src]?.[key] || [];
//       if (!Array.isArray(trackArr) || trackArr.length < 2) continue;

//       const pts = trackArr
//         .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
//         .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
//       if (pts.length < 2) continue;

//       const path = downsamplePath(pts, maxPts);
//       if (path.length < 2) continue;

//       const { start, end } = getStartEndFromPath(path);

//       out.push({
//         id: `${src}:${key}`,
//         src,
//         key,
//         path,
//         start,
//         end,
//         color: getVendorColor(src),
//       });
//     }

//     return out;
//   }, [
//     showLines,
//     effectiveShowAllPolylines,
//     isHistoryMode,
//     denseMode,
//     visibleVehiclesDeduped,
//     tracksBySource,
//   ]);

//   const allVehiclePolylines = useMemo(() => {
//   if (!showLines) return [];

//   const maxPts = denseMode ? 320 : 180;

//   // ✅ If NOT showAllPolylines (in Live All), show only active vehicle polyline
//   const polylineVehicles =
//     isHistoryMode
//       ? (activeVehicle ? [activeVehicle] : [])
//       // : (effectiveShowAllPolylines ? visibleVehiclesDeduped : (activeVehicle ? [activeVehicle] : []));
//       : (effectiveShowAllPolylines ? vehiclesToRender : (activeVehicle ? [activeVehicle] : []));


//   const out = [];

//   for (const v of polylineVehicles) {
//     const src = getSource(v);
//     const key = getVehicleKey(v);
//     if (!src || !key) continue;

//     const trackArr = tracksBySource?.[src]?.[key] || [];
//     if (!Array.isArray(trackArr) || trackArr.length < 2) continue;

//     const pts = trackArr
//       .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
//       .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
//     if (pts.length < 2) continue;

//     const path = downsamplePath(pts, maxPts);
//     if (path.length < 2) continue;

//     const { start, end } = getStartEndFromPath(path);

//     out.push({
//       id: `${src}:${key}`,
//       src,
//       key,
//       path,
//       start,
//       end,
//       color: getVendorColor(src),
//     });
//   }

//   return out;
// }, [
//   showLines,
//   denseMode,
//   isHistoryMode,
//   effectiveShowAllPolylines,
//   // visibleVehiclesDeduped,
//   vehiclesToRender,
//   tracksBySource,
//   activeVehicle,
// ]);

const allVehiclePolylines = useMemo(() => {
  if (!showLines) return [];

  const maxPts = denseMode ? 320 : 180;

  // ✅ History: keep performance (cap polylines), but still show history routes
  // ✅ Live All: show all polylines only when toggle is ON; else only active
  let polylineVehicles;

  if (isHistoryMode) {
    // If user clicked a vehicle, prioritize that single one (fastest)
    if (activeVehicle) {
      polylineVehicles = [activeVehicle];
    } else {
      // otherwise cap to avoid slowing JTrack-1
      polylineVehicles = vehiclesToRender.slice(0, MAX_HISTORY_POLYLINES);
    }
  } else {
    polylineVehicles = effectiveShowAllPolylines
      ? vehiclesToRender
      : (activeVehicle ? [activeVehicle] : []);
  }

  const out = [];

  for (const v of polylineVehicles) {
    const src = getSource(v);
   const key = getTrackKeySafe(v);
    if (!src || !key) continue;

    const trackArr = tracksBySource?.[src]?.[key] || [];
    if (!Array.isArray(trackArr) || trackArr.length < 2) continue;

    const pts = trackArr
      .map((p) => ({ lat: Number(p?.lat), lng: Number(p?.lng) }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

    if (pts.length < 2) continue;

    const path = downsamplePath(pts, maxPts);
    if (path.length < 2) continue;

    const { start, end } = getStartEndFromPath(path);

    out.push({
      id: `${src}:${key}`,
      src,
      key,
      path,
      start,
      end,
      color: getVendorColor(src),
    });
  }

  return out;
}, [
  showLines,
  denseMode,
  isHistoryMode,
  effectiveShowAllPolylines,
  vehiclesToRender,
  tracksBySource,
  activeVehicle,
]);


  if (loadError) {
    return (
      <div style={pageScaleStyle}>
        <Container className="py-3">
          <Alert variant="danger" className="mb-0">
            Google Maps load error
          </Alert>
        </Container>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={pageScaleStyle}>
        <Container className="py-3">{/* Loading map… */}</Container>
      </div>
    );
  }


  return (
  //  <div style={{ ...pageScaleStyle, height: "100vh", overflowY: "auto", overflowX: "hidden" }}>

      <div
  style={{
    ...pageScaleStyle,
    height: "100vh",
    overflow: "hidden",   // 🚫 no vertical or horizontal scroll
  }}
>
        {/* Zone crossing notifications - COMMENTED OUT */}
        {/* ✅ ZONE CROSSING COMMENTED OUT */}
        {/* <ToastContainer position="top-end" className="p-3" style={{ zIndex: 10000 }}>
          {zoneCrossingToasts.map((t) => (
            <Toast key={t.id} onClose={() => removeZoneToast(t.id)} autohide delay={8000} show>
              <Toast.Header closeButton>
                <strong className="me-auto">Zone crossed</strong>
              </Toast.Header>
              <Toast.Body style={{ fontSize: 12 }}>
                <div className="mb-2">
                  <strong>{t.reg}</strong>
                  <br />
                  From: Zone {t.fromZone}{t.fromWard && t.fromWard !== "-" ? `, Ward ${t.fromWard}` : ""}
                  <br />
                  To:&nbsp;&nbsp;&nbsp;&nbsp;Zone {t.toZone}{t.toWard && t.toWard !== "-" ? `, Ward ${t.toWard}` : ""}
                </div>
                <div className="border-top pt-2 mt-2">
                  <div className="mb-1">
                    <strong>Actual Location:</strong>
                    <br />
                    {t.toLocation || "-"}
                  </div>
                  <div className="mb-1">
                    <strong>Deviated Place:</strong>
                    <br />
                    {t.fromLocation || "-"}
                  </div>
                </div>
              </Toast.Body>
            </Toast>
          ))}
        </ToastContainer> */}
<Container fluid className="py-2">

{/* <div className="row g-3 mb-3">
<div className="col-2">
  <Card
    className="border-0"
    style={{
      borderRadius: 12,
      background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
      border: "1px solid rgba(15,23,42,0.10)",
      boxShadow: "0 6px 14px rgba(15,23,42,0.08)",
      padding: "8px 10px",
    }}
  >
    <div
      style={{
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.2,
        color: "rgba(15,23,42,0.95)",
        lineHeight: "18px",
      }}
    >
      Vehicle Live GPS Tracking
    </div>

    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "rgba(100,116,139,0.95)",
        marginTop: 2,
      }}
    >
      Live / History • Vendor • Type • Vehicle
    </div>
  </Card>
</div>

          {[
            {
              title: "Total Vehicles",
              value: summaryCounts.total,
              chip: isHistoryMode ? "History" : "Live",
              chipText: "primary",
              bg: "linear-gradient(135deg, rgba(26,115,232,1) 0%, rgba(77,160,255,1) 55%, rgba(140,198,255,1) 100%)",
              sub: "Fleet status",
              bar: 0.72,
            },
            {
              title: "Running Vehicles",
              value: summaryCounts.moving,
              chip: "Now",
              chipText: "success",
              bg: "linear-gradient(135deg, rgba(16,185,129,1) 0%, rgba(47,185,140,1) 55%, rgba(126,231,168,1) 100%)",
              sub: "In motion",
              bar: 0.6,
            },
            {
              title: "Idle Vehicles",
              value: summaryCounts.idle,
              chip: "Now",
              chipText: "danger",
              bg: "linear-gradient(135deg, rgba(239,68,68,1) 0%, rgba(244,114,182,1) 55%, rgba(253,164,175,1) 100%)",
              sub: "Stopped",
              bar: 0.45,
            },
            {
              title: "No Data Vehicles",
              value: summaryCounts.nodata,
              chip: "Alert",
              chipText: "dark",
              bg: "linear-gradient(135deg, rgba(100,116,139,1) 0%, rgba(148,163,184,1) 55%, rgba(203,213,225,1) 100%)",
              sub: "No GPS",
              bar: 0.35,
            },
          ].map((c) => (
     <div className="col-2" key={c.title} xs={12} lg={3}>
            <Card
  className="border-0 text-white"
  style={{
    borderRadius: 18,
    background: c.bg,
    overflow: "hidden",
    minHeight: 20, // 👈 real reduction
    boxShadow: "0 12px 28px rgba(15,23,42,.12)",
    position: "relative",
  }}
>

  <div
    style={{
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(700px 180px at 10% 0%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 55%)",
      pointerEvents: "none",
    }}
  />

  <Card.Body style={{ padding: "5px 8px", position: "relative" }}>
    <div className="d-flex justify-content-between align-items-start">
      <div>
        <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.95 }}>
          {c.title}
        </div>

        <div
          style={{
            fontSize: 20,      // ⬇ was 52
            fontWeight: 900,
            lineHeight: "34px",
            marginTop: 2,
            letterSpacing: 0.3,
          }}
        >
          {c.value}
        </div>

      
      </div>

      <Badge
        bg="light"
        text={c.chipText}
        pill
        style={{
          fontSize: 10,
          padding: "4px 8px",
          borderRadius: 999,
          boxShadow: "0 6px 12px rgba(0,0,0,.12)",
          fontWeight: 800,
        }}
      >
        {c.chip}
      </Badge>
    </div>
  </Card.Body>
</Card>


            </div>
          ))}

    <div className="col-2">
    <div className="d-flex align-items-center gap-2">
        <Badge bg="light" text="dark" pill style={{ fontSize: 10, fontWeight: 800 }}>
          {fromDate} → {toDate}
        </Badge>

      <Button
        size="sm"
        variant="light"
        onClick={openFilters}
        style={{
          border: "1px solid #BFDBFE",   // light blue
          backgroundColor: "#EFF6FF",    // very soft blue
        }}
      >
        <i className="bi bi-list fs-5" style={{ color: "#2563EB" }}></i>
      </Button>
      </div>
  </div>



</div> */}


<div className="row g-2 mb-3">
  {/* 1) Title Card */}
  <div className="col-12 col-md-6 col-lg-2">
    <Card
      className="border-0 h-100"
      style={{
        borderRadius: 14,
        background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
        border: "1px solid rgba(15,23,42,0.10)",
        boxShadow: "0 6px 14px rgba(15,23,42,0.08)",
      }}
    >
      <Card.Body className="p-2">
        <div
          style={{
            fontSize: "12px",
            fontWeight: 900,
            letterSpacing: 0.2,
            color: "rgba(15,23,42,0.95)",
            lineHeight: 1.2,
          }}
        >
          Vehicle Live GPS Tracking
        </div>

        <div
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color: "rgba(100,116,139,0.95)",
            marginTop: 4,
          }}
        >
          Live / History • Vendor • Type • Vehicle
        </div>
      </Card.Body>
    </Card>
  </div>

  {/* 2) Total Vehicles */}
  <div className="col-12 col-md-6 col-lg-2">
    <Card
      className="border-0 text-white h-100"
      style={{
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(26,115,232,1) 0%, rgba(77,160,255,1) 55%, rgba(140,198,255,1) 100%)",
        boxShadow: "0 12px 28px rgba(15,23,42,.12)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(700px 180px at 10% 0%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 55%)",
          pointerEvents: "none",
        }}
      />
      <Card.Body className="p-2" style={{ position: "relative" }}>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.95 }}>
              Total Vehicles
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: "24px", marginTop: 2 }}>
              {summaryCounts.total}
            </div>
          </div>

          <Badge
            bg="light"
            text="primary"
            pill
            style={{ fontSize: 10, padding: "4px 8px", fontWeight: 800 }}
          >
            {isHistoryMode ? "History" : "Live"}
          </Badge>
        </div>
      </Card.Body>
    </Card>
  </div>

  {/* 3) Running Vehicles */}
  <div className="col-12 col-md-6 col-lg-2">
    <Card
      className="border-0 text-white h-100"
      style={{
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(16,185,129,1) 0%, rgba(47,185,140,1) 55%, rgba(126,231,168,1) 100%)",
        boxShadow: "0 12px 28px rgba(15,23,42,.12)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(700px 180px at 10% 0%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 55%)",
          pointerEvents: "none",
        }}
      />
      <Card.Body className="p-2" style={{ position: "relative" }}>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.95 }}>
              Running Vehicles
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: "24px", marginTop: 2 }}>
              {summaryCounts.moving}
            </div>
          </div>

          <Badge
            bg="light"
            text="success"
            pill
            style={{ fontSize: 10, padding: "4px 8px", fontWeight: 800 }}
          >
            Now
          </Badge>
        </div>
      </Card.Body>
    </Card>
  </div>

  {/* 4) Idle Vehicles */}
  <div className="col-12 col-md-6 col-lg-2">
    <Card
      className="border-0 text-white h-100"
      style={{
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(239,68,68,1) 0%, rgba(244,114,182,1) 55%, rgba(253,164,175,1) 100%)",
        boxShadow: "0 12px 28px rgba(15,23,42,.12)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(700px 180px at 10% 0%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 55%)",
          pointerEvents: "none",
        }}
      />
      <Card.Body className="p-2" style={{ position: "relative" }}>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.95 }}>
              Idle Vehicles
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: "24px", marginTop: 2 }}>
              {summaryCounts.idle}
            </div>
          </div>

          <Badge
            bg="light"
            text="danger"
            pill
            style={{ fontSize: 10, padding: "4px 8px", fontWeight: 800 }}
          >
            Now
          </Badge>
        </div>
      </Card.Body>
    </Card>
  </div>

  {/* 5) No Data Vehicles */}
  <div className="col-12 col-md-6 col-lg-2">
    <Card
      className="border-0 text-white h-100"
      style={{
        borderRadius: 16,
        background:
          "linear-gradient(135deg, rgba(100,116,139,1) 0%, rgba(148,163,184,1) 55%, rgba(203,213,225,1) 100%)",
        boxShadow: "0 12px 28px rgba(15,23,42,.12)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(700px 180px at 10% 0%, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 55%)",
          pointerEvents: "none",
        }}
      />
      <Card.Body className="p-2" style={{ position: "relative" }}>
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.95 }}>
              No Data Vehicles
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: "24px", marginTop: 2 }}>
              {summaryCounts.nodata}
            </div>
          </div>

          <Badge
            bg="light"
            text="dark"
            pill
            style={{ fontSize: 10, padding: "4px 8px", fontWeight: 800 }}
          >
            Alert
          </Badge>
        </div>
      </Card.Body>
    </Card>
  </div>

  {/* 6) Date + Filters button */}

<div className="col-12 col-md-6 col-lg-2">
  <Card
    className="border-0 h-100"
    style={{
      borderRadius: 14,
      background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
      border: "1px solid rgba(15,23,42,0.10)",
      boxShadow: "0 6px 14px rgba(15,23,42,0.08)",
    }}
  >
    <Card.Body className="p-2">
    <div className="row g-2 align-items-center">
  {/* Left */}
  <div className="col-6">
    <Badge
      bg="light"
      text="dark"
      pill
      className="w-100 text-center"
      style={{
        fontSize: 10,
        fontWeight: 800,
        padding: "8px 10px",
        display: "block",
      }}
    >
      {fromDate} → {toDate}
    </Badge>
  </div>

  {/* Right */}
  <div className="col-6 d-flex justify-content-end">
    <Button
      size="sm"
      variant="light"
      onClick={openFilters}
      style={{
        borderRadius: 12,
        border: "1px solid #BFDBFE",
        backgroundColor: "#EFF6FF",
        height: 36,
        width: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      title="Filters"
    >
      <i className="bi bi-list fs-5" style={{ color: "#2563EB" }} />
    </Button>
  </div>
</div>
    </Card.Body>
  </Card>
</div>


</div>



        {/* FILTER CARD */}
        {/* <Card className="shadow-sm mb-2 border-0">
          <Card.Body className="py-2 px-2">
            <Row className="g-3">
              <Col xs={12} md={3} lg={2} className="px-2">
                <div
                  style={{
                    border: "1px solid rgba(15,23,42,0.12)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(248,250,252,0.7)",
                    height: "100%",
                  }}
                >
                  <Form.Label
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "rgba(51, 65, 85, 0.95)",
                      marginBottom: 4,
                    }}
                  >
                    Mode
                  </Form.Label>
                  <Form.Select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    style={{ height: 34, fontSize: 12, borderRadius: 10 }}
                  >
                    <option>Live All</option>
                    <option>Live Only</option>
                    <option>History</option>
                  </Form.Select>
                </div>
              </Col>

              <Col xs={12} md={6} lg={4} className="px-2">
                <div
                  style={{
                    border: "1px solid rgba(15,23,42,0.12)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(248,250,252,0.7)",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "rgba(51, 65, 85, 0.95)",
                      marginBottom: 6,
                      letterSpacing: 0.2,
                    }}
                  >
                    Date Stamp
                  </div>
                  <Row className="g-2">
                    <Col xs={6}>
                      <Form.Label
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "rgba(15,23,42,0.65)",
                          marginBottom: 4,
                        }}
                      >
                        From
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={fromDate}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFromDate(v);
                          if (toDate && v && toDate < v) setToDate(v);
                        }}
                        style={{ height: 34, fontSize: 12, borderRadius: 10 }}
                      />
                    </Col>
                    <Col xs={6}>
                      <Form.Label
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "rgba(15,23,42,0.65)",
                          marginBottom: 4,
                        }}
                      >
                        To
                      </Form.Label>
                      <Form.Control
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        min={fromDate || undefined}
                        style={{ height: 34, fontSize: 12, borderRadius: 10 }}
                      />
                    </Col>
                  </Row>
                </div>
              </Col>

              <Col xs={12} md={12} lg={6} className="px-2">
                <div
                  style={{
                    border: "1px solid rgba(15,23,42,0.12)",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(248,250,252,0.7)",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: "rgba(51, 65, 85, 0.95)",
                      marginBottom: 6,
                      letterSpacing: 0.2,
                    }}
                  >
                    Filters
                  </div>

                  <Row className="g-2">
                    <Col xs={12} sm={4}>
                      <Form.Label
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "rgba(15,23,42,0.65)",
                          marginBottom: 4,
                        }}
                      >
                        Vendors
                      </Form.Label>
                      <Form.Select
                        value={selectedVendor}
                        // onChange={(e) => {
                        //   const v = e.target.value;

                        //   setTypeFilter("Type");
                        //   setVehNoFilter("Vehicle Number");

                        //   setTypeOptions([]);
                        //   setVehNoOptions([]);
                        //   setOptionsLoading(true);
                        //   lastOptionsSigRef.current = "";

                        //   dispatch(setSelectedVendor(v));
                        // }}

                      onChange={(e) => {
  const v = e.target.value;

  setTypeFilter("Type");
  setVehNoFilter("Vehicle Number");

  setTypeOptions([]);
  setVehNoOptions([]);
  setOptionsLoading(false);
  lastOptionsSigRef.current = "";

  // ✅ reset: options will build only when user opens dropdown again
  setOptionsTouched(false);

  dispatch(setSelectedVendor(v));
}}

                        style={{ height: 34, fontSize: 12, borderRadius: 10 }}
                      >
                        <option value="all">All Vendors</option>
                        <option value="jtrack1">JTrack -1</option>
                        <option value="jtrack2">JTrack -2(Special Equipment)</option>
                        <option value="batch">BatchMaster</option>
                        <option value="vecv">VECV - Eicher</option>
                        <option value="gpstrack">Amphibious</option>
                        <option value="ialert2">VehicleMounted Crane</option>
                        <option value="fleetx">FleetX - Bobcat</option>
                        <option value="vamosys">Vamosys - Enforcement vehicles</option>
                      </Form.Select>
                    </Col>

                    <Col xs={12} sm={4}>
                      <Form.Label
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "rgba(15,23,42,0.65)",
                          marginBottom: 4,
                        }}
                      >
                        Type
                      </Form.Label>
<Form.Select
  value={typeFilter}
  onChange={(e) => setTypeFilter(e.target.value)}
  onMouseDown={ensureOptionsNow}
  onFocus={ensureOptionsNow}
  style={{ height: 34, fontSize: 12, borderRadius: 10 }}
>


                        <option value="Type">Type</option>
                        {optionsLoading && <option disabled>Loading...</option>}
                        {typeOptions.length > MAX_OPTIONS && (
                          <option value="" disabled>
                            Showing first {MAX_OPTIONS} of {typeOptions.length}
                          </option>
                        )}
                        {typeOptionsLimited.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>

                    <Col xs={12} sm={4}>
                      <Form.Label
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: "rgba(15,23,42,0.65)",
                          marginBottom: 4,
                        }}
                      >
                        Vehicle Reg No.
                      </Form.Label>
                      
                    <Form.Select
  value={vehNoFilter}
  onChange={(e) => setVehNoFilter(e.target.value)}
  onMouseDown={ensureOptionsNow}
  onFocus={ensureOptionsNow}
  style={{ height: 34, fontSize: 12, borderRadius: 10 }}
>
                        <option value="Vehicle Number">Vehicle Number</option>
                        {optionsLoading && <option disabled>Loading...</option>}
                        {vehNoOptions.length > MAX_OPTIONS && (
                          <option value="" disabled>
                            Showing first {MAX_OPTIONS} of {vehNoOptions.length}
                          </option>
                        )}
                        {vehNoOptionsLimited.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </Form.Select>


                    </Col>
                  </Row>
                </div>
              </Col>
            </Row>
          </Card.Body>
        </Card> */}

        {/* MAP CARD */}
        <Card className="shadow-sm border-0">
          <Card.Body className="p-0 position-relative">
<GoogleMap
  mapContainerStyle={containerStyle}
  center={center || defaultCenter}
  zoom={mapZoom}
  onZoomChanged={handleZoomChanged}
  onLoad={(map) => {
    mapRef.current = map;
    map.setZoom(mapZoom); // set once
  }}
  onUnmount={() => (mapRef.current = null)}
  options={{
    clickableIcons: false,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    zoomControl: true,
    gestureHandling: "greedy",
    scrollwheel: true,
  }}
>
              {/* Legend */}
              <div
                className="position-absolute top-0 end-0 m-2"
                style={{
                  zIndex: 9999,
                  background: "rgba(255,255,255,.92)",
                  border: "1px solid rgba(15,23,42,0.12)",
                  borderRadius: 12,
                  padding: "8px 10px",
                  boxShadow: "0 10px 20px rgba(15,23,42,0.08)",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "rgba(15,23,42,0.85)",
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <img src={START_ICON.url} alt="start" width={18} height={18} />
                  <span>Start</span>
                  <span style={{ opacity: 0.35 }}>•</span>
                  <img src={END_ICON.url} alt="end" width={18} height={18} />
                  <span>End</span>
                  <span style={{ opacity: 0.35 }}>|</span>
                  {/* <Form.Check
                    type="switch"
                    id="kml-layers-switch"
                    label="Ward/Zone"
                    checked={showKmlLayers}
                    onChange={(e) => setShowKmlLayers(e.target.checked)}
                    style={{ fontSize: 11, fontWeight: 600 }}
                  /> */}
                </div>
              </div>

              {/* KML layers from src/kml (copied to public/kml at start/build) */}
              {showKmlLayers && isLoaded && (
                <>
                  <KmlLayer url={`${kmlBaseUrl}/WARD_2022.kml`} zIndex={1} />
                  <KmlLayer url={`${kmlBaseUrl}/ZONE_2022.kml`} zIndex={2} />
                </>
              )}

              {/* Vehicles (✅ DEDUPED) */}
            {/* {showVehicles &&
  visibleVehiclesDeduped.map((v, idx) => { */}

                  {showVehicles &&
  vehiclesToRender.map((v, idx) => {
                  const rawPos = getLatLng(v);
                  if (!rawPos) return null;

                  const src = getSource(v);
                  // const keySafe = getVehicleKey(v) || normalizeRegNo(getRegText(v));

                  const keySafe = getTrackKeySafe(v);
                  const idxKey = getRenderKey(v, idx);

                  const movingKey = keySafe ? `${src}:${keySafe}` : "";
                  const isMoving = keySafe ? movingSet.has(movingKey) : false;

                  const isActive =
                    !!activeVehicle &&
                    getSource(activeVehicle) === src &&
                    !!keySafe &&
                    (getVehicleKey(activeVehicle) === keySafe ||
                      normalizeRegNo(getRegText(activeVehicle)) === keySafe);

                  const url = vendorIconUrlBySource[src] || vendorIconUrlBySource.unknown;

                  const pos = jitterLatLng(rawPos, idxKey);
                  const regLabel = String(getRegText(v) || "").trim().toUpperCase();

                  // ✅ FAST PATH: huge fleet => use native Marker (much faster)
                  if (useSimpleMarkers && window.google?.maps) {
                    return (
                      <Marker
                        key={idxKey}
                        position={pos}
                        icon={{
                          url,
                        //   scaledSize: new window.google.maps.Size(42, 42),
                        scaledSize: markerSize42 || undefined,
                        }}
                        onClick={() => locateOnMap(v)}
                        title={regLabel || "Click to view route start & end"}
                        zIndex={isActive ? 999 : isMoving ? 400 : 200}
                      />
                    );
                  }

                  // ✅ NORMAL PATH: OverlayView (badge label)
                  return (
                    <OverlayView
                      key={idxKey}
                      position={pos}
                      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
                    >
                      <button
                        type="button"
                        className="btn btn-link p-0 border-0 bg-transparent"
                        onClick={() => locateOnMap(v)}
                        title={regLabel || "Click to view route start & end"}
                        style={{ position: "relative" }}
                      >
                        <img src={url} alt="vehicle" width={58} height={58} draggable={false} />

                        {!!regLabel && regLabel !== "-" && (
                          <div
                            style={{
                              position: "absolute",
                              left: "50%",
                              top: -4,
                              transform: "translateX(-50%)",
                              background: "rgba(15,23,42,0.92)",
                              color: "white",
                              padding: "2px 6px",
                              borderRadius: 999,
                              fontSize: 10,
                              fontWeight: 900,
                              letterSpacing: 0.2,
                              maxWidth: 140,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              boxShadow: "0 8px 14px rgba(0,0,0,.20)",
                              border: "1px solid rgba(255,255,255,.15)",
                            }}
                          >
                            {regLabel}
                          </div>
                        )}
                      </button>
                    </OverlayView>
                  );
                })}

              {/* Lines */}
              {showLines &&
                allVehiclePolylines.map((p) => {
                  const baseOpts = {
                    geodesic: true,
                    zIndex: 60,
                    strokeColor: p.color,
                    strokeOpacity: denseMode ? 0.55 : 0.7,
                    strokeWeight: denseMode ? 4 : 5,
                  };

                  const flowOpts = showMovingFlow
                    ? {
                        ...baseOpts,
                        strokeOpacity: denseMode ? 0.35 : 0.45,
                        icons: [
                          {
                            icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
                            offset: `${dashOffset}px`,
                            repeat: "18px",
                          },
                        ],
                      }
                    : baseOpts;

                  return <Polyline key={`poly:${p.id}`} path={p.path} options={flowOpts} />;
                })}

              {/* Start/End markers for each route in History + Live All */}
              {showLines &&
                (isHistoryMode || isLiveAll) &&
                allVehiclePolylines.map((p) => {
                  if (!p.start || !p.end) return null;

                  const isActiveRoute =
                    activeVehicle &&
`${getSource(activeVehicle)}:${getTrackKeySafe(activeVehicle)}` === p.id;
                  if (isActiveRoute) return null;

               return (
  <React.Fragment key={`se:${p.id}`}>
    {startIcon && (
      <Marker position={p.start} icon={startIcon} zIndex={120} />
    )}
    {endIcon && (
      <Marker position={p.end} icon={endIcon} zIndex={121} />
    )}
  </React.Fragment>
);
                })}

              {/* Active highlight */}
              {showLines && activeVehicle && activePath.length >= 2 && (
                <Polyline
                  path={activePath}
                  options={{
                    geodesic: true,
                    zIndex: 90,
                    strokeColor: activeColor,
                    strokeOpacity: 0.9,
                    strokeWeight: 6,
                  }}
                />
              )}

              {/* Active route Start/End markers */}
        {showLines &&
  activeVehicle &&
  activeStartEnd.start &&
  activeStartEnd.end &&
  startIcon &&
  endIcon && (
    <>
      <Marker position={activeStartEnd.start} icon={startIcon} zIndex={200} />
      <Marker position={activeStartEnd.end} icon={endIcon} zIndex={201} />
    </>
  )}

              {/* InfoWindow */}
{/* InfoWindow */}
{showVehicles && activeVehicle && activePos && (
  <InfoWindow position={activePos} onCloseClick={() => dispatch(setActive(null))}>
    {(() => {
      const regNo = getRegText(activeVehicle) || "-";
      const src = getSource(activeVehicle);

      /* =====================================================
         ✅ BATCHMASTER DROP PLACE (DEEP + ANYWHERE)
      ===================================================== */
      const dropPlaceRaw = pickFirstDeepAny(
        activeVehicle,
        [
          "Drop Place",
          "DropPlace",
          "Drop Location",
          "DropLocation",
          "drop_place",
          "dropPlace",
          "drop_location",
          "dropLocation",
          "drop_address",
          "dropAddress",
          "drop_place_name",
          "dropPlaceName",
          "dropplacename",
        ],
        ""
      );

      const dropPlace = String(dropPlaceRaw ?? "").trim();

      // ✅ Treat as Batch if Drop Place exists (even if src is wrong)
      const isBatch = src === "batch" || !!dropPlace;

      /* =====================================================
         ✅ NORMAL LOCATION (OTHER VENDORS ONLY)
      ===================================================== */
      const normalLocationRaw = pickFirstDeepAny(
        activeVehicle,
        ["location", "location_name", "locationName", "address"],
        ""
      );

      const normalLocation = String(normalLocationRaw ?? "").trim();

      // ✅ FINAL LOCATION SHOWN IN UI
      // const location = isBatch
      //   ? (dropPlace || "-")       // ✅ ONLY Drop Place
      //   : (normalLocation || "-"); // ✅ Others unchanged

      // Added for current location 


             // ✅ CURRENT LOCATION (Reverse geocoded) for ALL vendors
      const posNow = getLatLng(activeVehicle);
      const geoKey = posNow ? makeGeoKey(posNow) : "";
      const currentAddress = geoKey ? (geoAddrMap[geoKey] || "") : "";

      // ✅ FINAL LOCATION: ALWAYS prefer current address
      const location =
        (currentAddress && String(currentAddress).trim()) ||
        (normalLocation && String(normalLocation).trim()) ||
        (dropPlace && String(dropPlace).trim()) ||
        "-";

      /* =====================================================
         OTHER INFO
      ===================================================== */
      const type = getTypeText(activeVehicle) || "-";
      const branchName = pickFirst(activeVehicle, ["branch_name", "branchName", "branch"], "");
      const typeDisplay = src === "jtrack2" ? branchName || type : type;

      const zone = getZoneText(activeVehicle);
      const ward = getWardText(activeVehicle);

      const fuelType = pickFirst(activeVehicle, ["fuelType", "fuel_type", "fuel_name"], "-");
      const fuelTypeDisplay = src === "vamosys" ? "-" : fuelType || "-";

      const fuelAvailability = (() => {
        if (src === "fleetx") {
          return (
            pickFirst(activeVehicle?.otherAttributes, ["fuel", "FUEL_INSTANT", "FUEL_NORMALISED"], "") ||
            pickFirst(activeVehicle?.raw?.otherAttributes, ["fuel", "FUEL_INSTANT", "FUEL_NORMALISED"], "") ||
            "-"
          );
        }

        if (src === "jtrack1" || isBatch) {
          return (
            pickFirst(activeVehicle, ["fuel"], "") ||
            pickFirst(activeVehicle?.raw, ["fuel"], "") ||
            "-"
          );
        }

        return (
          pickFirst(
            activeVehicle,
            ["fuelRemaining", "fuel_level", "fuelLevel", "fuelCapacity", "fuel_capacity"],
            ""
          ) ||
          pickFirst(
            activeVehicle?.raw,
            ["fuelRemaining", "fuel_level", "fuelLevel", "fuelCapacity", "fuel_capacity"],
            ""
          ) ||
          "-"
        );
      })();

      const fuelAvailabilityDisplay =
        src === "jtrack1" || isBatch
          ? (() => {
              const n = Number(String(fuelAvailability).replace(/[^\d.]/g, ""));
              return Number.isFinite(n) ? `${n} L` : "-";
            })()
          : fuelAvailability;

      const speedText = toSpeedText(pickFirst(activeVehicle, ["speed", "vehicleSpeed"]));

      const lastUpdatedText = formatDateTime(
        pickFirst(activeVehicle, [
          "gps_datetime",
          "datetime",
          "ts",
          "lastUpdated",
          "epochTime",
          "time",
          "timestamp",
        ])
      );

      return (
        <Card className="shadow-sm border-0">
          <Card.Body className="p-2">
            <div className="mb-2">
              <div
                className="fw-bold text-primary lh-1"
                style={{ fontSize: 15, fontWeight: 900, letterSpacing: 0.6 }}
              >
                {String(regNo).toUpperCase()}
              </div>
            </div>

            <div className="row g-1">
              <div className="col-12">
                <Card className="border rounded-2 bg-light">
                  <Card.Body className="p-1">
                    <div className="text-muted small fw-semibold lh-1">   Last Known Time      </div>
                    <div className="fw-bold small lh-1">{lastUpdatedText}</div>
                  </Card.Body>
                </Card>
              </div>

              {[
                ["Type", typeDisplay],
                ["Zone", zone],
                ["Ward", ward],
                ["Fuel Type", fuelTypeDisplay],
                ["Speed", speedText],
                ["Fuel Availability", fuelAvailabilityDisplay],
              ].map(([k, v]) => (
                <div className="col-6" key={k}>
                  <Card className="border rounded-2 bg-light h-100">
                    <Card.Body className="p-1">
                      <div className="text-muted small fw-semibold lh-1">{k}</div>
                      <div className="fw-bold small lh-1 text-truncate">{v}</div>
                    </Card.Body>
                  </Card>
                </div>
              ))}

              <div className="col-12">
                <Card className="border rounded-2 bg-light">
                  <Card.Body className="p-1">
                    <div className="text-muted small fw-semibold lh-1">Location</div>
                    <div className="fw-bold small lh-1 text-break">{location}</div>
                  </Card.Body>
                </Card>

                <div className="d-flex justify-content-end mt-1">
                  <Button
                    size="sm"
                    variant="danger"
                    className="rounded-pill px-2 py-0 small"
                    onClick={() => dispatch(setActive(null))}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      );
    })()}
  </InfoWindow>
)}
            </GoogleMap>

            {/* {showVehicles && (
              <MovingVehiclesPanel
                // movingVehicles={new Set(Object.keys(movingMap || {}))}
                movingVehicles={movingSet}
                allVehicles={allVehicles}
                SOURCE_META={SOURCE_META}
                locateOnMap={locateOnMap}
              />
            )} */}

            {/* {loading && (
              <div className="position-absolute bottom-0 start-0 m-3" style={{ zIndex: 9999 }}>
                <Alert variant="success" className="mb-0 py-2 px-3">
                  Loading…
                </Alert>
              </div>
            )} */}

            {error && (
              <div className="position-absolute bottom-0 start-0 m-3" style={{ zIndex: 9999 }}>
                <Alert variant="danger" className="mb-0 py-2 px-3">
                  {String(error)}
                </Alert>
              </div>
            )}
          </Card.Body>
        </Card>

{/* =========================
   ✅ FILTER OFFCANVAS (FULL MERGED)
   - Responsive height
   - Card layout
   - Tight spacing (no big gap under buttons)
   - Footer always at bottom
========================= */}

<Offcanvas
  show={showFilters}
  onHide={closeFilters}
  placement="end"
  backdrop
  scroll={false}
  style={{
    width: "min(340px, 92vw)",   // ✅ responsive width
    height: "100vh",            // ✅ responsive full height
    maxHeight: "100vh",
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    zIndex: 20000,              // ✅ above map + InfoWindow
    overflow: "hidden",
  }}
>
  {/* Header */}
  <Offcanvas.Header
    closeButton
    className="border-bottom"
    style={{
      padding: "10px 12px",
      background: "white",
    }}
  >
    <Offcanvas.Title
      style={{
        fontWeight: 900,
        letterSpacing: 0.2,
        fontSize: 13,
      }}
    >
      Filters
    </Offcanvas.Title>
  </Offcanvas.Header>

  {/* Body (Card Layout) */}
  <Offcanvas.Body
    style={{
      padding: 8,
      background: "#F8FAFC",
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 52px)", // ✅ header height safe-ish
      overflow: "hidden",
    }}
  >
    {/* MAIN CARD */}
    <Card
      className="border-0"
      style={{
        borderRadius: 14,
        boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Scrollable content */}
      <Card.Body
        style={{
          padding: 8,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* ===== Mode ===== */}
        <Card className="border-0 mb-2" style={{ borderRadius: 12 }}>
          <Card.Body style={{ padding: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                marginBottom: 6,
                color: "rgba(15,23,42,.85)",
              }}
            >
              Mode
            </div>

            <Form.Select
              value={draft.mode}
              onChange={(e) => setDraft((d) => ({ ...d, mode: e.target.value }))}
              style={{
                height: 32,
                fontSize: 12,
                borderRadius: 10,
                borderColor: "rgba(15,23,42,0.14)",
              }}
            >
              <option>Live All</option>
              <option>Live Only</option>
              <option>History</option>
            </Form.Select>
          </Card.Body>
        </Card>

        {/* ===== Date Stamp ===== */}
        <Card className="border-0 mb-2" style={{ borderRadius: 12 }}>
          <Card.Body style={{ padding: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                marginBottom: 6,
                color: "rgba(15,23,42,.85)",
              }}
            >
              Date Stamp
            </div>

            <Row className="g-2">
              <Col xs={6}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    marginBottom: 4,
                    color: "rgba(15,23,42,.70)",
                  }}
                >
                  From
                </div>

                <Form.Control
                  type="date"
                  value={draft.fromDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraft((d) => {
                      const nextTo = d.toDate && v && d.toDate < v ? v : d.toDate;
                      return { ...d, fromDate: v, toDate: nextTo };
                    });
                  }}
                  style={{
                    height: 32,
                    fontSize: 12,
                    borderRadius: 10,
                    borderColor: "rgba(15,23,42,0.14)",
                  }}
                />
              </Col>

              <Col xs={6}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    marginBottom: 4,
                    color: "rgba(15,23,42,.70)",
                  }}
                >
                  To
                </div>

                <Form.Control
                  type="date"
                  value={draft.toDate}
                  onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value }))}
                  min={draft.fromDate || undefined}
                  style={{
                    height: 32,
                    fontSize: 12,
                    borderRadius: 10,
                    borderColor: "rgba(15,23,42,0.14)",
                  }}
                />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* ===== Filters ===== */}
        <Card className="border-0" style={{ borderRadius: 12 }}>
          <Card.Body style={{ padding: 8 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                marginBottom: 6,
                color: "rgba(15,23,42,.85)",
              }}
            >
              Filters
            </div>

            {/* ✅ Vendors - HIDDEN when on vendor page */}
            {!isVendorPage && (
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    marginBottom: 4,
                    color: "rgba(15,23,42,.70)",
                  }}
                >
                  Vendors
                </div>

                <Form.Select
                  value={draft.selectedVendor}
                  onChange={(e) => {
                    const v = e.target.value;

                    // ✅ cascade reset
                    setDraft((d) => ({
                      ...d,
                      selectedVendor: v,
                      typeFilter: "Type",
                      vehNoFilter: "Vehicle Number",
                    }));

                    // ✅ rebuild options only on user open
                    setTypeOptions([]);
                    setVehNoOptions([]);
                    setOptionsLoading(false);
                    lastOptionsSigRef.current = "";
                    setOptionsTouched(false);
                  }}
                  style={{
                    height: 32,
                    fontSize: 12,
                    borderRadius: 10,
                    borderColor: "rgba(15,23,42,0.14)",
                  }}
                >
                  {/* <option value="all">All Vendors</option> */}
                  <option value="jtrack1">JTrack -1</option>
                  <option value="jtrack2">JTrack -2 (Special Equipment)</option>
                  <option value="batch">BatchMaster</option>
                  <option value="vecv">VECV - Eicher</option>
                  <option value="gpstrack">Amphibious</option>
                  <option value="ialert2">VehicleMounted Crane</option>
                  <option value="fleetx">FleetX - Bobcat</option>
                  <option value="vamosys">Vamosys - Enforcement</option>
                </Form.Select>
              </div>
            )}

            {/* Type */}
            <div style={{ marginBottom: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  marginBottom: 4,
                  color: "rgba(15,23,42,.70)",
                }}
              >
                Type
              </div>

              <Form.Select
                value={draft.typeFilter}
                onChange={(e) => {
                  const nextType = e.target.value;

                  // ✅ cascade: when type changes, reset reg no (so dropdown stays correct)
                  setDraft((d) => ({
                    ...d,
                    typeFilter: nextType,
                    vehNoFilter: "Vehicle Number",
                  }));
                }}
                onMouseDown={ensureOptionsNow}
                onFocus={ensureOptionsNow}
                style={{
                  height: 32,
                  fontSize: 12,
                  borderRadius: 10,
                  borderColor: "rgba(15,23,42,0.14)",
                }}
              >
                <option value="Type">Type</option>
                {optionsLoading && <option disabled>Loading...</option>}
                {typeOptionsLimited.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Select>
            </div>

            {/* Vehicle Reg No */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  marginBottom: 4,
                  color: "rgba(15,23,42,.70)",
                }}
              >
                Vehicle Reg No.
              </div>

              <Form.Select
                value={draft.vehNoFilter}
                onChange={(e) => setDraft((d) => ({ ...d, vehNoFilter: e.target.value }))}
                onMouseDown={ensureOptionsNow}
                onFocus={ensureOptionsNow}
                style={{
                  height: 32,
                  fontSize: 12,
                  borderRadius: 10,
                  borderColor: "rgba(15,23,42,0.14)",
                }}
              >
                <option value="Vehicle Number">Vehicle Number</option>
                {optionsLoading && <option disabled>Loading...</option>}
                {vehNoOptionsLimited.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Form.Select>
            </div>
          </Card.Body>
        </Card>
      </Card.Body>

      {/* ✅ Footer (tight, no extra gap) */}
      <Card.Footer
        className="border-0"
        style={{
          padding: 6,
          background: "#F8FAFC",
        }}
      >
        <div className="d-flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="w-50"
            style={{
              borderRadius: 12,
              fontWeight: 900,
              padding: "8px 0", // ✅ consistent height
            }}
            onClick={closeFilters}
          >
            Close
          </Button>

          {/* <Button
            size="sm"
            variant="primary"
            className="w-50"
            style={{
              borderRadius: 12,
              fontWeight: 900,
              padding: "8px 0", // ✅ consistent height
            }}
            onClick={() => {
              // ✅ apply draft -> real filters
              setMode(draft.mode);
              setFromDate(draft.fromDate);
              setToDate(draft.toDate);
              dispatch(setSelectedVendor(draft.selectedVendor));
              setTypeFilter(draft.typeFilter);
              setVehNoFilter(draft.vehNoFilter);
              closeFilters();
            }}
          >
            Apply
          </Button> */}

<Button
  size="sm"
  variant="primary"
  className="w-50"
  style={{
    borderRadius: 12,
    fontWeight: 900,
    padding: "8px 0",
    cursor: "pointer",   // ✅ hand cursor
  }}
  onClick={() => {
    const clean = sanitizeAppliedFilters({
      mode: draft.mode,
      fromDate: draft.fromDate,
      toDate: draft.toDate,
      selectedVendor: draft.selectedVendor,
      typeFilter: draft.typeFilter,
      vehNoFilter: draft.vehNoFilter,
      statusFilter,
    });

    setMode(clean.mode);
    setFromDate(clean.fromDate);
    setToDate(clean.toDate);
    dispatch(setSelectedVendor(clean.selectedVendor));
    setTypeFilter(clean.typeFilter);
    setVehNoFilter(clean.vehNoFilter);
    setStatusFilter(clean.statusFilter);

    clearGeoCache(); // ✅ ADD HERE

    saveAppliedFilters(clean);
    setShowMap(true);   // ✅ show map after Apply
    closeFilters();
  }}
>
  Apply
</Button>

        </div>
      </Card.Footer>
    </Card>
  </Offcanvas.Body>
</Offcanvas>


      </Container>
    </div>
  );
}



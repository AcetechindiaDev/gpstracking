
// // src/store/vehiclesSlice.js


import {
  createSlice,
  createAsyncThunk,
  createEntityAdapter,
} from "@reduxjs/toolkit";
import axios from "axios";
import {
  getLatLng,
  normalizeReg,
  noCacheHeaders,
  todayYYYYMMDD,
  withBuster,
} from "./utils";
import { ingestVehicleSamples } from "./tracksSlice";
import { setLoading } from "./uiSlice";

/* ======================
   API CONFIG
====================== */
// const USE_CRA_PROXY = true;

// /* ---------- JTRACK ---------- */
// const JTRACK_BASE = USE_CRA_PROXY ? "/api/jtrack/api" : "https://jtrack.in/api";
// const JTRACK_API_KEY_LIVE_1 = "74c130da0ffca60625814b79a45b6b0b";
// const JTRACK_API_KEY_LIVE_2 = "f3fa2cb4cfa4f7a1e7f1b1b9157978aa";

// const JTRACK_LIVE_URL_1 = `${JTRACK_BASE}/pull_vts_details.php?api_key=${JTRACK_API_KEY_LIVE_1}`;
// const JTRACK_LIVE_URL_2 = `${JTRACK_BASE}/pull_vts_details.php?api_key=${JTRACK_API_KEY_LIVE_2}`;

// // JTrack-1 zone/type master API (AM/PM JSON source)
// const JTRACK1_ZONE_MASTER_URL = `${JTRACK_BASE}/jtrack1_zone_master.php?api_key=${JTRACK_API_KEY_LIVE_1}`;

// // JTrack-1 NMO API (data/nmo_data => branch_name should show in Zone)
// const JTRACK1_NMO_URL = `${JTRACK_BASE}/jtrack1_nmo_data.php?api_key=${JTRACK_API_KEY_LIVE_1}`;

// /* ---------- BATCHMASTER ---------- */
// const BATCH_BASE = USE_CRA_PROXY
//   ? "/api/batch/live/public/api/v1"
//   : "https://gcc.batchmaster.in/live/public/api/v1";

// const BATCH_MECH_MASTER_URL = `${BATCH_BASE}/get-mechanic-master-api`;
// const BATCH_MECH_LIVE_URL = `${BATCH_BASE}/get-mechanic-livetracking-details`;
// const BATCH_HEALTH_VEHICLE_URL = `${BATCH_BASE}/get-health-vehicle-details`;
// const BATCH_MECH_HEADERS = { user_name: "mechanic", password: "S7&l8$Go" };

// /* ---------- VECV ---------- */
// const VECV_TOKEN_URL = "/api/vecv/service-gateway/secure/genrateToken";
// const VECV_LIVE_URL =
//   "/api/vecv/live-location-service/vehicle/v1/getlivedata/location";
// const VECV_API_KEY = "6c441a37-fe94-4fcb-a07f-beb4b637bf3a";
// const VECV_CLIENT_ID = "08a1f851-5ece-42"; // must be full

// /* ---------- GPSTRACK ---------- */
// const GPSTRACK_BASE = USE_CRA_PROXY
//   ? "/api/gpstrack/api"
//   : "https://app.gpstrack.in/api";
// const GPSTRACK_TOKEN = "Cj2MQDxNBj5WlVoRBp5iRlr4miRaJNnR";
// const GPSTRACK_EMAIL = "amphibiousex@gmail.com";
// const GPSTRACK_LIVE_URL = `${GPSTRACK_BASE}/get_current_data?token=${encodeURIComponent(
//   GPSTRACK_TOKEN
// )}&email=${encodeURIComponent(GPSTRACK_EMAIL)}`;

// /* ---------- iALERT2 ---------- */
// const IALERT2_TOKEN_STORAGE_KEY = "ialert2_token_v1";
// const IALERT2_TOKEN_HARDCODED =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJNalE1TVRReSIsImF1ZCI6IkRBQVMifQ.-hVuFx_Eh1IYn4PMMVs8Mke-sqWbJyH17aFtK3GVbd0";

// const IALERT2_BASE = "/api/ialert2/ialert/daas/api";
// const IALERT2_LIVE_PATH = `${IALERT2_BASE}/getdata`;

// /* ---------- FLEETX ---------- */
// const FLEETX_BASE = "/api/fleetx";
// const FLEETX_LIVE_URL = `${FLEETX_BASE}/api/v1/analytics/live`;
// const FLEETX_ACCESS_TOKEN = "7018a36c-09ad-4915-ae3a-8eb62b543f2c";

// /* ---------- VAMOSYS ---------- */
// const VAMOSYS_BASE = USE_CRA_PROXY ? "/api/vamosys" : "https://api.vamosys.com";
// const VAMOSYS_PROVIDER = "GREATERCHENNAICORPORATION";
// const VAMOSYS_FCODE = "VAMTO";
// const VAMOSYS_LIVE_URL = `${VAMOSYS_BASE}/mobile/getGrpDataForTrustedClients?providerName=${encodeURIComponent(
//   VAMOSYS_PROVIDER
// )}&fcode=${encodeURIComponent(VAMOSYS_FCODE)}`;

// /* ---------- Polling ---------- */
// const LIVE_POLL_MS = 30 * 1000; // 30 seconds

// const REFRESH_MS = {
//   jtrack1: LIVE_POLL_MS,
//   jtrack2: LIVE_POLL_MS,
//   jtrack1ZoneMaster: LIVE_POLL_MS,
//   jtrack1Nmo: LIVE_POLL_MS,

//   batch: LIVE_POLL_MS,
//   health: LIVE_POLL_MS,
//   vecv: LIVE_POLL_MS,
//   gpstrack: LIVE_POLL_MS,
//   ialert2: LIVE_POLL_MS,
//   fleetx: LIVE_POLL_MS,
//   batchMaster: LIVE_POLL_MS,
//   vamosys: LIVE_POLL_MS,
// };

/* ======================
   API CONFIG (NO PROXY)
====================== */
const USE_CRA_PROXY = false;

/* ---------- JTRACK ---------- */
const JTRACK_BASE = "https://jtrack.in/api";
const JTRACK_API_KEY_LIVE_1 = "74c130da0ffca60625814b79a45b6b0b";
const JTRACK_API_KEY_LIVE_2 = "f3fa2cb4cfa4f7a1e7f1b1b9157978aa";

const JTRACK_LIVE_URL_1 = `${JTRACK_BASE}/pull_vts_details.php?api_key=${JTRACK_API_KEY_LIVE_1}`;
const JTRACK_LIVE_URL_2 = `${JTRACK_BASE}/pull_vts_details.php?api_key=${JTRACK_API_KEY_LIVE_2}`;

// JTrack-1 zone/type master API
const JTRACK1_ZONE_MASTER_URL = `${JTRACK_BASE}/jtrack1_zone_master.php?api_key=${JTRACK_API_KEY_LIVE_1}`;

// JTrack-1 NMO API
const JTRACK1_NMO_URL = `${JTRACK_BASE}/jtrack1_nmo_data.php?api_key=${JTRACK_API_KEY_LIVE_1}`;

/* ---------- BATCHMASTER ---------- */
const BATCH_BASE = "https://gcc.batchmaster.in/live/public/api/v1";

const BATCH_MECH_MASTER_URL = `${BATCH_BASE}/get-mechanic-master-api`;
const BATCH_MECH_LIVE_URL = `${BATCH_BASE}/get-mechanic-livetracking-details`;
const BATCH_HEALTH_VEHICLE_URL = `${BATCH_BASE}/get-health-vehicle-details`;
const BATCH_MECH_HEADERS = {
  user_name: "mechanic",
  password: "S7&l8$Go",
};

/* ---------- VECV ---------- */
const VECV_TOKEN_URL =
  "https://partnerapi.vecv.net/service-gateway/secure/genrateToken";

const VECV_LIVE_URL =
  "https://partnerapi.vecv.net/live-location-service/vehicle/v1/getlivedata/location";

const VECV_API_KEY = "6c441a37-fe94-4fcb-a07f-beb4b637bf3a";
const VECV_CLIENT_ID = "08a1f851-5ece-42"; // must be full

/* ---------- GPSTRACK ---------- */
const GPSTRACK_BASE = "https://app.gpstrack.in/api";
const GPSTRACK_TOKEN = "Cj2MQDxNBj5WlVoRBp5iRlr4miRaJNnR";
const GPSTRACK_EMAIL = "amphibiousex@gmail.com";

const GPSTRACK_LIVE_URL = `${GPSTRACK_BASE}/get_current_data?token=${encodeURIComponent(
  GPSTRACK_TOKEN
)}&email=${encodeURIComponent(GPSTRACK_EMAIL)}`;

/* ---------- iALERT2 ---------- */
// const IALERT2_TOKEN_STORAGE_KEY = "ialert2_token_v1";
// const IALERT2_TOKEN_HARDCODED =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJNalE1TVRReSIsImF1ZCI6IkRBQVMifQ.-hVuFx_Eh1IYn4PMMVs8Mke-sqWbJyH17aFtK3GVbd0";

// const IALERT2_BASE =
//   "https://ialertelite.ashokleyland.com/ialert/daas/api";
// const IALERT2_LIVE_PATH = `${IALERT2_BASE}/getdata`;

/* ---------- iALERT2 ---------- */
// const IALERT2_TOKEN_STORAGE_KEY = "ialert2_token_v1";
// const IALERT2_TOKEN_HARDCODED =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJNalE1TVRReSIsImF1ZCI6IkRBQVMifQ.-hVuFx_Eh1IYn4PMMVs8Mke-sqWbJyH17aFtK3GVbd0";

// const IALERT2_BASE = "https://dev.cscl.co.in";
// const IALERT2_LIVE_PATH = `${IALERT2_BASE}/report/vehicle_gps_data`;

const IALERT2_TOKEN_STORAGE_KEY = "ialert2_token_v1";
const IALERT2_TOKEN_HARDCODED =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJNalE1TVRReSIsImF1ZCI6IkRBQVMifQ.-hVuFx_Eh1IYn4PMMVs8Mke-sqWbJyH17aFtK3GVbd0";

const IALERT2_BASE =
  "https://ialertelite.ashokleyland.com/ialert/daas/api";
const IALERT2_LIVE_PATH = `${IALERT2_BASE}/getdata`;


// const IALERT2_BASE = "https://ialertelite.ashokleyland.com";
// const IALERT2_LIVE_PATH = `${IALERT2_BASE}/ialert/daas/api/getdata?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJNalE1TVRReSIsImF1ZCI6IkRBQVMifQ.-hVuFx_Eh1IYn4PMMVs8Mke-sqWbJyH17aFtK3GVbd0`;


/* ---------- FLEETX ---------- */
const FLEETX_BASE = "https://api.fleetx.io";
const FLEETX_LIVE_URL = `${FLEETX_BASE}/api/v1/analytics/live`;
const FLEETX_ACCESS_TOKEN = "7018a36c-09ad-4915-ae3a-8eb62b543f2c";

/* ---------- VAMOSYS ---------- */
const VAMOSYS_BASE = "https://api.vamosys.com";
const VAMOSYS_PROVIDER = "GREATERCHENNAICORPORATION";
const VAMOSYS_FCODE = "VAMTO";

const VAMOSYS_LIVE_URL = `${VAMOSYS_BASE}/mobile/getGrpDataForTrustedClients?providerName=${encodeURIComponent(
  VAMOSYS_PROVIDER
)}&fcode=${encodeURIComponent(VAMOSYS_FCODE)}`;

/* ---------- Polling ---------- */
const LIVE_POLL_MS = 30 * 1000; // 30 seconds

const REFRESH_MS = {
  jtrack1: LIVE_POLL_MS,
  jtrack2: LIVE_POLL_MS,
  jtrack1ZoneMaster: LIVE_POLL_MS,
  jtrack1Nmo: LIVE_POLL_MS,

  batch: LIVE_POLL_MS,
  health: LIVE_POLL_MS,
  vecv: LIVE_POLL_MS,
  gpstrack: LIVE_POLL_MS,
  ialert2: LIVE_POLL_MS,
  fleetx: LIVE_POLL_MS,
  batchMaster: LIVE_POLL_MS,
  vamosys: LIVE_POLL_MS,
};

/* ======================
   Entity adapter (vehicles)
====================== */
const vehiclesAdapter = createEntityAdapter({
  selectId: (v) => v.uid,
  sortComparer: (a, b) => String(a.uid).localeCompare(String(b.uid)),
});

const initialState = vehiclesAdapter.getInitialState({
  batchMaster: {},
  jtrack1BranchMeta: {},
  jtrack1NmoByReg: {},
  fleetxRaw: null,

  polling: { running: false, ids: {} },

  // ✅ VECV token cache
  vecvToken: "",
  vecvTokenStorageKey: "vecv_token_cache_v1",
  vecvTokenFetchedAt: 0,
  vecvTokenTtlMs: 6 * 60 * 60 * 1000, // 6 hours (adjust if you know expiry)
  vecvTokenInFlight: false,

  // debug only
  ialert2TokenUsed: "",
});

/* ======================
   Helpers
====================== */
function extractArray(json, preferredKeys = []) {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];

  for (const k of preferredKeys) {
    const v = json?.[k];
    if (Array.isArray(v)) return v;
  }

  const candidates = [
    json.data,
    json.result,
    json.vehicles,
    json.vehicle,
    json.response,
    json.locationData,
    json.nmo_data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  const nested = json?.data?.data;
  if (Array.isArray(nested)) return nested;

  const values = Object.values(json);
  if (values.some(Array.isArray)) {
    const firstArr = values.find(Array.isArray);
    return firstArr || [];
  }

  return [];
}

function normalizeZoneText(x) {
  const s = String(x ?? "").trim();
  if (!s) return "-";
  const m = s.match(/zone\W*0*(\d{1,2})/i);
  if (m) return `ZONE ${Number(m[1])}`;
  if (/^zone\s+\d{1,2}$/i.test(s)) return s.toUpperCase();
  return s;
}

function zoneFromTextMaybe(x) {
  const s = String(x ?? "").trim();
  if (!s) return "-";
  const m = s.match(/zone\W*0*(\d{1,2})/i);
  if (m) return `ZONE ${Number(m[1])}`;
  const m2 = s.match(/^z\W*0*(\d{1,2})$/i);
  if (m2) return `ZONE ${Number(m2[1])}`;
  return "-";
}

function pickJtrackReg(item) {
  return normalizeReg(
    item?.vehicle_number ||
      item?.vehicleregnumber ||
      item?.vehicleRegNumber ||
      item?.vehicleNo ||
      item?.vehicle_no ||
      item?.regNo ||
      item?.label ||
      ""
  );
}

function safeLabelVecv(v) {
  const reg = (v.regNo || "").trim();
  if (reg) return reg;
  const ch = (v.chassisNo || "").trim();
  if (ch) return `CH-${ch.slice(-6)}`;
  const dev = (v.deviceId || "").trim();
  if (dev) return `DV-${dev.slice(-6)}`;
  return v.id || "VECV";
}

const safeLabelGps = (r) =>
  normalizeReg(r?.regNo || r?.vehicle || r?.name || r?.label || r?.id || "GPS");

const safeLabelIalert2 = (r) =>
  normalizeReg(
    r?.vehicleregnumber ||
      r?.vehicleRegNumber ||
      r?.regNo ||
      r?.vehicle ||
      r?.name ||
      r?.id ||
      "IALERT2"
  );

const safeLabelFleetx = (r) =>
  normalizeReg(
    r?.vehicleNumber ||
      r?.vehicle_no ||
      r?.registrationNumber ||
      r?.regNo ||
      r?.number ||
      r?.name ||
      r?.id ||
      "FLEETX"
  );

function pickZoneNo(r) {
  return (
    r?.zoneNo ??
    r?.zone_no ??
    r?.zone ??
    r?.zoneName ??
    r?.zone_name ??
    r?.Zone ??
    r?.ZONE ??
    "-"
  );
}

function pickWardNo(r) {
  return (
    r?.wardNo ??
    r?.ward_no ??
    r?.ward ??
    r?.wardName ??
    r?.ward_name ??
    r?.Ward ??
    r?.WARD ??
    "-"
  );
}

function pickLocation(r) {
  return (
    r?.location ??
    r?.location_name ??
    r?.locationName ??
    r?.address ??
    r?.addr ??
    "-"
  );
}

function pickVehicleType(r) {
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

function pickFuelCapacity(r) {
  const val =
    r?.fuel_capacity ??
    r?.fuelCapacity ??
    r?.fuel_tank_capacity ??
    r?.tank_capacity ??
    r?.tankCapacity ??
    r?.fuelCapcity;
  return val ?? "-";
}

function pickFleetxFuelType(r) {
  const ft =
    r?.fuelType ??
    r?.fuel_type ??
    r?.otherAttributes?.fuelType ??
    r?.otherAttributes?.FUEL_NORMALISED ??
    r?.otherAttributes?.FUEL_INSTANT ??
    r?.otherAttributes?.fuel ??
    "-";
  return ft ?? "-";
}

function applyMaster(batchMaster, obj) {
  if (obj?.source !== "batch" && obj?.source !== "health") return obj;

  const reg = normalizeReg(obj?.regNo) || normalizeReg(obj?.label) || "";
  if (!reg) return obj;

  const m = batchMaster?.[reg];
  if (!m) return obj;

  return {
    ...obj,
    regNo: obj.regNo || reg,
    vehicleType: obj.vehicleType ?? m.vehicleType ?? "-",
    fuelCapacity: obj.fuelCapacity ?? m.fuelCapacity ?? "-",
    zoneNo: obj.zoneNo ?? m.zoneNo ?? "-",
    wardNo: obj.wardNo ?? m.wardNo ?? "-",
    fuelType: obj.fuelType ?? m.fuelType ?? "-",
  };
}

function toVehicle(source, base) {
  const trackKey = base.trackKey || base.id;
  return {
    ...base,
    source,
    trackKey,
    uid: `${source}:${trackKey}`,
  };
}

/* ---- localStorage helpers ---- */
function loadToken(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function saveToken(key, t) {
  try {
    if (!t) localStorage.removeItem(key);
    else localStorage.setItem(key, t);
  } catch {}
}

function loadJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveJson(key, val) {
  try {
    if (val == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

/* ---------- iAlert2 token getter (reuse) ---------- */
function getIalert2Token() {
  const fromLs = (loadToken(IALERT2_TOKEN_STORAGE_KEY) || "").trim();
  if (fromLs) return fromLs;
  return (IALERT2_TOKEN_HARDCODED || "").trim();
}

export const setIalert2Token = createAsyncThunk(
  "vehicles/setIalert2Token",
  async (tokenStr) => {
    const t = String(tokenStr || "").trim();
    saveToken(IALERT2_TOKEN_STORAGE_KEY, t);
    return t;
  }
);

/* ======================
   ✅ VECV token: generate once + reuse (for all calls)
====================== */
const VECV_TOKEN_META_LS_KEY = "vecv_token_meta_v1"; // {token, fetchedAt}

let _vecvTokenPromise = null;

function isVecvTokenValid(meta, ttlMs) {
  if (!meta?.token) return false;
  const fetchedAt = Number(meta?.fetchedAt || 0);
  if (!fetchedAt) return false;
  return Date.now() - fetchedAt < Number(ttlMs || 0);
}

async function getVecvTokenCached({ apiKey, ttlMs, storageKey, dispatch }) {
  // 1) read meta from localStorage first
  const meta = loadJson(VECV_TOKEN_META_LS_KEY);
  if (isVecvTokenValid(meta, ttlMs)) return meta.token;

  // 2) if a request is already in-flight, await it
  if (_vecvTokenPromise) return _vecvTokenPromise;

  // 3) create one promise for concurrent callers
  _vecvTokenPromise = (async () => {
    try {
      dispatch(vehiclesSlice.actions._setVecvTokenInFlight(true));

      const tokRes = await axios.get(withBuster(VECV_TOKEN_URL), {
        headers: {
          Accept: "application/json",
          ...noCacheHeaders,
          "API-KEY": apiKey,
        },
        timeout: 15000,
      });

      const token = tokRes?.data?.token;
      if (!token) throw new Error("VECV token not found (response.token missing)");

      const newMeta = { token, fetchedAt: Date.now() };
      saveJson(VECV_TOKEN_META_LS_KEY, newMeta);

      // keep old behavior too (you already used vecvTokenStorageKey for token string)
      saveToken(storageKey, token);

      dispatch(
        vehiclesSlice.actions._setVecvTokenState({
          token,
          fetchedAt: newMeta.fetchedAt,
        })
      );

      return token;
    } finally {
      dispatch(vehiclesSlice.actions._setVecvTokenInFlight(false));
      _vecvTokenPromise = null;
    }
  })();

  return _vecvTokenPromise;
}

/* ======================
   THUNKS
====================== */

/* ✅ JTrack-1 Zone/VehicleType master (AM/PM JSON) */
export const fetchJtrack1ZoneMaster = createAsyncThunk(
  "vehicles/fetchJtrack1ZoneMaster",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(withBuster(JTRACK1_ZONE_MASTER_URL), {
        headers: { Accept: "application/json", ...noCacheHeaders },
        timeout: 20000,
      });

      const json = res.data || {};
      const out = {};

      ["AM", "PM"].forEach((shift) => {
        const groups = Array.isArray(json?.[shift]) ? json[shift] : [];
        groups.forEach((g) => {
          const vehicleType = g?.vehicle ?? "-";
          const zonesArr = Array.isArray(g?.zones) ? g.zones : [];
          zonesArr.forEach((z) => {
            const branchId = String(z?.branch_id ?? "").trim();
            if (!branchId) return;
            const zoneNo = normalizeZoneText(z?.zone ?? "-");
            out[branchId] = { zoneNo, vehicleType };
          });
        });
      });

      return out;
    } catch (e) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "JTrack1 zone master failed"
      );
    }
  }
);

/* ✅ JTrack-1 NMO (branch_name => Zone) */
export const fetchJtrack1Nmo = createAsyncThunk(
  "vehicles/fetchJtrack1Nmo",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.get(withBuster(JTRACK1_NMO_URL), {
        headers: { Accept: "application/json", ...noCacheHeaders },
        timeout: 20000,
      });

      const json = res.data || {};
      const rows = extractArray(json, ["nmo_data", "data", "result", "vehicles"]);

      const out = {};
      rows.forEach((r) => {
        const reg = pickJtrackReg(r);
        if (!reg) return;

        const zoneFromBranch = zoneFromTextMaybe(r?.branch_name);
        const zoneNo =
          zoneFromBranch !== "-"
            ? zoneFromBranch
            : normalizeZoneText(r?.branch_name || "-");

        const branchId = r?.branch_id != null ? String(r.branch_id).trim() : "";
        out[reg] = { zoneNo, branchId: branchId || "-", raw: r };
      });

      return out;
    } catch (e) {
      return rejectWithValue(
        e?.response?.data?.message || e?.message || "JTrack1 NMO fetch failed"
      );
    }
  }
);

/* ✅ Batch Master */
export const fetchBatchMaster = createAsyncThunk(
  "vehicles/fetchBatchMaster",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axios.request({
        url: BATCH_MECH_MASTER_URL,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...noCacheHeaders,
          ...BATCH_MECH_HEADERS,
        },
        data: { date: todayYYYYMMDD() },
        timeout: 20000,
      });

      const json = res.data;
      const rows = extractArray(json, ["data", "result", "vehicles"]);

      const out = {};
      rows.forEach((r) => {
        const reg = normalizeReg(
          r?.regNo ||
            r?.vehicle_no ||
            r?.vehicleNo ||
            r?.vehicle_number ||
            r?.vehicleNumber
        );
        if (!reg) return;

        const zoneNo = pickZoneNo(r);
        const wardNo = pickWardNo(r);
        const fuelType = r?.fuelType || r?.fuel_type || r?.fuel_name || r?.fuel || "-";

        out[reg] = {
          regNo: reg,
          vehicleType: pickVehicleType(r),
          fuelCapacity: pickFuelCapacity(r),
          zoneNo,
          wardNo,
          fuelType,
          raw: r,
        };
      });

      return out;
    } catch (e) {
      return rejectWithValue(e?.message || "Batch master fetch failed");
    }
  }
);

/* ✅ JTRACK live (API-1 + API-2) */
export const fetchJtrack = createAsyncThunk(
  "vehicles/fetchJtrack",
  async ({ which }, { getState, dispatch, rejectWithValue }) => {
    try {
      const url = which === 1 ? JTRACK_LIVE_URL_1 : JTRACK_LIVE_URL_2;

      // const res = await axios.get(withBuster(url), {
      //   headers: { Accept: "application/json", ...noCacheHeaders },
      //   timeout: 15000,
      // });

      
      const res = await axios.get(url, {
    headers: { Accept: "application/json" },
    // timeout: 15000,
    timeout: which === 2 ? 30000 : 15000,
    });


      const json = res.data;

      let raw = extractArray(json, ["data", "result", "vehicles", "response"]);
      if (!Array.isArray(raw) && raw && typeof raw === "object") raw = Object.values(raw);

      const { batchMaster, jtrack1BranchMeta, jtrack1NmoByReg } = getState().vehicles;
      const source = which === 1 ? "jtrack1" : "jtrack2";

      const mapped = (raw || [])
        .map((item, idx) => {
          const ll = getLatLng(item);
          if (!ll) return null;

          const regNorm = pickJtrackReg(item);
          const baseId = item.vehicle_id || regNorm || item.vehicle_number || `${source}-${idx}`;
          const trackKey = String(baseId);

          const branchNameRaw = item.branchName ?? item.branch_name ?? "-";
          const branchNameNormZone = zoneFromTextMaybe(branchNameRaw);

          const branchIdLive = item.branch_id != null ? String(item.branch_id).trim() : "";
          const masterMeta = which === 1 && branchIdLive ? jtrack1BranchMeta?.[branchIdLive] : null;
          const nmoMeta = which === 1 && regNorm ? jtrack1NmoByReg?.[regNorm] : null;

          const vehicleTypeValue =
            which === 2
              ? branchNameRaw && branchNameRaw !== "-"
                ? branchNameRaw
                : "-"
              : masterMeta?.vehicleType ??
                item.model_name ??
                item.vehicle_type ??
                item.vehicleType ??
                "-";

          // let zoneValue = "-";
          // if (which === 1) {
          //   if (branchNameNormZone !== "-") zoneValue = branchNameNormZone;
          //   else if (normalizeZoneText(nmoMeta?.zoneNo) !== "-")
          //     zoneValue = normalizeZoneText(nmoMeta?.zoneNo);
          //   else if (normalizeZoneText(masterMeta?.zoneNo) !== "-")
          //     zoneValue = normalizeZoneText(masterMeta?.zoneNo);
          //   else zoneValue = normalizeZoneText(item.zoneNo ?? item.zone ?? "-");
          // } else {
          //   zoneValue = normalizeZoneText(item.zoneNo ?? item.zone ?? "-");
          // }

    let zoneValue = "-";

if (which === 1) {
  if (branchNameNormZone !== "-") zoneValue = branchNameNormZone;
  else if (normalizeZoneText(nmoMeta?.zoneNo) !== "-")
    zoneValue = normalizeZoneText(nmoMeta?.zoneNo);
  else if (normalizeZoneText(masterMeta?.zoneNo) !== "-")
    zoneValue = normalizeZoneText(masterMeta?.zoneNo);
  else zoneValue = normalizeZoneText(item.zoneNo ?? item.zone ?? "-");
} else {
  // JTRACK-2: minimal processing for speed
  zoneValue = item.zoneNo ?? item.zone ?? "-";
}


          const base = {
            id: baseId,
            trackKey,
            lat: ll.lat,
            lng: ll.lng,
            label: regNorm || item.vehicle_number || "",
            regNo: regNorm || item.vehicle_number || "",
            vehicleType: vehicleTypeValue,
            type: vehicleTypeValue,
            zoneNo: zoneValue,
            zone: zoneValue,
            branch_id: branchIdLive || nmoMeta?.branchId || "-",
            branch_name: item.branch_name ?? branchNameRaw ?? "-",
            branchName: branchNameRaw,
            location: item.location_name || item.locationName || item.location || "-",
            gps_datetime: item.gps_datetime,
            speed: item.speed,
            heading: item.heading ?? item.bearing ?? null,
            raw: item,
            t: item.gps_datetime ?? Date.now(),
          };

          return applyMaster(batchMaster, toVehicle(source, base));
        })
        .filter(Boolean);

      // dispatch(ingestVehicleSamples({ source, vehicles: mapped }));
      // return { source, vehicles: mapped };

        const existing = getState().vehicles.entities;

const filtered = mapped.filter((v) => {
  const old = existing[v.uid];
  if (!old) return true;

  // Update only if position or time changed
  return (
    old.lat !== v.lat ||
    old.lng !== v.lng ||
    old.speed !== v.speed ||
    old.gps_datetime !== v.gps_datetime
  );
});

dispatch(ingestVehicleSamples({ source, vehicles: filtered }));
return { source, vehicles: filtered };

    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e?.message || "JTrack failed");
    }
  }
);




/* ✅ Batch Live */
export const fetchBatchLive = createAsyncThunk(
  "vehicles/fetchBatchLive",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const res = await axios.request({
        url: BATCH_MECH_LIVE_URL,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...noCacheHeaders,
          ...BATCH_MECH_HEADERS,
        },
        data: { date: todayYYYYMMDD() },
        timeout: 20000,
      });

      const json = res.data;
      const rows = extractArray(json, ["data", "vehicles", "result"]);
      const { batchMaster } = getState().vehicles;

      const mapped = (rows || [])
        .map((r, idx) => {
          const ll = getLatLng(r);
          if (!ll) return null;

          const reg =
            r?.regNo || r?.vehicle_no || r?.vehicleNo || r?.vehicle_number || r?.vehicleNumber || "";
          const id = reg || r?.chassisNo || r?.deviceId || `b-${idx}`;
          const trackKey = r?.deviceId || reg || id;

          const base = {
            id,
            trackKey,
            regNo: reg,
            lat: ll.lat,
            lng: ll.lng,
            label: reg ? reg.toString() : "",
            speed: r?.speed ?? r?.vehicleSpeed ?? r?.gps_speed ?? "-",
            status: r?.status ?? r?.vehicleStatus ?? "-",
            ts: r?.updatedAt ?? r?.gps_datetime ?? r?.lastUpdated ?? Date.now(),
            heading: r?.heading ?? r?.bearing ?? null,
            vehicleType: pickVehicleType(r),
            fuelCapacity: pickFuelCapacity(r),
            location: r?.address || r?.location_name || r?.locationName || r?.location || "-",
            raw: r,
            t: r?.updatedAt ?? r?.gps_datetime ?? r?.lastUpdated ?? Date.now(),
          };

          return applyMaster(batchMaster, toVehicle("batch", base));
        })
        .filter(Boolean);

      dispatch(ingestVehicleSamples({ source: "batch", vehicles: mapped }));
      return { source: "batch", vehicles: mapped };
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e?.message || "Batch live failed");
    }
  }
);

/* ✅ Batch Health */
export const fetchBatchHealth = createAsyncThunk(
  "vehicles/fetchBatchHealth",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const res = await axios.request({
        url: BATCH_HEALTH_VEHICLE_URL,
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...noCacheHeaders,
          ...BATCH_MECH_HEADERS,
        },
        data: { date: todayYYYYMMDD() },
        timeout: 20000,
      });

      const json = res.data;
      const rows = extractArray(json, ["data", "vehicles", "result"]);
      const { batchMaster } = getState().vehicles;

      const mapped = (rows || [])
        .map((r, idx) => {
          const ll = getLatLng(r);
          if (!ll) return null;

          const reg =
            r?.regNo || r?.vehicle_no || r?.vehicleNo || r?.vehicle_number || r?.vehicleNumber || "";
          const id = reg || r?.chassisNo || r?.deviceId || `h-${idx}`;
          const trackKey = r?.deviceId || reg || id;

          const base = {
            id,
            trackKey,
            regNo: reg,
            lat: ll.lat,
            lng: ll.lng,
            label: reg ? reg.toString() : "",
            speed: r?.speed ?? r?.vehicleSpeed ?? r?.gps_speed ?? "-",
            status: r?.status ?? r?.vehicleStatus ?? "-",
            ts: r?.updatedAt ?? r?.gps_datetime ?? r?.lastUpdated ?? Date.now(),
            heading: r?.heading ?? r?.bearing ?? null,
            vehicleType: pickVehicleType(r),
            fuelCapacity: pickFuelCapacity(r),
            location: r?.location_name || r?.locationName || r?.location || "-",
            health: r?.health ?? r?.vehicle_health ?? "-",
            raw: r,
            t: r?.updatedAt ?? r?.gps_datetime ?? r?.lastUpdated ?? Date.now(),
          };

          return applyMaster(batchMaster, toVehicle("health", base));
        })
        .filter(Boolean);

      dispatch(ingestVehicleSamples({ source: "health", vehicles: mapped }));
      return { source: "health", vehicles: mapped };
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e?.message || "Batch health failed");
    }
  }
);

/* ✅ VECV Live (generate token once + reuse, refresh on expiry/401) */
export const fetchVecvLive = createAsyncThunk(
  "vehicles/fetchVecvLive",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      if (!VECV_API_KEY) throw new Error("VECV_API_KEY missing.");
      if (!VECV_CLIENT_ID || VECV_CLIENT_ID.length < 10)
        throw new Error("ClientId looks incomplete. Paste FULL VECV clientId.");

      const st = getState().vehicles;
      const storageKey = st.vecvTokenStorageKey;

      // 1) try redux/localStorage cache first
      const metaLs = loadJson(VECV_TOKEN_META_LS_KEY);
      let token =
        (st.vecvToken && isVecvTokenValid({ token: st.vecvToken, fetchedAt: st.vecvTokenFetchedAt }, st.vecvTokenTtlMs)
          ? st.vecvToken
          : "") ||
        (isVecvTokenValid(metaLs, st.vecvTokenTtlMs) ? metaLs.token : "") ||
        loadToken(storageKey);

      // 2) if no valid token -> generate ONCE and reuse
      if (!token) {
        token = await getVecvTokenCached({
          apiKey: VECV_API_KEY,
          ttlMs: st.vecvTokenTtlMs,
          storageKey,
          dispatch,
        });
      }

      // helper to call live once
      const callLive = async (tkn) => {
        return axios.post(
          withBuster(VECV_LIVE_URL),
          { clientId: VECV_CLIENT_ID },
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              ...noCacheHeaders,
              "API-KEY": VECV_API_KEY,
              Authorization: `Bearer ${tkn}`,
            },
            timeout: 20000,
          }
        );
      };

      let res;
      try {
        res = await callLive(token);
      } catch (e) {
        // if token is invalid/expired => clear + regenerate once + retry
        const status = e?.response?.status;
        if (status === 401) {
          // clear caches
          saveJson(VECV_TOKEN_META_LS_KEY, null);
          saveToken(storageKey, "");
          dispatch(vehiclesSlice.actions._setVecvTokenState({ token: "", fetchedAt: 0 }));

          // regenerate once (shared promise)
          const fresh = await getVecvTokenCached({
            apiKey: VECV_API_KEY,
            ttlMs: st.vecvTokenTtlMs,
            storageKey,
            dispatch,
          });

          res = await callLive(fresh);
          token = fresh;
        } else {
          throw e;
        }
      }

      const rows = extractArray(res?.data || {}, ["locationData"]);
      const { batchMaster } = getState().vehicles;

      const mapped = (rows || [])
        .map((r, idx) => {
          const lat = r?.latitude != null ? parseFloat(r.latitude) : null;
          const lng = r?.longitude != null ? parseFloat(r.longitude) : null;
          if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

          const deviceId = r?.deviceId || "";
          const id = r?.regNo || r?.chassisNo || deviceId || `vecv-${idx}`;
          const trackKey = deviceId || r?.chassisNo || r?.regNo || id;

          const base = {
            id,
            trackKey,
            deviceId,
            regNo: r?.regNo,
            chassisNo: r?.chassisNo,
            lat,
            lng,
            vehicleStatus: r?.vehicleStatus,
            lastUpdated: r?.lastUpdated,
            epochTime: r?.epochTime,
            speed: r?.vehicleSpeed ?? r?.speed ?? "-",
            heading: r?.heading ?? r?.bearing ?? null,
            label: safeLabelVecv(r),
            vehicleType: r?.vehicleType ?? r?.vehicle_type ?? "-",
            fuelCapacity: r?.fuelCapacity ?? r?.fuel_capacity ?? "-",
            address: r?.address || "-",
            location: r?.address || r?.location_name || r?.locationName || r?.location || "-",
            raw: r,
            t: r?.epochTime ?? r?.lastUpdated ?? Date.now(),
          };

          return applyMaster(batchMaster, toVehicle("vecv", base));
        })
        .filter(Boolean);

      dispatch(ingestVehicleSamples({ source: "vecv", vehicles: mapped }));
      return { token, tokenFetchedAt: Date.now(), source: "vecv", vehicles: mapped };
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e?.message || "VECV live failed");
    }
  }
);

/* ✅ GPSTRACK Live */
export const fetchGpsTrackLive = createAsyncThunk(
  "vehicles/fetchGpsTrackLive",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const res = await axios.get(withBuster(GPSTRACK_LIVE_URL), {
        headers: { Accept: "application/json", ...noCacheHeaders },
        timeout: 20000,
      });

      const json = res.data;
      let rows = extractArray(json, ["data", "vehicles", "result"]);
      if (!Array.isArray(rows) && rows && typeof rows === "object") rows = Object.values(rows);

      const { batchMaster } = getState().vehicles;

      const mapped = (rows || [])
        .map((r, idx) => {
          const ll = getLatLng(r);
          if (!ll) return null;

          const deviceId = r?.deviceId ?? r?.device_id ?? r?.imei ?? r?.imei_no ?? "";
          const reg = r?.regNo || r?.vehicleNo || r?.vehicle || r?.name || "";

          const id = reg || deviceId || `gps-${idx}`;
          const trackKey = deviceId || reg || id;

          const base = {
            id,
            trackKey,
            deviceId,
            regNo: reg,
            lat: ll.lat,
            lng: ll.lng,
            label: safeLabelGps({ ...r, regNo: reg, id }),
            speed: r?.speed ?? "-",
            status: r?.vehicleStatus ?? r?.ignitionStatus ?? r?.status ?? "-",
            ts: r?.date ?? r?.serverTime ?? r?.isoDate ?? Date.now(),
            heading: r?.heading ?? r?.bearing ?? null,
            vehicleType: r?.vehicleType ?? pickVehicleType(r),
            fuelCapacity: pickFuelCapacity(r),
            address: r?.address || "-",
            location: r?.address || r?.location_name || r?.locationName || r?.location || "-",
            raw: r,
            t: r?.date ?? r?.serverTime ?? r?.isoDate ?? Date.now(),
          };

          return applyMaster(batchMaster, toVehicle("gpstrack", base));
        })
        .filter(Boolean);

      dispatch(ingestVehicleSamples({ source: "gpstrack", vehicles: mapped }));
      return { source: "gpstrack", vehicles: mapped };
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e?.message || "GPS Track failed");
    }
  }
);

/* ✅ iALERT2 Live (reuse token; localStorage overrides hardcoded) */
export const fetchIalert2Live = createAsyncThunk(
  "vehicles/fetchIalert2Live",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const token = getIalert2Token();
      if (!token) throw new Error("iAlert2 token missing");

      // NOTE: keep BOTH param + Authorization because your earlier setup suggests server might expect either.
      const res = await axios.get(withBuster(IALERT2_LIVE_PATH), {
        params: { token },
        headers: {
          Accept: "application/json",
          ...noCacheHeaders,
          Authorization: `Bearer ${token}`,
        },
        timeout: 25000,
      });

      const json = res.data;

      // API might return 200 + {message:"Invalid token"}
      if (json && !Array.isArray(json) && typeof json === "object") {
        const msg = String(json?.message || json?.error || "").toLowerCase();
        if (msg.includes("invalid") && msg.includes("token")) {
          return rejectWithValue(json?.message || "iAlert2 invalid token");
        }
      }

      const rows = Array.isArray(json) ? json : extractArray(json, ["data", "result", "vehicles"]);
      if (!Array.isArray(rows)) {
        return rejectWithValue(json?.message || "iAlert2 returned non-array response");
      }

      const { batchMaster } = getState().vehicles;

      const mapped = (rows || [])
        .map((r, idx) => {
          const lat0 = r?.latitude != null ? Number(r.latitude) : null;
          const lng0 = r?.longitude != null ? Number(r.longitude) : null;

          const ll =
            Number.isFinite(lat0) && Number.isFinite(lng0) && !(lat0 === 0 && lng0 === 0)
              ? { lat: lat0, lng: lng0 }
              : getLatLng(r);

          if (!ll) return null;

          const regRaw =
            r?.vehicleregnumber ||
            r?.vehicleRegNumber ||
            r?.regNo ||
            r?.vehicle_no ||
            r?.vehicle_number ||
            "";

          const reg = normalizeReg(regRaw);
          const id = reg || `ialert2-${idx}`;
          const trackKey = reg || id;

          const bat = r?.batlevel;

          const base = {
            id,
            trackKey,
            regNo: reg,
            label: reg || safeLabelIalert2({ ...r, id }),

            lat: ll.lat,
            lng: ll.lng,

            gps_datetime: r?.datetime,
            datetime: r?.datetime,

            speed: r?.speed ?? "-",
            ignition: r?.ignition,
            heading: r?.heading ?? r?.bearing ?? null,
            odometer: r?.odometer,

            batlevel: bat,
            fuelAvailability: bat != null ? `${bat} V` : "-",

            altitude: r?.altitude,
            ts: r?.datetime ?? Date.now(),
            raw: r,
            t: r?.datetime ?? Date.now(),
          };

          return applyMaster(batchMaster, toVehicle("ialert2", base));
        })
        .filter(Boolean);

      dispatch(ingestVehicleSamples({ source: "ialert2", vehicles: mapped }));
      return { source: "ialert2", vehicles: mapped, tokenUsed: token };
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e?.message || "iAlert2 failed");
    }
  }
);

/* ✅ FleetX Live */
export const fetchFleetxLive = createAsyncThunk(
  "vehicles/fetchFleetxLive",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const res = await axios.get(withBuster(FLEETX_LIVE_URL), {
        headers: {
          Accept: "application/json",
          ...noCacheHeaders,
          Authorization: `Bearer ${FLEETX_ACCESS_TOKEN}`,
        },
        timeout: 20000,
      });

      const rows = extractArray(res?.data || {}, ["vehicles", "data", "result"]);
      const { batchMaster } = getState().vehicles;

      const mapped = (rows || [])
        .map((r, idx) => {
          const ll = getLatLng(r);
          if (!ll) return null;

          const reg =
            r?.vehicleNumber ||
            r?.vehicle_no ||
            r?.registrationNumber ||
            r?.regNo ||
            r?.number ||
            "";
          const id = reg || r?.vehicleId || r?.id || `fleetx-${idx}`;
          const trackKey = r?.deviceId || reg || id;

          const fuelType = pickFleetxFuelType(r);

          const base = {
            id,
            trackKey,
            regNo: reg,
            label: safeLabelFleetx({ ...r, regNo: reg, id }),
            lat: ll.lat,
            lng: ll.lng,
            speed: r?.speed ?? r?.vehicleSpeed ?? "-",
            heading: r?.otherAttributes?.course ?? r?.heading ?? r?.bearing ?? null,
            fuelType,
            vehicleType: r?.vehicleTypeValue ?? r?.vehicleType ?? r?.vehicleModel ?? "-",
            location: r?.address || "-",
            ts:
              r?.lastUpdatedAt ??
              r?.lastStatusTime ??
              r?.ts ??
              r?.time ??
              Date.now(),
            raw: r,
            t: r?.lastUpdatedAt ?? r?.lastStatusTime ?? Date.now(),
          };

          return applyMaster(batchMaster, toVehicle("fleetx", base));
        })
        .filter(Boolean);

      dispatch(ingestVehicleSamples({ source: "fleetx", vehicles: mapped }));
      return { source: "fleetx", vehicles: mapped, fleetxRaw: res?.data ?? null };
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e?.message || "FleetX failed");
    }
  }
);

/* ✅ VAMOSYS Live */
export const fetchVamosysLive = createAsyncThunk(
  "vehicles/fetchVamosysLive",
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const res = await axios.get(withBuster(VAMOSYS_LIVE_URL), {
        headers: { Accept: "application/json", ...noCacheHeaders },
        timeout: 25000,
      });

      const json = res.data;
      let rows = extractArray(json, ["data", "result", "vehicles", "response"]);
      if (!Array.isArray(rows) && rows && typeof rows === "object") rows = Object.values(rows);

      const { batchMaster } = getState().vehicles;

      const mapped = (rows || [])
        .map((r, idx) => {
          const ll = getLatLng(r);
          if (!ll) return null;

          const reg =
            r?.regNo ||
            r?.vehicleNo ||
            r?.vehicle_number ||
            r?.vehicleNumber ||
            r?.vehicle_no ||
            r?.vehicleregnumber ||
            r?.vehicleRegNumber ||
            "";

          const id = normalizeReg(reg) || r?.id || `vamosys-${idx}`;
          const trackKey = r?.deviceId || r?.imei || id;

          const base = {
            id,
            trackKey,
            regNo: reg,
            label: normalizeReg(reg) || `VAMOSYS-${idx + 1}`,
            lat: ll.lat,
            lng: ll.lng,

            zoneNo: normalizeZoneText(pickZoneNo(r)),
            wardNo: pickWardNo(r),
            location: pickLocation(r),

            fuelType: "EV",

            speed: r?.speed ?? r?.vehicleSpeed ?? r?.gps_speed ?? "-",
            heading: r?.heading ?? r?.bearing ?? null,

            ts:
              r?.datetime ??
              r?.gps_datetime ??
              r?.lastUpdated ??
              r?.epochTime ??
              Date.now(),
            raw: r,
            t:
              r?.datetime ??
              r?.gps_datetime ??
              r?.lastUpdated ??
              r?.epochTime ??
              Date.now(),
          };

          return applyMaster(batchMaster, toVehicle("vamosys", base));
        })
        .filter(Boolean);

      dispatch(ingestVehicleSamples({ source: "vamosys", vehicles: mapped }));
      return { source: "vamosys", vehicles: mapped };
    } catch (e) {
      return rejectWithValue(e?.response?.data?.message || e?.message || "VAMOSYS failed");
    }
  }
);

/* ======================
   Polling controller thunk
====================== */
// ✅ replace your _intervals polling with sequential polling
let _seqTimer = null;
let _seqRunning = false;

// const SEQ_DELAY_MS = 10 * 1000; // 10s gap between each API call

const SEQ_DELAY_MS = 3000; // faster rotation

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export const startPolling = createAsyncThunk(
  "vehicles/startPolling",
  async (_, { dispatch, getState }) => {
    const st = getState().vehicles;
    if (st.polling.running) return;

    dispatch(setLoading(true));

    // ✅ Initial load (ONE BY ONE) - no parallel
    try { await dispatch(fetchBatchMaster()); } catch {}
    try { await dispatch(fetchJtrack1ZoneMaster()); } catch {}
    try { await dispatch(fetchJtrack1Nmo()); } catch {}

    try { await dispatch(fetchJtrack({ which: 1 })); } catch {}
    await sleep(300);
    try { await dispatch(fetchJtrack({ which: 2 })); } catch {}
    await sleep(300);

    try { await dispatch(fetchBatchLive()); } catch {}
    await sleep(300);
    try { await dispatch(fetchBatchHealth()); } catch {}
    await sleep(300);

    try { await dispatch(fetchVecvLive()); } catch {}
    await sleep(300);
    try { await dispatch(fetchGpsTrackLive()); } catch {}
    await sleep(300);
    try { await dispatch(fetchIalert2Live()); } catch {}
    await sleep(300);
    try { await dispatch(fetchFleetxLive()); } catch {}
    await sleep(300);
    try { await dispatch(fetchVamosysLive()); } catch {}

    dispatch(setLoading(false));

    // ✅ Sequential loop forever (10s gap)
    _seqRunning = true;

    // const jobs = [
    //   () => dispatch(fetchJtrack({ which: 1 })),
    //   () => dispatch(fetchJtrack({ which: 2 })),

    //   () => dispatch(fetchBatchLive()),
    //   () => dispatch(fetchBatchHealth()),

    //   () => dispatch(fetchVecvLive()),
    //   () => dispatch(fetchGpsTrackLive()),
    //   () => dispatch(fetchIalert2Live()),
    //   () => dispatch(fetchFleetxLive()),
    //   () => dispatch(fetchVamosysLive()),

    //   // ✅ masters (keep at end, less important)
    //   () => dispatch(fetchBatchMaster()),
    //   () => dispatch(fetchJtrack1ZoneMaster()),
    //   () => dispatch(fetchJtrack1Nmo()),
    // ];

    const jobs = [
  () => dispatch(fetchJtrack({ which: 1 })),
  () => dispatch(fetchJtrack({ which: 2 })),

  () => dispatch(fetchBatchLive()),
  () => dispatch(fetchBatchHealth()),

  () => dispatch(fetchVecvLive()),
  () => dispatch(fetchGpsTrackLive()),
  () => dispatch(fetchIalert2Live()),
  () => dispatch(fetchFleetxLive()),
  () => dispatch(fetchVamosysLive()),
];


    let idx = 0;

    const runNext = async () => {
      if (!_seqRunning) return;

      const job = jobs[idx % jobs.length];
      idx += 1;

      try {
        await job(); // wait current API call to finish
      } catch (e) {
        // ignore and continue
      }

      _seqTimer = setTimeout(runNext, SEQ_DELAY_MS);
    };

    runNext();

    return true;
  }
);

export const stopPolling = createAsyncThunk("vehicles/stopPolling", async () => {
  _seqRunning = false;
  if (_seqTimer) clearTimeout(_seqTimer);
  _seqTimer = null;
  return true;
});


/* ======================
   Slice
====================== */
const vehiclesSlice = createSlice({
  name: "vehicles",
  initialState,
  reducers: {
    _setVecvTokenInFlight(state, action) {
      state.vecvTokenInFlight = !!action.payload;
    },
    _setVecvTokenState(state, action) {
      state.vecvToken = action.payload?.token || "";
      state.vecvTokenFetchedAt = Number(action.payload?.fetchedAt || 0);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBatchMaster.fulfilled, (state, action) => {
        state.batchMaster = action.payload || {};
      })
      .addCase(fetchJtrack1ZoneMaster.fulfilled, (state, action) => {
        state.jtrack1BranchMeta = action.payload || {};
      })
      .addCase(fetchJtrack1Nmo.fulfilled, (state, action) => {
        state.jtrack1NmoByReg = action.payload || {};
      })

      .addCase(fetchJtrack.fulfilled, (state, action) => {
        vehiclesAdapter.upsertMany(state, action.payload?.vehicles || []);
      })
      .addCase(fetchBatchLive.fulfilled, (state, action) => {
        vehiclesAdapter.upsertMany(state, action.payload?.vehicles || []);
      })
      .addCase(fetchBatchHealth.fulfilled, (state, action) => {
        vehiclesAdapter.upsertMany(state, action.payload?.vehicles || []);
      })
      .addCase(fetchVecvLive.fulfilled, (state, action) => {
        if (action.payload?.token) {
          state.vecvToken = action.payload.token;
          state.vecvTokenFetchedAt = action.payload.tokenFetchedAt || state.vecvTokenFetchedAt;
        }
        vehiclesAdapter.upsertMany(state, action.payload?.vehicles || []);
      })
      .addCase(fetchGpsTrackLive.fulfilled, (state, action) => {
        vehiclesAdapter.upsertMany(state, action.payload?.vehicles || []);
      })
      .addCase(fetchIalert2Live.fulfilled, (state, action) => {
        state.ialert2TokenUsed = action.payload?.tokenUsed || state.ialert2TokenUsed;
        vehiclesAdapter.upsertMany(state, action.payload?.vehicles || []);
      })
      .addCase(fetchFleetxLive.fulfilled, (state, action) => {
        state.fleetxRaw = action.payload?.fleetxRaw ?? state.fleetxRaw;
        vehiclesAdapter.upsertMany(state, action.payload?.vehicles || []);
      })
      .addCase(fetchVamosysLive.fulfilled, (state, action) => {
        vehiclesAdapter.upsertMany(state, action.payload?.vehicles || []);
      })

      .addCase(startPolling.fulfilled, (state) => {
        state.polling.running = true;
        state.polling.ids = {};
      })
      .addCase(stopPolling.fulfilled, (state) => {
        state.polling.running = false;
        state.polling.ids = {};
      });
  },
});

export default vehiclesSlice.reducer;

/* ======================
   Selectors
====================== */
export const vehiclesSelectors = vehiclesAdapter.getSelectors((s) => s.vehicles);
export const selectAllVehicles = vehiclesSelectors.selectAll;

export const selectVehiclesBySource = (state, source) => {
  const all = selectAllVehicles(state);
  return all.filter((v) => v.source === source);
};



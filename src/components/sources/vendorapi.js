// // src/api/vendorApi.js
// import axios from "axios";

// const API_BASE = process.env.REACT_APP_API_BASE || "";

// const http = axios.create({
//   baseURL: API_BASE,
//   timeout: 25000,
//   headers: { Accept: "application/json" },
// });

// export async function fetchJtrack1() {
//   const res = await http.get("/api/vendors/jtrack1", { params: { _: Date.now() } });
//   return res.data;
// }

// export async function fetchJtrack2() {
//   const res = await http.get("/api/vendors/jtrack2", { params: { _: Date.now() } });
//   return res.data;
// }

// export async function fetchIalert2() {
//   const res = await http.get("/api/vendors/ialert2", { params: { _: Date.now() } });
//   return res.data;
// }

// export async function fetchFleetx() {
//   const res = await http.get("/api/vendors/fleetx", { params: { _: Date.now() } });
//   return res.data;
// }

// export async function fetchVecv() {
//   const res = await http.get("/api/vendors/vecv", { params: { _: Date.now() } });
//   return res.data;
// }

// export async function fetchBatch() {
//   const res = await http.get("/api/vendors/batch", { params: { _: Date.now() } });
//   return res.data;
// }

// export async function fetchGpstrack() {
//   const res = await http.get("/api/vendors/gpstrack", { params: { _: Date.now() } });
//   return res.data;
// }

// export async function fetchVamosys() {
//   const res = await http.get("/api/vendors/vamosys", { params: { _: Date.now() } });
//   return res.data;
// }


// src/api/vendorApi.js
import axios from "axios";

/**
 * NO PROXY + NO ENV VERSION
 * - Direct vendor calls from browser
 * - Tokens/params are hardcoded here
 * - Expect CORS errors if vendor doesn't allow your domain
 */

const http = axios.create({
  timeout: 25000,
  headers: { Accept: "application/json" },
});

// cache buster (prevents browser caching)
const buster = () => ({ _: Date.now() });

async function get(url, config = {}) {
  const res = await http.get(url, config);
  return res.data;
}

/* =========================
   FleetX (Bobcat)
   https://api.fleetx.io/api/v1/analytics/live
========================= */
export async function fetchFleetx() {
  return get("https://api.fleetx.io/api/v1/analytics/live", {
    params: buster(),
  });
}

/* =========================
   GPSTRACK (Ambiguous)
   https://app.gpstrack.in/api/get_current_data?token=...&email=...
========================= */
export async function fetchGpstrack() {
  return get("https://app.gpstrack.in/api/get_current_data", {
    params: {
      token: "Cj2MQDxNBj5WlVoRBp5iRlr4miRaJNnR",
      email: "amphibiousex@gmail.com",
      ...buster(),
    },
  });
}

/* =========================
   VECV (Eicher)
   https://partnerapi.vecv.net/service-gateway/vehicle/v1/getlivedata/location
========================= */
export async function fetchVecv() {
  return get(
    "https://partnerapi.vecv.net/service-gateway/vehicle/v1/getlivedata/location",
    { params: buster() }
  );
}

/* =========================
   VAMOSYS
   https://api.vamosys.com/mobile/getGrpDataForTrustedClients?providerName=...&fcode=...
========================= */
export async function fetchVamosys() {
  return get("https://api.vamosys.com/mobile/getGrpDataForTrustedClients", {
    params: {
      providerName: "GREATERCHENNAICORPORATION",
      fcode: "VAMTO",
      ...buster(),
    },
  });
}

/* =========================
   iALERT2 (Truckmounted)
   https://ialertelite.ashokleyland.com/ialert/daas/api/getdata?token=...
========================= */
export async function fetchIalert2() {
  return get("https://ialertelite.ashokleyland.com/ialert/daas/api/getdata", {
    params: {
      token:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJNalE1TVRReSIsImF1ZCI6IkRBQVMifQ.-hVuFx_Eh1IYn4PMMVs8Mke-sqWbJyH17aFtK3GVbd0",
      ...buster(),
    },
  });
}

/* =========================
   JTRACK1 / JTRACK2 / BATCHMASTER
   You didn't give exact vendor URLs for these.
   Replace the placeholder URLs below with the real endpoints.
========================= */

// ✅ Put the exact endpoint you use for JTrack-1 here:
const JTRACK1_URL = "https://jtrack.in/REPLACE_WITH_REAL_ENDPOINT";

// ✅ Put the exact endpoint you use for JTrack-2 here:
const JTRACK2_URL = "https://jtrack.in/REPLACE_WITH_REAL_ENDPOINT";

// ✅ Put the exact endpoint you use for Batchmaster here:
const BATCH_URL = "https://gcc.batchmaster.in/REPLACE_WITH_REAL_ENDPOINT";

export async function fetchJtrack1() {
  return get(JTRACK1_URL, { params: buster() });
}

export async function fetchJtrack2() {
  return get(JTRACK2_URL, { params: buster() });
}

export async function fetchBatch() {
  return get(BATCH_URL, { params: buster() });
}

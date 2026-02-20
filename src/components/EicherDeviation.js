// import { useEffect, useState, useRef } from "react";
// import {
//   GoogleMap,
//   useLoadScript,
//   Marker,
//   InfoWindow,
//   Polyline,
// } from "@react-google-maps/api";

// import wardGeoJson from "../assets/WARD_2022.json";
// import zoneGeoJson from "../assets/ZONE_2022.json";

// const containerStyle = {
//   width: "100%",
//   height: "100vh",
// };

// const API_KEY =
//   process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAP_KEY";

// /* =========================
//    🔐 VECV CONFIG
// ========================= */

// const VECV_TOKEN_URL =
//   "https://partnerapi.vecv.net/service-gateway/secure/genrateToken";

// const VECV_LIVE_URL =
//   "https://partnerapi.vecv.net/live-location-service/vehicle/v1/getlivedata/location";

// const VECV_API_KEY = "6c441a37-fe94-4fcb-a07f-beb4b637bf3a";
// const VECV_CLIENT_ID = "08a1f851-5ece-42"; // must be full client id

// /* ========================= */

// function getHeading(prev, curr) {
//   if (!prev) return 0;

//   const toRad = (d) => (d * Math.PI) / 180;
//   const toDeg = (r) => (r * 180) / Math.PI;

//   const lat1 = toRad(prev.lat);
//   const lat2 = toRad(curr.lat);
//   const dLon = toRad(curr.lng - prev.lng);

//   const y = Math.sin(dLon) * Math.cos(lat2);
//   const x =
//     Math.cos(lat1) * Math.sin(lat2) -
//     Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

//   let brng = toDeg(Math.atan2(y, x));
//   return (brng + 360) % 360;
// }

// export default function EicherDeviation() {
//   const [vehicles, setVehicles] = useState([]);
//   const [filteredVehicles, setFilteredVehicles] = useState([]);
//   const [selectedVehicle, setSelectedVehicle] = useState(null);
//   const [selectedZone, setSelectedZone] = useState(null);
//   const [vehiclePaths, setVehiclePaths] = useState({});
//   const [token, setToken] = useState(null);

//   const mapRef = useRef(null);
//   const zoneLayerRef = useRef(null);
//   const wardLayerRef = useRef(null);
//   const selectedZoneFeatureRef = useRef(null);

//   const { isLoaded } = useLoadScript({
//     googleMapsApiKey: API_KEY,
//     libraries: ["geometry"],
//   });

//   /* =========================
//      🔐 Generate Token
//   ========================= */
//   const generateToken = async () => {
//     try {
//       const res = await fetch(VECV_TOKEN_URL, {
//         method: "POST",
//         headers: {
//           "x-api-key": VECV_API_KEY,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           clientId: VECV_CLIENT_ID,
//         }),
//       });

//       const data = await res.json();
//       setToken(data?.access_token);
//       return data?.access_token;
//     } catch (err) {
//       console.error("Token error:", err);
//       return null;
//     }
//   };

//   /* =========================
//      🚛 Fetch Vehicles
//   ========================= */
//   const fetchVehicles = async (authToken) => {
//     try {
//       const res = await fetch(VECV_LIVE_URL, {
//         method: "GET",
//         headers: {
//           Authorization: `Bearer ${authToken}`,
//           "x-api-key": VECV_API_KEY,
//         },
//       });

//       const data = await res.json();

//       const parsed =
//         data?.data?.map((v) => ({
//           id: v.vehicleNumber || v.vin,
//           lat: Number(v.latitude),
//           lng: Number(v.longitude),
//           speed: v.speed,
//           address: v.location,
//         })) || [];

//       setVehicles(parsed);

//       setVehiclePaths((prev) => {
//         const next = { ...prev };

//         parsed.forEach((v) => {
//           if (!next[v.id]) next[v.id] = [];

//           const last =
//             next[v.id].length > 0
//               ? next[v.id][next[v.id].length - 1]
//               : null;

//           const heading = getHeading(
//             last ? { lat: last.lat, lng: last.lng } : null,
//             { lat: v.lat, lng: v.lng }
//           );

//           next[v.id] = [
//             ...next[v.id],
//             { lat: v.lat, lng: v.lng, heading },
//           ];

//           if (next[v.id].length > 25) next[v.id].shift();
//         });

//         return next;
//       });
//     } catch (err) {
//       console.error("Live fetch error:", err);
//     }
//   };

//   /* =========================
//      🔄 Polling
//   ========================= */
//   useEffect(() => {
//     let interval;

//     const init = async () => {
//       const t = await generateToken();
//       if (!t) return;

//       await fetchVehicles(t);

//       interval = setInterval(() => {
//         fetchVehicles(t);
//       }, 10000);
//     };

//     init();

//     return () => clearInterval(interval);
//   }, []);

//   /* =========================
//      Zone Filter
//   ========================= */
//   useEffect(() => {
//     if (!selectedZone || !selectedZoneFeatureRef.current) {
//       setFilteredVehicles(vehicles);
//       return;
//     }

//     const polyPoints = [];
//     selectedZoneFeatureRef.current
//       .getGeometry()
//       .forEachLatLng((latlng) => polyPoints.push(latlng));

//     const poly = new window.google.maps.Polygon({ paths: polyPoints });

//     const inside = vehicles.filter((v) => {
//       const pt = new window.google.maps.LatLng(v.lat, v.lng);
//       return window.google.maps.geometry.poly.containsLocation(pt, poly);
//     });

//     setFilteredVehicles(inside);
//   }, [vehicles, selectedZone]);

//   if (!isLoaded) return <div>Loading Google Maps...</div>;

//   return (
//     <GoogleMap
//       mapContainerStyle={containerStyle}
//       center={{ lat: 13.0827, lng: 80.2707 }}
//       zoom={12}
//     >
//       {/* Trails */}
//       {filteredVehicles.map((v) => {
//         const pts = (vehiclePaths[v.id] || []).map((p) => ({
//           lat: p.lat,
//           lng: p.lng,
//         }));

//         return (
//           <>
//             {pts.length > 1 && (
//               <Polyline
//                 key={`trail-${v.id}`}
//                 path={pts}
//                 options={{
//                   strokeColor: "#000000",
//                   strokeWeight: 3,
//                 }}
//               />
//             )}

//             <Marker
//               key={`${v.id}-truck`}
//               position={{ lat: v.lat, lng: v.lng }}
//               onClick={() => setSelectedVehicle(v)}
//               icon={{
//                 url: "https://img.icons8.com/?size=100&id=GBcLweAjJ7tN&format=png&color=000000",
//                 scaledSize: new window.google.maps.Size(36, 36),
//                 anchor: new window.google.maps.Point(18, 18),
//               }}
//             />

//             <Marker
//               key={`${v.id}-arrow`}
//               position={{ lat: v.lat, lng: v.lng }}
//               icon={{
//                 path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
//                 scale: 5,
//                 fillColor: "#ff0000",
//                 fillOpacity: 1,
//                 strokeWeight: 1,
//                 rotation:
//                   vehiclePaths[v.id]?.[vehiclePaths[v.id].length - 1]
//                     ?.heading || 0,
//               }}
//               clickable={false}
//             />
//           </>
//         );
//       })}

//       {selectedVehicle && (
//         <InfoWindow
//           position={{
//             lat: selectedVehicle.lat,
//             lng: selectedVehicle.lng,
//           }}
//           onCloseClick={() => setSelectedVehicle(null)}
//         >
//           <div>
//             <b>{selectedVehicle.id}</b>
//             <div>Speed: {selectedVehicle.speed ?? "-"}</div>
//             <div>{selectedVehicle.address ?? "-"}</div>
//           </div>
//         </InfoWindow>
//       )}
//     </GoogleMap>
//   );
// }


import { useEffect, useState, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  InfoWindow,
  Polyline,
} from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "100vh",
};

const API_KEY =
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "YOUR_GOOGLE_MAP_KEY";

/* =========================
   🔐 VECV CONFIG
========================= */

const VECV_TOKEN_URL =
  "https://partnerapi.vecv.net/service-gateway/secure/genrateToken";

const VECV_LIVE_URL =
  "https://partnerapi.vecv.net/live-location-service/vehicle/v1/getlivedata/location";

const VECV_API_KEY = "6c441a37-fe94-4fcb-a07f-beb4b637bf3a";
const VECV_CLIENT_ID = "08a1f851-5ece-42";

/* ========================= */

function getHeading(prev, curr) {
  if (!prev) return 0;

  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(prev.lat);
  const lat2 = toRad(curr.lat);
  const dLon = toRad(curr.lng - prev.lng);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

export default function EicherDeviation() {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehiclePaths, setVehiclePaths] = useState({});
  const [token, setToken] = useState(null);

  const mapRef = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: API_KEY,
  });

  /* =========================
     🔐 Generate Token
  ========================= */
  const generateToken = async () => {
    try {
      const res = await fetch(VECV_TOKEN_URL, {
        method: "POST",
        headers: {
          "x-api-key": VECV_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: VECV_CLIENT_ID,
        }),
      });

      const data = await res.json();
      setToken(data?.access_token);
      return data?.access_token;
    } catch (err) {
      console.error("Token error:", err);
      return null;
    }
  };

  /* =========================
     🚛 Fetch Live Vehicles
  ========================= */
  const fetchVehicles = async (authToken) => {
    try {
      const res = await fetch(VECV_LIVE_URL, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "x-api-key": VECV_API_KEY,
        },
      });

      const data = await res.json();

      const parsed =
        data?.data?.map((v) => ({
          id: v.vehicleNumber || v.vin,
          lat: Number(v.latitude),
          lng: Number(v.longitude),
          speed: v.speed,
          address: v.location,
        })) || [];

      setVehicles(parsed);

      // update trails
      setVehiclePaths((prev) => {
        const next = { ...prev };

        parsed.forEach((v) => {
          if (!next[v.id]) next[v.id] = [];

          const last =
            next[v.id].length > 0
              ? next[v.id][next[v.id].length - 1]
              : null;

          const heading = getHeading(
            last ? { lat: last.lat, lng: last.lng } : null,
            { lat: v.lat, lng: v.lng }
          );

          next[v.id] = [
            ...next[v.id],
            { lat: v.lat, lng: v.lng, heading },
          ];

          if (next[v.id].length > 25) next[v.id].shift();
        });

        return next;
      });
    } catch (err) {
      console.error("Live fetch error:", err);
    }
  };

  /* =========================
     🔄 Polling Every 10s
  ========================= */
  useEffect(() => {
    let interval;

    const init = async () => {
      const t = await generateToken();
      if (!t) return;

      await fetchVehicles(t);

      interval = setInterval(() => {
        fetchVehicles(t);
      }, 10000);
    };

    init();

    return () => clearInterval(interval);
  }, []);

  if (!isLoaded) return <div>Loading Google Maps...</div>;

  return (
    <div style={{ position: "relative" }}>
      {/* Vehicle Counter */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 20,
          background: "white",
          padding: "12px 16px",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          📊 EICHER VEHICLES
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#3B82F6" }}>
          {vehicles.length}
        </div>
      </div>

      <GoogleMap
        mapContainerStyle={containerStyle}
        center={{ lat: 13.0827, lng: 80.2707 }}
        zoom={12}
        onLoad={(map) => (mapRef.current = map)}
      >
        {vehicles.map((v) => {
          const pts = (vehiclePaths[v.id] || []).map((p) => ({
            lat: p.lat,
            lng: p.lng,
          }));

          const heading =
            vehiclePaths[v.id]?.[vehiclePaths[v.id].length - 1]
              ?.heading || 0;

          return (
            <>
              {pts.length > 1 && (
                <Polyline
                  key={`trail-${v.id}`}
                  path={pts}
                  options={{
                    strokeColor: "#000000",
                    strokeWeight: 3,
                  }}
                />
              )}

              {/* Truck Icon */}
              <Marker
                key={`${v.id}-truck`}
                position={{ lat: v.lat, lng: v.lng }}
                onClick={() => setSelectedVehicle(v)}
                icon={{
                  url: "https://img.icons8.com/?size=100&id=GBcLweAjJ7tN&format=png&color=000000",
                  scaledSize: new window.google.maps.Size(36, 36),
                  anchor: new window.google.maps.Point(18, 18),
                }}
              />

              {/* Direction Arrow */}
              <Marker
                key={`${v.id}-arrow`}
                position={{ lat: v.lat, lng: v.lng }}
                icon={{
                  path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 5,
                  fillColor: "#ff0000",
                  fillOpacity: 1,
                  strokeWeight: 1,
                  rotation: heading,
                }}
                clickable={false}
              />
            </>
          );
        })}

        {selectedVehicle && (
          <InfoWindow
            position={{
              lat: selectedVehicle.lat,
              lng: selectedVehicle.lng,
            }}
            onCloseClick={() => setSelectedVehicle(null)}
          >
            <div style={{ minWidth: 160 }}>
              <b>{selectedVehicle.id}</b>
              <div>Speed: {selectedVehicle.speed ?? "-"}</div>
              <div style={{ fontSize: 12 }}>
                {selectedVehicle.address ?? "-"}
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}




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

// Put your key in .env as REACT_APP_GOOGLE_MAPS_API_KEY, or replace below for quick testing
const API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "AIzaSyDLdx6a4kC7pWaM5axn5h9jjRMbxmBDLOw";

/** Returns bearing in degrees from prev -> curr */
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
  brng = (brng + 360) % 360;
  return brng;
}

export default function VehicleDeviation() {
  const [vehicles, setVehicles] = useState([]); // all vehicles
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehiclePaths, setVehiclePaths] = useState({}); // { vehicleId: [{lat,lng,heading}, ...] }

  const mapRef = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: API_KEY,
    libraries: ["geometry"], // needed for containsLocation
  });

  /* ============================
     Poll vehicles and update trails
     ============================ */
  useEffect(() => {
    let mounted = true;

    const fetchVehicles = async () => {
      try {
        const res = await fetch(
          "https://api.vamosys.com/mobile/getGrpDataForTrustedClients?providerName=GREATERCHENNAICORPORATION&fcode=VAMTO"
          
        );
        const data = await res.json();

        const parsed = (data || []).map((v) => ({
          id: v.vehicleId,
          lat: Number(v.lat),
          lng: Number(v.lng),
          speed: v.speed,
          address: v.address,
        }));

        if (!mounted) return;

        setVehicles(parsed);

        // Update vehiclePaths immutably
        setVehiclePaths((prev) => {
          const next = { ...prev };
          parsed.forEach((v) => {
            if (!next[v.id]) next[v.id] = [];

            const last = next[v.id].length ? next[v.id][next[v.id].length - 1] : null;

            const heading = getHeading(
              last ? { lat: last.lat, lng: last.lng } : null,
              { lat: v.lat, lng: v.lng }
            );

            // append new point (with heading)
            next[v.id] = [...next[v.id], { lat: v.lat, lng: v.lng, heading }];

            // cap history length
            const MAX = 25;
            if (next[v.id].length > MAX) next[v.id].shift();
          });
          return next;
        });
      } catch (err) {
        console.error("fetchVehicles error:", err);
      }
    };

    fetchVehicles();
    const id = setInterval(fetchVehicles, 10000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  /* ============================
     onLoad: initialize map
     ============================ */
  const onLoad = (map) => {
    mapRef.current = map;

    // initial view set once
    map.setCenter({ lat: 13.0827, lng: 80.2707 });
    map.setZoom(12);
  };

  if (!isLoaded) return <div>Loading Google Maps...</div>;

  return (
    <div style={{ position: "relative" }}>
      {/* Vehicle Counter - Top Left */}
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
          minWidth: 200,
        }}
      >
        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.6)", marginBottom: 6, fontWeight: 600 }}>
          📊 VEHICLE STATUS
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#14B8A6" }}>
              {vehicles.length}
            </div>
            <div style={{ fontSize: 11, color: "rgba(0,0,0,0.6)" }}>
              Total Vehicles
            </div>
          </div>
        </div>
      </div>

      <GoogleMap mapContainerStyle={containerStyle} onLoad={onLoad}>
        {/* 1) Movement trails (under markers) */}
        {vehicles.map((v) => {
          const pts = (vehiclePaths[v.id] || []).map((p) => ({ lat: p.lat, lng: p.lng }));
          if (pts.length < 2) return null;
          return (
            <Polyline
              key={`trail-${v.id}`}
              path={pts}
              options={{
                strokeColor: "#000000",
                strokeOpacity: 0.9,
                strokeWeight: 3,
              }}
            />
          );
        })}

        {/* 2) Markers: truck + arrow (arrow rotated by heading) */}
        {vehicles.map((v) => {
          const path = vehiclePaths[v.id] || [];
          const last = path.length ? path[path.length - 1] : null;
          const heading = last ? last.heading : 0;

          // two markers: base truck PNG + arrow symbol on top
          return [
            <Marker
              key={`${v.id}-truck`}
              position={{ lat: v.lat, lng: v.lng }}
              icon={{
                url: "https://img.icons8.com/?size=100&id=GBcLweAjJ7tN&format=png&color=000000",
                scaledSize: new window.google.maps.Size(36, 36),
                anchor: new window.google.maps.Point(18, 18),
              }}
              onClick={() => setSelectedVehicle(v)}
            />,
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
                // anchor isn't supported on SymbolPath the same way — rotation center is fine
              }}
              clickable={false}
            />,
          ];
        })}

        {/* InfoWindow */}
        {selectedVehicle && (
          <InfoWindow
            position={{ lat: selectedVehicle.lat, lng: selectedVehicle.lng }}
            onCloseClick={() => setSelectedVehicle(null)}
          >
            <div style={{ minWidth: 160 }}>
              <b>{selectedVehicle.id}</b>
              <div>Speed: {selectedVehicle.speed ?? "-"}</div>
              <div style={{ fontSize: 12, color: "#444" }}>{selectedVehicle.address}</div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}





	



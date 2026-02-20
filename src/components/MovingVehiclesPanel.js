import React, { useState } from "react";

/**
 * ✅ Moving Vehicles Panel Component (FULL UPDATED)
 *
 * Features:
 * - Vendor filter dropdown (sticky)
 * - Sticky header with count
 * - Click row to locate vehicle on map
 * - Vendor color strip + vendor pill
 * - Handles missing lat/lng safely
 * - ✅ Includes VAMOSYS support
 */
export const MovingVehiclesPanel = ({
  movingVehicles,
  j1Vehicles,
  j2Vehicles,
  bVehicles,
  vVehicles,
  gVehicles,
  i2Vehicles,
  fVehicles,
  vaVehicles, // ✅ VAMOSYS vehicles array
  SOURCE_META,
  locateOnMap,
}) => {
  // ✅ Vendor filter state
  const [filterVendor, setFilterVendor] = useState("all");

  /**
   * ✅ Get vehicle object from "source:trackKey"
   * Example movingId: "jtrack1:ABC123"
   */
  const getVehicleFromMovingId = (movingId) => {
    if (!movingId) return null;

    const [sourceRaw, trackKeyRaw] = String(movingId).split(":");
    const source = String(sourceRaw || "");
    const trackKey = String(trackKeyRaw || "");

    const vehicleArrays = {
      jtrack1: j1Vehicles,
      jtrack2: j2Vehicles,
      batch: bVehicles,
      vecv: vVehicles,
      gpstrack: gVehicles,
      ialert2: i2Vehicles,
      fleetx: fVehicles,
      vamosys: vaVehicles, // ✅ added
    };

    const vehicles = vehicleArrays[source];
    if (!Array.isArray(vehicles)) return null;

    return vehicles.find(
      (v) => String(v?.trackKey ?? v?.id ?? "") === trackKey
    );
  };

  // ✅ Filter moving vehicles by vendor
  const filteredMovingVehicles = Array.from(movingVehicles || []).filter(
    (movingId) => {
      if (filterVendor === "all") return true;
      const [source] = String(movingId).split(":");
      return source === filterVendor;
    }
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 350,
        right: 12,
        width: 300,
        maxHeight: 320,
        overflow: "auto",
        background: "rgba(255,255,255,0.98)",
        borderRadius: 14,
        border: "1px solid rgba(15,23,42,0.12)",
        boxShadow: "0 18px 40px rgba(15,23,42,0.14)",
        backdropFilter: "blur(6px)",
      }}
    >
      {/* ✅ STICKY HEADER */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 5,
          padding: "10px 12px",
          borderBottom: "1px solid rgba(15,23,42,0.10)",
          background:
            "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,0.96) 100%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background:
              filteredMovingVehicles.length > 0
                ? "rgba(34,197,94,0.14)"
                : "rgba(148,163,184,0.18)",
            border:
              filteredMovingVehicles.length > 0
                ? "1px solid rgba(34,197,94,0.25)"
                : "1px solid rgba(148,163,184,0.30)",
            fontSize: 16,
          }}
        >
          🚗
        </div>

        <div style={{ flex: 1, lineHeight: "16px" }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 12,
              letterSpacing: 0.2,
              color: "rgba(15,23,42,0.95)",
            }}
          >
            Moving Vehicles
          </div>
          <div style={{ fontSize: 10, color: "rgba(100,116,139,0.95)" }}>
            Live movement • Click to locate
          </div>
        </div>

        <div
          style={{
            minWidth: 28,
            height: 24,
            padding: "0 8px",
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 900,
            color: "white",
            background:
              filteredMovingVehicles.length > 0 ? "#22C55E" : "#94A3B8",
          }}
        >
          {filteredMovingVehicles.length}
        </div>
      </div>

      {/* ✅ STICKY FILTER */}
      {/* <div
        style={{
          position: "sticky",
          top: 52,
          zIndex: 4,
          padding: "10px 12px",
          background: "rgba(255,255,255,0.96)",
          borderBottom: "1px solid rgba(15,23,42,0.08)",
        }}
      >
        <select
          value={filterVendor}
          onChange={(e) => setFilterVendor(e.target.value)}
          style={{
            width: "100%",
            height: 34,
            borderRadius: 10,
            border: "1px solid rgba(15,23,42,0.14)",
            padding: "0 10px",
            fontSize: 11,
            fontWeight: 800,
            color: "rgba(15,23,42,0.92)",
            background: "white",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="all">✓ All Vendors ({movingVehicles?.size || 0})</option>
          <option value="jtrack1">🔴 JTrack -1</option>
          <option value="jtrack2">🟠 JTrack -2 (Special Equipment)</option>
          <option value="batch">🟢 Batch Master</option>
          <option value="vecv">🔵 VECV - Eicher</option>
          <option value="gpstrack">🟣 Amphibious</option>
          <option value="ialert2">🟦 Truck Mounted Crane</option>
          <option value="fleetx">🟪 FleetX - Bobcat</option>
          <option value="vamosys">🟤 VamoSys - Enforcement Vehicles</option>
        </select>
      </div> */}

      {/* ✅ BODY */}
      <div style={{ padding: "10px 12px" }}>
        {filteredMovingVehicles.length === 0 ? (
          <div
            style={{
              padding: "14px 12px",
              borderRadius: 12,
              border: "1px dashed rgba(148,163,184,0.55)",
              background: "rgba(248,250,252,0.9)",
              fontSize: 11,
              color: "rgba(100,116,139,0.95)",
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            No vehicles moving
          </div>
        ) : (
          <>
            {filteredMovingVehicles.slice(0, 8).map((movingId, idx) => {
              const vehicle = getVehicleFromMovingId(movingId);
              const [source] = String(movingId).split(":");
              if (!vehicle) return null;

              const sourceColor = SOURCE_META?.[source]?.color || "#64748B";
              const sourceName = SOURCE_META?.[source]?.name || source;

              const latOk = typeof vehicle?.lat === "number";
              const lngOk = typeof vehicle?.lng === "number";

              return (
                <div
                  key={`${movingId}-${idx}`}
                  onClick={() => locateOnMap(vehicle, source)}
                  style={{
                    borderRadius: 12,
                    border: "1px solid rgba(15,23,42,0.10)",
                    background: "white",
                    padding: "10px 10px",
                    marginBottom: 10,
                    cursor: "pointer",
                    boxShadow: "0 10px 18px rgba(15,23,42,0.06)",
                    borderLeft: `4px solid ${sourceColor}`,
                    transition: "transform .15s ease, box-shadow .15s ease",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow =
                      "0 14px 24px rgba(15,23,42,0.10)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow =
                      "0 10px 18px rgba(15,23,42,0.06)";
                  }}
                >
                  {/* ✅ REG NO + VENDOR PILL */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 900,
                      fontSize: 13,
                      color: "rgba(15,23,42,0.95)",
                      letterSpacing: 0.3,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>🚘</span>
                    <span style={{ flex: 1 }}>
                      {vehicle.regNo || vehicle.label || "N/A"}
                    </span>

                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        color: "white",
                        background: sourceColor,
                        padding: "3px 8px",
                        borderRadius: 999,
                        letterSpacing: 0.2,
                      }}
                    >
                      {sourceName}
                    </span>
                  </div>

                  {/* ✅ SPEED + LOCATION */}
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      fontSize: 10,
                      color: "rgba(100,116,139,0.95)",
                    }}
                  >
                    <div style={{ fontWeight: 900, color: "#DC2626" }}>
                      ⚡{" "}
                      {vehicle.speed && vehicle.speed !== "-"
                        ? `${vehicle.speed} km/h`
                        : "--"}
                    </div>

                    <div
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={vehicle.location || ""}
                    >
                      📌 {vehicle.location || "--"}
                    </div>
                  </div>

                  {/* ✅ COORDS */}
                  <div
                    style={{
                      fontSize: 9,
                      marginTop: 6,
                      color: "rgba(148,163,184,0.95)",
                      fontWeight: 700,
                    }}
                  >
                    {latOk ? vehicle.lat.toFixed(4) : "--"} ,{" "}
                    {lngOk ? vehicle.lng.toFixed(4) : "--"}
                  </div>
                </div>
              );
            })}

            {filteredMovingVehicles.length > 8 && (
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 10px",
                  borderRadius: 12,
                  background: "rgba(248,250,252,0.9)",
                  border: "1px solid rgba(15,23,42,0.08)",
                  fontSize: 11,
                  color: "rgba(100,116,139,0.95)",
                  textAlign: "center",
                  fontStyle: "italic",
                }}
              >
                ... and {filteredMovingVehicles.length - 8} more moving
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MovingVehiclesPanel;

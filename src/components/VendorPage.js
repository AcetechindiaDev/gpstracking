import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { Container, Row, Col, Card, Button, Badge } from "react-bootstrap";
import { setSelectedVendor } from "../store/uiSlice";
import GpsLiveTracking from "./ReverseGeo";
import VehicleDeviation from "./Vamosys"

const VENDOR_CONFIGS = {
  jtrack1: {
    name: "JTrack API-1",
    color: "#D32F2F",
    icon: "🔴",
    description: "Real-time vehicle tracking system",
    // emoji: "🚗",
    bgGradient: "linear-gradient(135deg, rgba(211,47,47,0.1) 0%, rgba(211,47,47,0.05) 100%)",
    borderColor: "#D32F2F",
  },
  jtrack2: {
    name: "JTrack API-2",
    color: "#FB8C00",
    icon: "🟠",
    description: "Special equipment tracking",
    // emoji: "⚙️",
    bgGradient: "linear-gradient(135deg, rgba(251,140,0,0.1) 0%, rgba(251,140,0,0.05) 100%)",
    borderColor: "#FB8C00",
  },
  batch: {
    name: "BatchMaster",
    color: "#2E7D32",
    icon: "🟢",
    description: "Fleet management system",
    // emoji: "📦",
    bgGradient: "linear-gradient(135deg, rgba(46,125,50,0.1) 0%, rgba(46,125,50,0.05) 100%)",
    borderColor: "#2E7D32",
  },
  vecv: {
    name: "VECV - Eicher",
    color: "#1565C0",
    icon: "🔵",
    description: "Commercial vehicles tracking",
    // emoji: "🚛",
    bgGradient: "linear-gradient(135deg, rgba(21,101,192,0.1) 0%, rgba(21,101,192,0.05) 100%)",
    borderColor: "#1565C0",
  },
  gpstrack: {
    name: "Amphibious",
    color: "#6A1B9A",
    icon: "🟣",
    description: "GPS tracking & monitoring",
    // emoji: "📍",
    bgGradient: "linear-gradient(135deg, rgba(106,27,154,0.1) 0%, rgba(106,27,154,0.05) 100%)",
    borderColor: "#6A1B9A",
  },
  ialert2: {
    name: "VehicleMounted Crane",
    color: "#00838F",
    icon: "🔷",
    description: "Alert & monitoring system",
    // emoji: "🏗️",
    bgGradient: "linear-gradient(135deg, rgba(0,131,143,0.1) 0%, rgba(0,131,143,0.05) 100%)",
    borderColor: "#00838F",
  },
  fleetx: {
    name: "FleetX - Bobcat",
    color: "#5E35B1",
    icon: "🟪",
    description: "Fleet analytics & insights",
    // emoji: "📊",
    bgGradient: "linear-gradient(135deg, rgba(94,53,177,0.1) 0%, rgba(94,53,177,0.05) 100%)",
    borderColor: "#5E35B1",
  },
  vamosys: {
    name: "Vamosys",
    color: "#14B8A6",
    icon: "🔶",
    description: "Enforcement vehicles tracking",
    // emoji: "👮",
    bgGradient: "linear-gradient(135deg, rgba(20,184,166,0.1) 0%, rgba(20,184,166,0.05) 100%)",
    borderColor: "#14B8A6",
  },
};

export default function VendorPage() {
  const { vendorId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const config = VENDOR_CONFIGS[vendorId];

  useEffect(() => {
    if (!config) {
      navigate("/");
      return;
    }
    dispatch(setSelectedVendor(vendorId));
  }, [vendorId, config, dispatch, navigate]);

  if (!config) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card className="border-0">
          <Card.Body className="text-center">
            <h3>Vendor not found</h3>
            <Button
              variant="primary"
              onClick={() => navigate("/")}
              className="mt-3"
            >
              ← Back to Vendors
            </Button>
          </Card.Body>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#F8FAFC" }}>
      {/* Header */}
      <div
        style={{
          background: config.bgGradient,
          borderBottom: `3px solid ${config.color}`,
          padding: "12px 16px",
          boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
        }}
      >
        <Container fluid>
      <Row className="align-items-center">
  <Col>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 24 }}>{config.emoji}</div>
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: config.color,
            lineHeight: 1.2,
          }}
        >
          {config.icon} {config.name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(100,116,139,0.85)",
            marginTop: 2,
          }}
        >
          {config.description}
        </div>
      </div>
    </div>
  </Col>

  {/* RIGHT SIDE BUTTON */}
  <Col xs="auto" className="text-end">
    <Button
      size="sm"
      variant="light"
      onClick={() => navigate("/")}
      style={{
        borderRadius: 10,
        fontWeight: 900,
        border: `2px solid ${config.color}`,
        color: config.color,
      }}
    >
      ← All Vendors
    </Button>
  </Col>
</Row>

        </Container>
      </div>

      {/* Map Container */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        <GpsLiveTracking />
        {/* <VehicleDeviation /> */}
      </div>
    </div>
  );
}

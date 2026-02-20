import React from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Button } from "react-bootstrap";

const VENDORS = [
  {
    id: "jtrack1",
    name: "JTrack API-1",
    // emoji: "🚗",
    color: "#D32F2F",
    description: "Real-time vehicle tracking",
  },
  {
    id: "jtrack2",
    name: "JTrack API-2",
    // emoji: "⚙️",
    color: "#FB8C00",
    description: "Special equipment tracking",
  },
  {
    id: "batch",
    name: "BatchMaster",
    // emoji: "📦",
    color: "#2E7D32",
    description: "Fleet management system",
  },
  {
    id: "vecv",
    name: "VECV - Eicher",
    // emoji: "🚛",
    color: "#1565C0",
    description: "Commercial vehicles tracking",
  },
  {
    id: "gpstrack",
    name: "Amphibious",
    // emoji: "📍",
    color: "#6A1B9A",
    description: "GPS tracking & monitoring",
  },
  {
    id: "ialert2",
    name: "VehicleMounted Crane",
    // emoji: "🏗️",
    color: "#00838F",
    description: "Alert & monitoring system",
  },
  {
    id: "fleetx",
    name: "FleetX - Bobcat",
    // emoji: "📊",
    color: "#5E35B1",
    description: "Fleet analytics & insights",
  },
  {
    id: "vamosys",
    name: "Vamosys",
    // emoji: "👮",
    color: "#14B8A6",
    description: "Enforcement vehicles tracking",
  },
];

export default function VendorSelector() {
  const navigate = useNavigate();

  const handleVendorClick = (vendorId) => {
    navigate(`/vendor/${vendorId}`);
  };

  return (
    <div style={{ minHeight: "65vh", background: "#F8FAFC", padding: "20px 0" }}>
      <Container>
        <div className="mb-4 text-center">
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: "rgba(15,23,42,0.95)",
              marginBottom: 8,
            }}
          >
            🚗 Vehicle Tracking Dashboard
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(100,116,139,0.95)",
              maxWidth: 500,
              margin: "0 auto",
            }}
          >
            Select a vendor to view live vehicle tracking and real-time location updates
          </p>
        </div>

        <Row className="g-3">
          {VENDORS.map((v) => (
            <Col key={v.id} xs={12} sm={6} lg={3}>
              <Card
                className="border-0 h-100 shadow-sm"
                style={{
                  borderRadius: 12,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  borderTop: `4px solid ${v.color}`,
                }}
                onClick={() => handleVendorClick(v.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-6px)";
                  e.currentTarget.style.boxShadow =
                    "0 15px 30px rgba(15,23,42,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 6px 12px rgba(15,23,42,0.08)";
                }}
              >
                <Card.Body style={{ padding: "16px" }}>
                  <div style={{ fontSize: 38, marginBottom: 8, textAlign: "center" }}>
                    {v.emoji}
                  </div>
                  <h5
                    style={{
                      fontWeight: 900,
                      color: "rgba(15,23,42,0.95)",
                      marginBottom: 6,
                      textAlign: "center",
                      fontSize: 14,
                    }}
                  >
                    {v.name}
                  </h5>
                  <p
                    style={{
                      fontSize: 12,
                      color: "rgba(100,116,139,0.85)",
                      marginBottom: 12,
                      textAlign: "center",
                    }}
                  >
                    {v.description}
                  </p>
                  <Button
                    className="w-100"
                    style={{
                      borderRadius: 8,
                      fontWeight: 900,
                      background: v.color,
                      border: `2px solid ${v.color}`,
                      color: "white",
                      padding: "6px 0",
                      fontSize: 12,
                    }}
                  >
                    View Vehicles →
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </Container>
    </div>
  );
}

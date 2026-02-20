// import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
// import GoogleMapComponent from "./components/ReverseGeo";
// import VendorSelector from "./components/VendorSelector";
// import VendorPage from "./components/VendorPage";

// function App() {
//   return (
//     <Router>
//       <Routes>
//         {/* Vendor selector landing page */}
//         <Route path="/vendors" element={<VendorSelector />} />
        
//         {/* Individual vendor tracking page */}
//         <Route path="/vendor/:vendorId" element={<VendorPage />} />
        
//         {/* Default: all vendors together */}
//         <Route path="/" element={<GoogleMapComponent />} />
        
//         {/* Fallback */}
//         <Route path="*" element={<VendorSelector />} />
//       </Routes>
//     </Router>
//   );
// }

// export default App;


import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Import Pages
import GoogleMapComponent from "./components/ReverseGeo";
import VendorSelector from "./components/VendorSelector";
import VendorPage from "./components/VendorPage";
import VehicleDeviation from "./components/Vamosys";
import EicherDeviation from "./components/EicherDeviation";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default: Show Vendor List on Main Page */}
        <Route path="/" element={<VendorSelector />} />

        <Route path="/deviation" element={<VehicleDeviation />} />

        <Route path="/eicher-deviation" element={<EicherDeviation />} />

        {/* All Vendors Map */}
        <Route path="/map" element={<GoogleMapComponent />} />

        {/* Individual Vendor Tracking */}
        <Route path="/vendor/:vendorId" element={<VendorPage />} />

        {/* Redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

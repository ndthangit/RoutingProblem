import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "../components/layout/Layout";
import Vehicles from "../pages/Vehicles";
import Drivers from "../pages/Drivers";
import Warehouses from "../pages/Warehouses";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />

        {/* Protected routes */}
        {/* <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<Home />} />
        </Route> */}
        {/* Protected routes with Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<div>404 Page</div>} />
            <Route path="/orders" element={<div>404 Page</div>} />
            <Route path="/fleet" element={<Vehicles />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/warehouses" element={<Warehouses />} />
            <Route path="/ai-optimization" element={<div>404 Page</div>} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<div>404 Page</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

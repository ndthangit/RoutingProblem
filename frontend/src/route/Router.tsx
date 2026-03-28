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
            <Route element={<ProtectedRoute requiredRole="dashboard" />}>
              <Route path="/dashboard" element={<div>Dashboard Page</div>} />
            </Route>
            <Route path="/orders" element={<div>404 Page</div>} />

            <Route element={<ProtectedRoute requiredRole="fleet" />}>
              <Route path="/fleet" element={<Vehicles />} />
            </Route>
            <Route element={<ProtectedRoute requiredRole="drivers" />}>
              <Route path="/drivers" element={<Drivers />} />
            </Route>
            <Route element={<ProtectedRoute requiredRole="warehouses" />}>
              <Route path="/warehouses" element={<Warehouses />} />
            </Route>
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

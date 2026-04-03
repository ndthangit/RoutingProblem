import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "../components/layout/Layout";
import Vehicles from "../pages/Vehicles";
import Drivers from "../pages/Drivers";
import Warehouses from "../pages/Warehouses";
import Orders from "../pages/Orders";
import WarehouseRegistrationPage from "../pages/Warehouse/WarehouseRegistrationPage.tsx";
import Geography from "../pages/Geography";
// import WarehouseRegistrationPage from "../pages/Warehouse/WarehouseRegistrationPage";

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
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
                        <Route path="/orders" element={<Orders />} />
                                      <Route path="/fleet" element={<Vehicles />} />
                                      <Route path="/drivers" element={<Drivers />} />
                                      <Route path="/warehouses" element={<Warehouses />} />
                                      <Route path="/geography" element={<Geography />} />
                                       <Route path="/warehouses/register" element={<WarehouseRegistrationPage />} />


            {/* <Route element={<ProtectedRoute requiredRole="dashboard" />}>
              <Route path="/dashboard" element={<div>Dashboard Page</div>} />
            </Route>
            <Route element={<ProtectedRoute requiredRole="orders" />}>
              <Route path="/orders" element={<Orders />} />
            </Route>

            <Route element={<ProtectedRoute requiredRole="fleet" />}>
              <Route path="/fleet" element={<Vehicles />} />
            </Route>
            <Route element={<ProtectedRoute requiredRole="drivers" />}>
              <Route path="/drivers" element={<Drivers />} />
            </Route>
            <Route element={<ProtectedRoute requiredRole="warehouses" />}>
              <Route path="/warehouses" element={<Warehouses />} />
              <Route path="/warehouses/register" element={<WarehouseRegistrationPage />} />
            </Route> */}


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

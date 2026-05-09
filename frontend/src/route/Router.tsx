import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import ProtectedRoute from "./ProtectedRoute";
import Layout from "../components/layout/Layout";
import Vehicles from "../pages/Vehicles";
import Drivers from "../pages/Drivers";
import Warehouses from "../pages/Warehouses";
import CustomerWarehouses from "../pages/CustomerWarehouses";
import Orders from "../pages/Orders";
import WarehouseRegistrationPage from "../pages/CustomerWarehouse/WarehouseRegistrationPage.tsx";
import Geography from "../pages/Geography";
import RoutesPage from "../pages/Routes";
import Schedules from "../pages/Schedules";
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
            {/*<Route path="/dashboard" element={<div>Dashboard Page</div>} />*/}
            {/*<Route path="/orders" element={<Orders />} />*/}
            {/*<Route path="/fleet" element={<Vehicles />} />*/}
            {/*<Route path="/drivers" element={<Drivers />} />*/}
            {/*<Route path="/warehouses" element={<Warehouses />} />*/}
            {/*<Route path="/customer-warehouses" element={<CustomerWarehouses />} />*/}
            {/*<Route path="/plans" element={<RoutesPage />} />*/}
            {/*<Route path="/schedules" element={<Schedules />} />*/}
            {/*<Route path="/geography" element={<Geography />} />*/}
            {/*<Route path="/warehouses/register" element={<WarehouseRegistrationPage />} />*/}


             <Route element={<ProtectedRoute requiredRole="dashboard" />}>
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
            </Route>
                <Route element={<ProtectedRoute requiredRole="/customer-warehouses" />}>
              <Route path="//customer-warehouses" element={<CustomerWarehouses />} />
            </Route>
                <Route element={<ProtectedRoute requiredRole="plans" />}>
              <Route path="/plans" element={<RoutesPage />} />
            </Route>
                <Route element={<ProtectedRoute requiredRole="schedules" />}>
              <Route path="/schedules" element={<Schedules />} />
            </Route>
                <Route element={<ProtectedRoute requiredRole="geography" />}>
              <Route path="/geography" element={<Geography />} />
            </Route>
                <Route element={<ProtectedRoute requiredRole="warehouse_register" />}>
              <Route path="/warehouses/register" element={<WarehouseRegistrationPage />} />
            </Route>


          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<div>404 Page</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

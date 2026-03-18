import { Navigate, Outlet } from "react-router-dom";
import { keycloak } from "../config/keycloak";

export function ProtectedRoute() {
  const isAuthenticated = !!keycloak.authenticated;

  if (!isAuthenticated) {
    // Nếu chưa đăng nhập thì chuyển sang trang login (Keycloak)
    keycloak.login();
    return null;
  }

  return <Outlet />;
}

export default ProtectedRoute;

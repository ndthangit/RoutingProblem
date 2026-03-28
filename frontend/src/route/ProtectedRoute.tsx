import { Outlet } from "react-router-dom";
import { keycloak } from "../config/keycloak";

interface Props {
  requiredRole?: string;
}

export function ProtectedRoute({ requiredRole }: Props) {
  const isAuthenticated = !!keycloak.authenticated;

  // 1. Kiểm tra đăng nhập
  if (!isAuthenticated) {
    keycloak.login();
    return null;
  }

  // 2. Kiểm tra phân quyền (nếu route yêu cầu role)
  if (requiredRole) {
    // Truy xuất vào đúng cấu trúc: resource_access -> GoShip -> roles
    const userRoles = keycloak.tokenParsed?.resource_access?.["GoShip"]?.roles || [];

    const hasRole = userRoles.includes(requiredRole);

    if (!hasRole) {
      // Nếu không có quyền, bạn có thể trả về trang 403 hoặc thông báo
      return (
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2>403 - Bạn không có quyền truy cập mục này</h2>
          <p>Vui lòng liên hệ quản trị viên để được cấp quyền <b>{requiredRole}</b>.</p>
        </div>
      );
    }
  }

  // Nếu thỏa mãn tất cả, cho phép vào route con
  return <Outlet />;
}

export default ProtectedRoute;
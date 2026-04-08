import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, Truck, Sparkles, Users, Warehouse, MoreVertical, LogOut, CircleUser as UserCircle, Map, Route as RouteIcon } from 'lucide-react';
import { useKeycloak } from '@react-keycloak/web';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout?: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onLogout }: SidebarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { keycloak, initialized } = useKeycloak();
  const navigate = useNavigate();

  // Lấy thông tin user từ Keycloak
  const userInfo = keycloak?.tokenParsed || {};
  const userName = userInfo.name || userInfo.preferred_username || 'Admin User';
  const userEmail = userInfo.email || 'user@tms.com';
  
  // Lấy initials từ tên
  const getUserInitials = () => {
    if (userInfo.given_name && userInfo.family_name) {
      return `${userInfo.given_name[0]}${userInfo.family_name[0]}`.toUpperCase();
    }
    if (userInfo.name) {
      const names = userInfo.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return names[0]?.substring(0, 2).toUpperCase() || 'AD';
    }
    if (userInfo.preferred_username) {
      return userInfo.preferred_username.substring(0, 2).toUpperCase();
    }
    return 'AD';
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'orders', label: 'Orders', icon: Package, path: '/orders' },
    { id: 'fleet', label: 'Fleet', icon: Truck, path: '/fleet' },
    { id: 'drivers', label: 'Drivers', icon: Users, path: '/drivers' },
    { id: 'warehouses', label: 'Warehouses', icon: Warehouse, path: '/warehouses' },
    { id: 'routes', label: 'Routes', icon: RouteIcon, path: '/routes' },
    { id: 'geography', label: 'Bản đồ', icon: Map, path: '/geography' },
    { id: 'ai', label: 'AI Optimization', icon: Sparkles, path: '/ai-optimization' },
  ];

  const handleMenuClick = (item: typeof menuItems[0]) => {
    setActiveTab(item.id);
    navigate(item.path);
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    
    if (onLogout) {
      // Nếu có onLogout prop từ parent, sử dụng nó
      onLogout();
    } else if (keycloak) {
      // Sử dụng Keycloak logout
      const logoutOptions = {
        redirectUri: window.location.origin // Redirect về trang chủ sau khi logout
      };
      keycloak.logout(logoutOptions);
    } else {
      console.log('Fallback: Logging out...');
      // Fallback nếu không có Keycloak
      navigate('/login');
    }
  };

  const handleUserProfile = () => {
    // Có thể điều hướng đến trang profile hoặc mở Keycloak account management
    if (keycloak) {
      // Mở Keycloak account management trong tab mới
      const accountUrl = keycloak.createAccountUrl();
      window.open(accountUrl, '_blank');
    }
    setShowUserMenu(false);
  };

  const handleWarehouseRegistration = () => {
    setShowUserMenu(false);
    navigate('/warehouses/register');
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (initialized && !keycloak?.authenticated) {
      navigate('/login');
    }
  }, [initialized, keycloak, navigate]);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">GoShip</h1>
            <p className="text-xs text-slate-400">Transport Manager</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                activeTab === item.id
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-700 relative">
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800 rounded-lg transition-colors">
          <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold">{getUserInitials()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userName}</p>
            <p className="text-xs text-slate-400 truncate">{userEmail}</p>
          </div>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="p-1 hover:bg-slate-700 rounded transition-colors flex-shrink-0"
          >
            <MoreVertical className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {showUserMenu && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowUserMenu(false)}
            />
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-slate-800 rounded-lg shadow-lg border border-slate-700 overflow-hidden z-20">
              <button
                onClick={handleUserProfile}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
              >
                <UserCircle className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-white">Quản lý tài khoản</span>
              </button>

              <button
                onClick={handleWarehouseRegistration}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
              >
                <Warehouse className="w-5 h-5 text-slate-400" />
                <span className="text-sm font-medium text-white">Đăng ký kho</span>
              </button>

              <div className="border-t border-slate-700" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700 transition-colors text-left"
              >
                <LogOut className="w-5 h-5 text-red-400" />
                <span className="text-sm font-medium text-red-400">Đăng xuất</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import Sidebar from './SideBar';

export default function Layout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { keycloak } = useKeycloak();
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let next = 'dashboard';
    if (path.startsWith('/orders')) next = 'orders';
    else if (path.startsWith('/fleet')) next = 'fleet';
    else if (path.startsWith('/drivers')) next = 'drivers';
    else if (path.startsWith('/warehouses')) next = 'warehouses';
    else if (path.startsWith('/customer-warehouses')) next = 'customerWarehouses';
    else if (path.startsWith('/routes')) next = 'routes';
    else if (path.startsWith('/schedules')) next = 'schedules';
    else if (path.startsWith('/geography')) next = 'geography';
    else if (path.startsWith('/dashboard')) next = 'dashboard';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab(next);
  }, [location.pathname]);

  const handleLogout = () => {
    keycloak.logout({
      redirectUri: window.location.origin + '/'
    });
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar - Fixed */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
      />
      
      {/* Main Content - Scrollable */}
      <main className="flex-1 ml-64 overflow-y-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
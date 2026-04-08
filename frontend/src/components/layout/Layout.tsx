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
    if (path.startsWith('/orders')) return setActiveTab('orders');
    if (path.startsWith('/fleet')) return setActiveTab('fleet');
    if (path.startsWith('/drivers')) return setActiveTab('drivers');
    if (path.startsWith('/warehouses')) return setActiveTab('warehouses');
    if (path.startsWith('/routes')) return setActiveTab('routes');
    if (path.startsWith('/geography')) return setActiveTab('geography');
    if (path.startsWith('/ai-optimization')) return setActiveTab('ai');
    if (path.startsWith('/dashboard')) return setActiveTab('dashboard');
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
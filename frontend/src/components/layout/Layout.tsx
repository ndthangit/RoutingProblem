import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useKeycloak } from '@react-keycloak/web';
import Sidebar from './SideBar';

export default function Layout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { keycloak } = useKeycloak();

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
import { useEffect, useState } from 'react';
import { Package} from 'lucide-react';
import Toast from './Toast';
import { useKeycloak } from '@react-keycloak/web';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'success'
  });

  const { keycloak, initialized } = useKeycloak();

  // useEffect(() => {
  //   if (initialized) {
  //     if (keycloak.authenticated) {
  //       setToast({
  //         visible: true,
  //         message: 'Login successful!',
  //         type: 'success'
  //       });
        
  //       const timer = setTimeout(() => {
  //         navigate('/dashboard');
  //       }, 1500);
        
  //       return () => clearTimeout(timer);
  //     }
  //   }
  // }, [initialized, keycloak.authenticated, navigate]);

  const handleLogin = () => {
    keycloak.login({
      redirectUri: window.location.origin + '/dashboard',
    });
  };

  const handleSignup = () => {
    keycloak.register({
      redirectUri: window.location.origin + '/',
    });
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <Package className="h-8 w-8 text-blue-900" />
            <span className="text-2xl font-bold text-blue-900">GlobalShip</span>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#home" className="text-gray-700 hover:text-blue-900 font-medium transition">
              Trang chủ
            </a>
            <a href="#services" className="text-gray-700 hover:text-blue-900 font-medium transition">
              Dịch vụ
            </a>
            <a href="#tracking" className="text-gray-700 hover:text-blue-900 font-medium transition">
              Tra cứu
            </a>
            <a href="#contact" className="text-gray-700 hover:text-blue-900 font-medium transition">
              Liên hệ
            </a>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <button 
                onClick={handleLogin}
                className="px-6 py-2 text-blue-900 font-semibold border-2 border-blue-900 rounded-lg hover:bg-blue-50 transition"
              >
                Đăng nhập
            </button>
            <button 
                onClick={handleSignup}
                className="px-6 py-2 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition shadow-md"
              >
                Đăng ký
            </button>
          </div>
        </div>

      </nav>
    </header>
  );
}

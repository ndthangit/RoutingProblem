import { Package, Facebook, Twitter, Linkedin, Instagram } from 'lucide-react';

export default function Footer() {
  const quickLinks = [
    { label: 'Trang chủ', href: '#home' },
    { label: 'Dịch vụ', href: '#services' },
    { label: 'Tra cứu', href: '#tracking' },
    { label: 'Liên hệ', href: '#contact' }
  ];

  const services = [
    'Vận chuyển đường bộ',
    'Vận chuyển đường biển',
    'Vận chuyển hàng không',
    'Kho bãi & Phân phối'
  ];

  const socialLinks = [
    { icon: Facebook, href: '#' },
    { icon: Twitter, href: '#' },
    { icon: Linkedin, href: '#' },
    { icon: Instagram, href: '#' }
  ];

  return (
    <footer className="bg-blue-900 text-white pt-12 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Package className="h-8 w-8 text-orange-400" />
              <span className="text-2xl font-bold">GlobalShip</span>
            </div>
            <p className="text-gray-300 text-sm">
              Đối tác vận chuyển toàn cầu đáng tin cậy của bạn
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Liên kết nhanh</h4>
            <ul className="space-y-2 text-gray-300 text-sm">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <a href={link.href} className="hover:text-orange-400 transition">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Dịch vụ</h4>
            <ul className="space-y-2 text-gray-300 text-sm">
              {services.map((service, index) => (
                <li key={index}>{service}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Theo dõi chúng tôi</h4>
            <div className="flex space-x-4">
              {socialLinks.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="bg-blue-800 p-2 rounded-full hover:bg-orange-500 transition"
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-blue-800 pt-6 text-center text-gray-300 text-sm">
          <p>&copy; 2024 GlobalShip. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

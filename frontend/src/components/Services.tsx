import { Truck, Ship, Plane } from 'lucide-react';
import ServiceCard from './ServiceCard';

export default function Services() {
  const services = [
    {
      icon: Truck,
      title: 'Vận chuyển đường bộ',
      description: 'Dịch vụ vận chuyển đường bộ nhanh chóng, an toàn cho các tuyến đường nội địa và quốc tế.',
      features: ['Giao hàng đúng giờ', 'Theo dõi thời gian thực', 'Bảo hiểm toàn diện']
    },
    {
      icon: Ship,
      title: 'Vận chuyển đường biển',
      description: 'Vận chuyển container và hàng hóa lớn qua đường biển với chi phí tối ưu và độ tin cậy cao.',
      features: ['Chi phí cạnh tranh', 'Mạng lưới toàn cầu', 'Xử lý hải quan']
    },
    {
      icon: Plane,
      title: 'Vận chuyển đường hàng không',
      description: 'Dịch vụ vận chuyển hàng không nhanh nhất cho các lô hàng khẩn cấp và có giá trị cao.',
      features: ['Tốc độ vượt trội', 'Bảo mật cao', 'Phủ sóng toàn cầu']
    }
  ];

  return (
    <section id="services" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-4">
            Dịch vụ của chúng tôi
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Giải pháp vận chuyển toàn diện cho mọi nhu cầu của bạn
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <ServiceCard key={index} {...service} />
          ))}
        </div>
      </div>
    </section>
  );
}

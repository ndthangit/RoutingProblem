import { Users, Globe, Package, Clock } from 'lucide-react';
import StatCard from './StatCard';

export default function Statistics() {
  const stats = [
    { icon: Users, value: '10,000+', label: 'Khách hàng' },
    { icon: Globe, value: '50+', label: 'Quốc gia' },
    { icon: Package, value: '1M+', label: 'Đơn hàng' },
    { icon: Clock, value: '24/7', label: 'Hỗ trợ' }
  ];

  return (
    <section className="py-20 bg-gradient-to-r from-blue-900 to-blue-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}

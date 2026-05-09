import { useState } from 'react';
import { Search } from 'lucide-react';

type HeroProps = {
  onTrackingSearch?: (orderId: string) => void | Promise<void>;
};

export default function Hero({ onTrackingSearch }: HeroProps) {
  const [trackingNumber, setTrackingNumber] = useState('');

  const handleTrackingSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingNumber.trim()) {
      onTrackingSearch?.(trackingNumber.trim());
    }
  };

  return (
    <section id="home" className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 text-white">
      <div className="absolute inset-0 bg-black opacity-40"></div>
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: "url('https://images.pexels.com/photos/906494/pexels-photo-906494.jpeg?auto=compress&cs=tinysrgb&w=1920')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      ></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Vận chuyển nhanh chóng<br />
            <span className="text-orange-400">Tin cậy - Toàn cầu</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">
            Kết nối thế giới với dịch vụ vận chuyển hàng đầu
          </p>

           <form onSubmit={handleTrackingSearch} className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3 bg-white rounded-lg p-2 shadow-2xl">
              <div className="flex-1 flex items-center px-4">
                <Search className="h-5 w-5 text-gray-400 mr-2" />
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                   placeholder="Nhập mã đơn hàng / mã vận đơn để tra cứu..."
                  className="w-full py-3 text-gray-900 outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-8 py-3 bg-orange-500 text-white font-semibold rounded-md hover:bg-orange-600 transition"
              >
                Tra cứu ngay
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

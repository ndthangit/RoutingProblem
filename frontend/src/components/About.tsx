import { Shield, TrendingUp } from 'lucide-react';

export default function About() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-blue-900 mb-6">
              Về chúng tôi
            </h2>
            <p className="text-lg text-gray-600 mb-6">
              Với hơn 15 năm kinh nghiệm trong ngành logistics, GlobalShip đã trở thành đối tác tin cậy
              của hàng nghìn doanh nghiệp trên toàn thế giới.
            </p>
            <p className="text-gray-600 mb-6">
              Chúng tôi tự hào về mạng lưới vận chuyển toàn cầu, công nghệ theo dõi hiện đại và
              đội ngũ chuyên nghiệp luôn sẵn sàng phục vụ 24/7. Sứ mệnh của chúng tôi là kết nối
              các doanh nghiệp với thị trường toàn cầu một cách nhanh chóng và hiệu quả nhất.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center">
                <Shield className="h-6 w-6 text-orange-500 mr-2" />
                <span className="font-semibold text-gray-800">Bảo mật tối đa</span>
              </div>
              <div className="flex items-center">
                <TrendingUp className="h-6 w-6 text-orange-500 mr-2" />
                <span className="font-semibold text-gray-800">Tăng trưởng bền vững</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <img
              src="https://images.pexels.com/photos/4481532/pexels-photo-4481532.jpeg?auto=compress&cs=tinysrgb&w=800"
              alt="Logistics warehouse"
              className="rounded-lg shadow-2xl"
            />
            <div className="absolute -bottom-6 -left-6 bg-orange-500 text-white p-6 rounded-lg shadow-xl">
              <div className="text-4xl font-bold">15+</div>
              <div className="text-sm">Năm kinh nghiệm</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

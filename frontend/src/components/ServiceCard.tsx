import type { LucideIcon } from 'lucide-react';

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
}

export default function ServiceCard({ icon: Icon, title, description, features }: ServiceCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-8 hover:shadow-2xl transition transform hover:-translate-y-2">
      <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-6">
        <Icon className="h-8 w-8 text-blue-900" />
      </div>
      <h3 className="text-2xl font-bold text-blue-900 mb-4">{title}</h3>
      <p className="text-gray-600 mb-6">{description}</p>
      <ul className="space-y-2 text-gray-600">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center">
            <span className="w-2 h-2 bg-orange-500 rounded-full mr-3"></span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}

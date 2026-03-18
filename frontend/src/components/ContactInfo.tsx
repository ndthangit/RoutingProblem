import { MapPin, Phone, Mail } from 'lucide-react';

export default function ContactInfo() {
  const contacts = [
    {
      icon: MapPin,
      title: 'Địa chỉ',
      value: '123 Đường Logistics, Quận 1, TP.HCM, Việt Nam'
    },
    {
      icon: Phone,
      title: 'Điện thoại',
      value: '+84 123 456 789'
    },
    {
      icon: Mail,
      title: 'Email',
      value: 'contact@globalship.com'
    }
  ];

  return (
    <div className="space-y-6">
      {contacts.map((contact, index) => (
        <div key={index} className="flex items-start space-x-4">
          <div className="bg-blue-100 p-3 rounded-lg">
            <contact.icon className="h-6 w-6 text-blue-900" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">{contact.title}</h3>
            <p className="text-gray-600">{contact.value}</p>
          </div>
        </div>
      ))}

      <div className="mt-8 rounded-lg overflow-hidden shadow-lg">
        <div className="bg-gray-300 h-64 flex items-center justify-center">
          <MapPin className="h-12 w-12 text-gray-500" />
        </div>
      </div>
    </div>
  );
}

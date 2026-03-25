import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
}

export default function StatCard({ icon: Icon, value, label }: StatCardProps) {
  return (
    <div className="text-center">
      <Icon className="h-12 w-12 mx-auto mb-4 text-orange-400" />
      <div className="text-4xl md:text-5xl font-bold mb-2">{value}</div>
      <div className="text-gray-300">{label}</div>
    </div>
  );
}

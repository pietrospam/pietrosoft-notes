'use client';

import { 
  Building2, 
  Briefcase, 
  Code, 
  Globe, 
  Heart, 
  Star, 
  User, 
  Users,
  Laptop,
  Server,
  Database,
  Cloud,
  Shield,
  Zap,
  Target,
  Rocket,
} from 'lucide-react';

export const ICONS = {
  building: Building2,
  briefcase: Briefcase,
  code: Code,
  globe: Globe,
  heart: Heart,
  star: Star,
  user: User,
  users: Users,
  laptop: Laptop,
  server: Server,
  database: Database,
  cloud: Cloud,
  shield: Shield,
  zap: Zap,
  target: Target,
  rocket: Rocket,
} as const;

export type IconKey = keyof typeof ICONS;

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {Object.entries(ICONS).map(([key, Icon]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`
            p-2 rounded-lg border transition-colors
            ${value === key 
              ? 'border-blue-500 bg-blue-500/20 text-blue-400' 
              : 'border-gray-700 hover:border-gray-600 text-gray-400 hover:text-white'}
          `}
        >
          <Icon size={20} />
        </button>
      ))}
    </div>
  );
}

interface DynamicIconProps {
  icon: string;
  size?: number;
  className?: string;
}

export function DynamicIcon({ icon, size = 20, className = '' }: DynamicIconProps) {
  const IconComponent = ICONS[icon as IconKey] || Building2;
  return <IconComponent size={size} className={className} />;
}

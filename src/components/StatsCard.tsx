import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  description?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color, description }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-[12px] shadow-sm border border-[#D6DEE6] flex items-start space-x-4"
    >
      <div className={`p-3 rounded-[8px] ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-brand-text-secondary uppercase tracking-widest">{title}</p>
        <h3 className="text-2xl font-bold text-[#1F3A5F] mt-1">{value}</h3>
        {description && <p className="text-[10px] text-brand-text-secondary mt-1 font-medium">{description}</p>}
      </div>
    </motion.div>
  );
};

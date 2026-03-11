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
      className="card p-6 rounded-2xl flex items-start space-x-4"
    >
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-text-secondary uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-text-main mt-1">{value}</h3>
        {description && <p className="text-xs text-text-secondary mt-1">{description}</p>}
      </div>
    </motion.div>
  );
};

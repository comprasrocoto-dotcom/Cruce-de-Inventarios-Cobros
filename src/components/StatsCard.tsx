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
      const iconBgStyle = {
              backgroundColor: color + '22',
              border: '1px solid ' + color + '44'
      };
      const iconStyle = { color };

      return (
              <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 rounded-2xl border flex items-start space-x-4 shadow-lg"
                        style={{
                                    background: 'linear-gradient(135deg, #132238 0%, #0F1C2E 100%)',
                                    borderColor: '#243A57',
                                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.05)'
                        }}
                      >
                    <div className="p-3 rounded-xl flex-shrink-0" style={iconBgStyle}>
                            <Icon className="w-6 h-6" style={iconStyle} />
                    </div>div>
                    <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#8EA3BF' }}>{title}</p>p>
                            <h3 className="text-2xl font-bold mt-1" style={{ color: '#FFFFFF' }}>{value}</h3>h3>
                        {description && <p className="text-[10px] mt-1 font-medium" style={{ color: '#8EA3BF' }}>{description}</p>p>}
                    </div>div>
              </motion.div>motion.div>
            );
};</motion.div>

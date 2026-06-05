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
                                    className="bg-[#132238] p-6 rounded-2xl border border-[#243A57] flex items-start space-x-4 shadow-lg"
                                  >
                            <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
                                    <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
                            </div>
                            <div>
                                    <p className="text-[11px] font-bold text-[#8EA3BF] uppercase tracking-widest">{title}</p>
                                    <h3 className="text-2xl font-bold text-white mt-1">{value}</h3>
                                    {description && <p className="text-[10px] text-[#8EA3BF] mt-1 font-medium">{description}</p>}
                            </div>
                      </motion.div>
                    );
};</motion.div>

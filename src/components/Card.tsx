import React from 'react';
import { cn } from '../utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className, title }) => {
  return (
    <div className={cn("bg-brand-card rounded-xl border border-brand-border shadow-sm overflow-hidden", className)}>
      {title && (
        <div className="px-6 py-4 border-bottom border-brand-border bg-gray-50/50">
          <h3 className="font-semibold text-brand-text">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};

/**
 * Tarjeta de KPI con el diseño del Informe de Rentabilidad: borde superior de
 * color, degradado suave, título en mayúsculas del mismo color e ícono en un
 * círculo. El color sale de la prop `color` (clase Tailwind bg-[#hex] o bg-*-600).
 */
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  description?: string;
}

/** Color principal y su versión oscura (para título y valor). */
const TEMAS: Record<string, { color: string; oscuro: string }> = {
  '#1976d2': { color: '#1976d2', oscuro: '#0d47a1' },
  '#ef6c00': { color: '#ef6c00', oscuro: '#a84300' },
  '#d32f2f': { color: '#d32f2f', oscuro: '#b71c1c' },
  '#2e7d32': { color: '#2e7d32', oscuro: '#1b5e20' },
  'emerald-600': { color: '#00897b', oscuro: '#00695c' },
};

const temaDe = (color: string) => {
  const hex = color.match(/#[0-9a-fA-F]{6}/)?.[0]?.toLowerCase();
  if (hex && TEMAS[hex]) return TEMAS[hex];
  const tw = Object.keys(TEMAS).find((k) => !k.startsWith('#') && color.includes(k));
  return tw ? TEMAS[tw] : TEMAS['#1976d2'];
};

export const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, color, description }) => {
  const t = temaDe(color);
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded border bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-md"
      style={{
        borderColor: `${t.color}40`,
        borderTop: `4px solid ${t.color}`,
        backgroundImage: `linear-gradient(135deg, ${t.color}24 0%, ${t.color}0a 50%, #ffffff 80%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-bold tracking-wide uppercase" style={{ color: t.oscuro }}>
          {title}
        </div>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm"
          style={{ background: t.color }}
          aria-hidden
        >
          <Icon className="h-4 w-4 text-white" strokeWidth={2} />
        </span>
      </div>
      <div className="-mt-1 text-[24px] leading-tight font-bold tracking-tight tabular-nums" style={{ color: t.oscuro }}>
        {value}
      </div>
      {description && <div className="mt-1.5 text-[11px] leading-snug text-text-secondary">{description}</div>}
    </div>
  );
};

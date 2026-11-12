/**
 * Logo del Cruce de Inventarios y Cobros: una caja de inventario con un sello
 * de verificación (el conteo físico cruzado contra el teórico). Colores del ERP:
 * azul de marca y el naranja de alertas/cobro. El mismo dibujo está en
 * public/favicon.svg (ícono de la pestaña del navegador).
 */
import React, { useId } from 'react';

export const Logo: React.FC<{ size?: number; className?: string; title?: string }> = ({
  size = 40,
  className,
  title = 'Cruce de Inventarios y Cobros',
}) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <linearGradient id={`logo-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#42a5f5" />
          <stop offset="1" stopColor="#0d47a1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#logo-${id})`} />
      <g fill="none" stroke="#fff" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M32 11 L50 20 L50 41 L32 50 L14 41 L14 20 Z" />
        <path d="M14 20 L32 29 L50 20" />
        <path d="M32 29 L32 50" />
        <path d="M23 15.5 L41 24.5" strokeWidth="2.4" opacity=".75" />
      </g>
      <circle cx="47" cy="47" r="12" fill="#ef6c00" stroke="#fff" strokeWidth="3" />
      <path d="M41.5 47.2 L45.4 51 L52.6 43.6" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface InventoryItem {
  fechaDoc: string;
  serieNumero: string;
  sede: string;
  cc: string;
  subfamilia: string;
  articulo: string;
  codBarras: string;
  subarticulo: string;
  costeLinea: number;
  stockFecha: number;
  variacionStock: number;
  stockInventario: number;
  unidad?: string; // Added for logic
}

export const formatNumber = (value: number, unit?: string) => {
  if (Math.abs(value) < 0.01) return "0";
  
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };

  const lowerUnit = unit?.toLowerCase() || "";
  if (lowerUnit.includes("gramo") || lowerUnit.includes("onz") || lowerUnit === "g" || lowerUnit === "oz") {
    options.minimumFractionDigits = 2;
    options.maximumFractionDigits = 2;
  }

  return value.toLocaleString("es-CO", options);
};

export const formatCurrency = (value: number) => {
  return value.toLocaleString("es-CO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const getReliabilityColor = (percentage: number) => {
  if (percentage >= 90) return "#22c55e"; // Green
  if (percentage >= 75) return "#eab308"; // Yellow
  if (percentage >= 60) return "#f97316"; // Orange
  return "#ef4444"; // Red
};

export const getReliabilityStatus = (percentage: number) => {
  if (percentage >= 90) return "Alta";
  if (percentage >= 75) return "Media";
  if (percentage >= 60) return "Baja";
  return "Crítica";
};

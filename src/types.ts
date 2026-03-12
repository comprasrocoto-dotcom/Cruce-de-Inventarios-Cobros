export interface RawInventoryRow {
  [key: string]: any;
}

export interface InventoryMovement {
  fecha: Date;
  variacion: number;
  costeLinea: number;
}

export interface ArticleSummary {
  sede: string;
  articulo: string;
  subarticulo: string; // Unit of measure
  subfamilia: string;
  cc: string;
  codBarras: string;
  movements: InventoryMovement[];
  totalDiferencia: number;
  costePromedio: number;
  ultimoCoste: number;
  totalCobro: number;
  debeCobrar: boolean;
  tipo: 'FALTANTE' | 'SOBRANTE' | 'SIN_VARIACION';
}

export interface SedeSummary {
  sede: string;
  articulos: ArticleSummary[];
  totalCobroSede: number;
  totalArticulos: number;
  totalFaltantes: number;
  totalCobrables: number;
}

export interface DashboardStats {
  totalArticulos: number;
  totalFaltantes: number;
  totalCobrables: number;
  valorTotalCobro: number;
  sedes: SedeSummary[];
}

export interface ReliabilityStats {
  sede: string;
  confiabilidad: number;
  nivel: 'Confiable' | 'Alerta' | 'Crítico';
  articulosEvaluados: number;
  articulosSinDiferencia: number;
  articulosConDiferencia: number;
  variacionTotal: number;
  impactoEconomico: number;
  topArticulosCriticos: { articulo: string; variacion: number; impacto: number; unidad: string }[];
  topArticulosConfiables: { articulo: string; variacion: number; impacto: number; unidad: string }[];
}

export interface ReliabilitySummary {
  totalSedes: number;
  sedeMasConfiable: string;
  sedeMenosConfiable: string;
  promedioConfiabilidad: number;
  totalDiferencias: number;
  impactoEconomicoTotal: number;
  sedesStats: ReliabilityStats[];
}

export interface HistoricalPeriodStats {
  period: string;
  date: Date;
  evaluados: number;
  sinDiferencia: number;
  conDiferencia: number;
  confiabilidad: number;
  impactoEconomico: number;
  faltantes: number;
  sobrantes: number;
  cobrables: number;
  valorCobro: number;
  variacionVsAnterior?: number;
  estado: 'Mejoró' | 'Empeoró' | 'Estable';
}

export interface HistoricalTraceabilityData {
  periods: HistoricalPeriodStats[];
  bySede: Record<string, HistoricalPeriodStats[]>;
  byCC: Record<string, HistoricalPeriodStats[]>;
}

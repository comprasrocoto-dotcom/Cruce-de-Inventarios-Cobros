export interface RawInventoryRow {
  [key: string]: any;
}

export interface InventoryMovement {
  fecha: Date;
  variacion: number;
  costeLinea: number;
  stockFecha: number;
  stockInventario: number;
}

export interface ArticleSummary {
  sede: string;
  articulo: string;
  subarticulo: string; // Unit of measure
  subfamilia: string;
  cc: string;
  responsable: string;
  codBarras: string;
  fecha: Date;
  movements: InventoryMovement[];
  totalDiferencia: number;
  stockFisico: number;
  stockEsperado: number;
  ajusteCobro: number;
  confiabilidadTecnica: 'ALTA' | 'MEDIA' | 'BAJA';
  costePromedio: number;
  ultimoCoste: number;
  totalCobro: number;
  debeCobrar: boolean;
  dentroDeTolerancia: boolean;
  margenError: number;
  reglaAplicada: string;
  perdidaPorMargen: number;
  dineroRecuperable: number;
  tipo: 'FALTANTE' | 'SOBRANTE' | 'SIN_VARIACION';
  confiabilidad?: number;
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
  nivel: 'Confiable' | 'Aceptable' | 'Riesgo' | 'Crítico';
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

export interface ProductStability {
  producto: string;
  totalInstancias: number;
  instanciasFueraMargen: number;
  porcentajeFueraMargen: number;
  confiabilidad: number;
  impactoTotal: number;
  estado: 'Estable' | 'Inestable' | 'Crítico';
}

export interface ResponsableStability {
  responsable: string;
  totalEvaluaciones: number;
  instanciasFueraMargen: number;
  porcentajeFallo: number;
  confiabilidad: number;
}

export interface GlobalFilters {
  sedes: string[];
  ccs: string[];
  subfamilias: string[];
  responsables: string[];
  status: string;
  search: string;
  fechaInicio: string;
  fechaFin: string;
}

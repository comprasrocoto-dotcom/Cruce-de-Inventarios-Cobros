export interface RawInventoryRow {
  [key: string]: any;
}

export interface InventoryMovement {
  fecha: Date;
  variacion: number;
  costeLinea: number;
  stockFecha: number;
  stockInventario: number;
  /** Serie / Número del documento de HioPOS (ej. "CONTEORC / 4", "a / 1287"). */
  serie?: string;
  /** Naturaleza del documento: conteo físico, ajuste de sistema u otro. */
  tipoDocumento?: 'CONTEO' | 'AJUSTE' | 'OTRO';
  /** Calidad del dato: OK, REPARADA (variación recalculada por identidad contable) o SOSPECHOSA. */
  calidad?: 'OK' | 'REPARADA' | 'SOSPECHOSA';
}

export interface ArticleSummary {
  sede: string;
  articulo: string;
  subarticulo: string;
  familia: string;
  subfamilia: string;
  proveedor: string;
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
  totalFaltantes: number;
  totalSobrantes: number;
  cantidadACobrar: number;
  valorPerdida: number;
  valorSobrante: number;
  severidad: 'CRITICO' | 'MEDIO' | 'NORMAL';
  /** true si el artículo es sub-receta / producto en proceso (no se cobra). */
  esSubReceta?: boolean;
  /** Motivo por el que no se genera cobro (ej. sub-receta, solo ajustes). */
  motivoNoCobro?: string;
  /** Variación del último ciclo de conteo (base del cobro). */
  variacionUltimoCiclo?: number;
  /** Fecha del último ciclo evaluado. */
  fechaUltimoCiclo?: Date;
  /** Serie del documento del último ciclo evaluado. */
  serieUltimoCiclo?: string;
  /** Tipo de documento del último ciclo (CONTEO físico, AJUSTE de sistema u OTRO). */
  tipoDocumentoUltimoCiclo?: 'CONTEO' | 'AJUSTE' | 'OTRO';
  /** Costo unitario mediano de los movimientos (robusto frente a outliers). */
  costeMediano?: number;
  /** Nº de filas cuya variación fue reparada con la identidad Inv = Teórico + Var. */
  filasReparadas?: number;
  /** true si el cobro debe revisarse manualmente (coste atípico, monto implausible). */
  requiereRevision?: boolean;
  /** Detalle del motivo por el que el artículo requiere revisión. */
  motivoRevision?: string;
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
  totalArticulos?: number;
  articulosSinDiferencia: number;
  articulosConDiferencia: number;
  variacionTotal: number;
  impactoEconomico: number;
  topArticulosCriticos: {
    articulo: string;
    variacion: number;
    impacto: number;
    unidad: string;
  }[];
  topArticulosConfiables: {
    articulo: string;
    variacion: number;
    impacto: number;
    unidad: string;
  }[];
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
  familias: string[];
  subfamilias: string[];
  subArticulos: string[];
  responsables: string[];
  proveedores: string[];
  status: string;
  search: string;
  fechaInicio: string;
  fechaFin: string;
}

export interface ExecutiveSummary {
  totalProductosRevisados: number;
  totalProductosConNovedades: number;
  totalProductosSinNovedades: number;
  valorTotalPerdidas: number;
  valorTotalSobrantes: number;
  balanceFinal: number;
  cantidadTotalACobrar: number;
  top10Diferencias: ArticleSummary[];
  top10Recurrentes: ArticleSummary[];
  perdidas: ArticleSummary[];
  sobrantes: ArticleSummary[];
}

/**
 * Lectura de un archivo de inventario de HioPOS (CSV o Excel) y subida a Supabase.
 *
 * - CSV: separador ";" o "," (se detecta), números en formato colombiano
 *   (punto = miles, coma = decimal: "4.491" = 4491, "3.728,55" = 3728.55) o
 *   internacional; el formato se detecta por archivo y se valida con la regla
 *   del ERP: Stock a Fecha + Variación = Stock Inventario.
 * - Excel: se leen los valores reales de las celdas (sin formato de texto).
 * - Filas sin fecha (la fila de totales del final) se descartan.
 *
 * La subida es atómica (función `cruce_subir_inventario`) y SUMA a lo que ya está:
 * las líneas nuevas se agregan y una línea que ya existía (mismo almacén, fecha,
 * serie, código y artículo) se actualiza con los valores del archivo. Nada se borra.
 */
import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import type { LineaInventario } from './inventariosSupabase';

const sinTildes = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/Ã[\x80-\xBF]?|Ã/g, '') // restos de mojibake
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Encabezado normalizado → campo de la base. */
const CAMPOS: Record<string, keyof LineaInventario> = {
  'fecha doc': 'fecha',
  fecha: 'fecha',
  'serie numero': 'serie',
  'serie n': 'serie',
  'serie n umero': 'serie',
  serie: 'serie',
  almacen: 'almacen',
  'almac n': 'almacen',
  familia: 'familia',
  subfamilia: 'subfamilia',
  'centro de costos': 'centro_costos',
  proveedor: 'proveedor',
  articulo: 'articulo',
  'art culo': 'articulo',
  'cod barras': 'codigo',
  'c d barras': 'codigo',
  subarticulo: 'subarticulo',
  'subart culo': 'subarticulo',
  'coste linea': 'costo_unitario',
  'coste l nea': 'costo_unitario',
  'stock a fecha': 'stock_fecha',
  'variacion stock': 'variacion',
  'variaci n stock': 'variacion',
  'stock inventario': 'stock_inventario',
};

const NUMERICOS: (keyof LineaInventario)[] = ['costo_unitario', 'stock_fecha', 'variacion', 'stock_inventario'];

type Formato = 'CO' | 'INT';

const aNumero = (v: unknown, formato: Formato): number => {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;
  if (formato === 'CO') s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const aFecha = (v: unknown): string | null => {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // dd/mm/aaaa (HioPOS Colombia)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
};

/** Parte un texto CSV en filas (soporta comillas). */
const parsearCSV = (texto: string): string[][] => {
  const primera = texto.split(/\r?\n/, 1)[0];
  const sep = (primera.match(/;/g) || []).length >= (primera.match(/,/g) || []).length ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((x) => x.trim() !== ''));
};

/** Matriz [encabezados, ...filas] → líneas validadas. */
const aLineas = (matriz: unknown[][], esTexto: boolean): LineaInventario[] => {
  if (matriz.length < 2) throw new Error('El archivo no tiene filas de datos.');
  const enc = (matriz[0] as unknown[]).map((h) => CAMPOS[sinTildes(String(h ?? ''))]);
  for (const req of ['fecha', 'serie', 'almacen', 'articulo', 'stock_fecha', 'variacion', 'stock_inventario'] as const) {
    if (!enc.includes(req)) throw new Error(`Falta la columna obligatoria "${req}" en el archivo.`);
  }
  const crudas = matriz.slice(1).map((f) => {
    const o: Record<string, unknown> = {};
    enc.forEach((campo, i) => { if (campo) o[campo] = (f as unknown[])[i]; });
    return o;
  });
  const conFecha = crudas.filter((o) => aFecha(o.fecha));

  // Formato numérico: se prueba CO e INT y se queda el que cumple teórico + variación = físico.
  const cuadran = (formato: Formato) =>
    conFecha.filter((o) => {
      const [s, v, f] = [aNumero(o.stock_fecha, formato), aNumero(o.variacion, formato), aNumero(o.stock_inventario, formato)];
      return Math.abs(s + v - f) < 0.01;
    }).length;
  const formato: Formato = !esTexto ? 'INT' : cuadran('CO') >= cuadran('INT') ? 'CO' : 'INT';

  const lineas: LineaInventario[] = conFecha.map((o) => {
    const l: LineaInventario = {
      fecha: aFecha(o.fecha)!,
      serie: String(o.serie ?? '').trim(),
      almacen: String(o.almacen ?? '').trim(),
      familia: String(o.familia ?? '').trim() || null,
      subfamilia: String(o.subfamilia ?? '').trim() || null,
      centro_costos: String(o.centro_costos ?? '').trim() || null,
      proveedor: String(o.proveedor ?? '').trim() || null,
      articulo: String(o.articulo ?? '').trim(),
      codigo: String(o.codigo ?? '').trim() || null,
      subarticulo: String(o.subarticulo ?? '').trim() || null,
      costo_unitario: 0,
      stock_fecha: 0,
      variacion: 0,
      stock_inventario: 0,
    };
    for (const k of NUMERICOS) (l as unknown as Record<string, number>)[k] = aNumero(o[k], formato);
    return l;
  });
  const malas = lineas.filter((l) => NUMERICOS.some((k) => !Number.isFinite(l[k] as number)) || !l.articulo || !l.almacen || !l.serie);
  if (malas.length) throw new Error(`${malas.length} filas tienen números o datos obligatorios inválidos (ej.: ${malas[0].articulo || 'sin artículo'}).`);
  const descuadradas = lineas.filter((l) => Math.abs(l.stock_fecha + l.variacion - l.stock_inventario) > 0.01).length;
  if (descuadradas > lineas.length * 0.05) {
    throw new Error(`En ${descuadradas} de ${lineas.length} filas no cuadra Stock a Fecha + Variación = Stock Inventario. Revisa el formato de los números del archivo.`);
  }
  return lineas;
};

/** Lee un archivo .csv, .xlsx o .xls de HioPOS y devuelve sus líneas. */
export async function leerArchivoInventario(file: File): Promise<LineaInventario[]> {
  if (/\.csv$|\.txt$/i.test(file.name)) {
    const texto = await file.text();
    return aLineas(parsearCSV(texto.replace(/^﻿/, '')), true);
  }
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const hoja = wb.SheetNames.find((n) => n.toUpperCase().includes('BASE DE DATOS')) || wb.SheetNames[0];
  if (!hoja) throw new Error('El Excel no tiene hojas.');
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[hoja], { header: 1, raw: true, defval: '' });
  return aLineas(matriz, false);
}

export interface ResultadoSubida {
  carga_id: number;
  filas: number;
  documentos: number;
  nuevas: number;
  actualizadas: number;
}

/** Guarda las líneas en Supabase: agrega las nuevas y actualiza las repetidas. */
export async function subirInventario(archivo: string, lineas: LineaInventario[]): Promise<ResultadoSubida> {
  const { data, error } = await supabase.rpc('cruce_subir_inventario', { p_archivo: archivo, p_filas: lineas });
  if (error) {
    if (error.message.includes('SIN_PERMISO_PARA_SUBIR')) {
      throw new Error('Tu usuario puede consultar pero no subir inventarios. Pídele al administrador el rol de editor.');
    }
    throw new Error(`No se pudo guardar el inventario: ${error.message}`);
  }
  return data as ResultadoSubida;
}

/** Borra un inventario (almacén + fecha + serie). Admin o editor. Devuelve las líneas borradas. */
export async function borrarInventario(almacen: string, fecha: string, serie: string): Promise<number> {
  const { data, error } = await supabase.rpc('cruce_borrar_inventario', { p_almacen: almacen, p_fecha: fecha, p_serie: serie });
  if (error) {
    if (error.message.includes('SIN_PERMISO')) throw new Error('Tu usuario no puede borrar inventarios.');
    throw new Error(`No se pudo borrar el inventario: ${error.message}`);
  }
  return Number(data ?? 0);
}

/** Borra TODA la base del Cruce (inventarios y cargas). Solo administrador. */
export async function borrarTodo(): Promise<number> {
  const { data, error } = await supabase.rpc('cruce_borrar_todo');
  if (error) {
    if (error.message.includes('SOLO_ADMIN')) throw new Error('Solo el administrador puede borrar toda la base.');
    throw new Error(`No se pudo borrar la base: ${error.message}`);
  }
  return Number(data ?? 0);
}

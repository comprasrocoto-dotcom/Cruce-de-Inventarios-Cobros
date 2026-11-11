import React, { useRef, useState, useEffect } from 'react';
import { Upload, AlertCircle, Loader2, RefreshCw, Cloud } from 'lucide-react';
import { normalizeData } from '../utils/inventory';
import { ArticleSummary } from '../types';
import { leerLineas, aFormatoHioPOS, LineaInventario } from '../lib/inventariosSupabase';
import { leerArchivoInventario, subirInventario } from '../lib/subirInventario';

const NOMBRE_FUENTE = 'Supabase - Inventarios';

/**
 * Props del componente FileUpload.
 *
 * @property onDataLoaded     Callback que recibe los artículos normalizados y,
 *                            opcionalmente, info de depuración y un preview.
 * @property onReset          Callback que se dispara al limpiar la carga actual.
 * @property onFileNameChange Callback opcional para notificar el nombre de la
 *                            fuente cargada (archivo local o "Supabase - Inventarios").
 * @property hasData          Indica si ya hay datos cargados en la app padre.
 *                            Se usa para ocultar el panel de carga una vez listo.
 */
interface FileUploadProps {
  onDataLoaded: (data: ArticleSummary[], debug?: any, preview?: any[]) => void;
  onReset: () => void;
  onFileNameChange?: (name: string) => void;
  hasData: boolean;
  /**
   * Si es true, muestra el panel de carga aunque ya haya datos (se renderiza
   * como dropdown bajo la barra superior). Lo controla el botón "Cargar Excel"
   * del header en App. Al entrar a la app la carga automática sigue siendo
   * SIEMPRE desde Supabase.
   */
  forzarVisible?: boolean;
  /** Recibe las líneas tal como están en la base (para el nivel de confiabilidad por inventario). */
  onLineasCargadas?: (lineas: LineaInventario[]) => void;
}

/**
 * FileUpload
 *
 * Componente responsable de obtener la base de datos de inventario por dos vías:
 *
 *   1. Supabase (tabla cruce_inventarios) — fuente principal. Se carga
 *      automáticamente al montar el componente y puede recargarse manualmente.
 *   2. Subir un inventario (.csv / .xlsx / .xls) — se guarda en Supabase y
 *      luego se recarga todo desde la base.
 *
 * En ambos casos los datos crudos se pasan por `normalizeData` antes de
 * entregarse al padre mediante `onDataLoaded`.
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onDataLoaded,
  onReset,
  onFileNameChange,
  hasData,
  forzarVisible = false,
  onLineasCargadas,
}) => {
  // Aviso de éxito tras subir un archivo a la base.
  const [aviso, setAviso] = useState<string | null>(null);
  // Estado de carga (muestra spinner mientras se obtienen / procesan datos).
  const [loading, setLoading] = useState(false);
  // Mensaje de error visible para el usuario; null si no hay error.
  const [error, setError] = useState<string | null>(null);
  // Metadatos de la última fuente cargada (nombre, hoja y nº de filas).
  const [fileInfo, setFileInfo] = useState<{ name: string; sheet: string; rows: number } | null>(
    null
  );
  // Referencia al <input type="file"> oculto, para disparar el diálogo nativo.
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Carga todos los inventarios guardados en Supabase (tabla `cruce_inventarios`).
   * Las filas se convierten a los encabezados de HioPOS, así que se normalizan
   * igual que un Excel.
   */
  const loadFromSupabase = async () => {
    setLoading(true);
    setError(null);
    try {
      const lineas = await leerLineas();
      if (lineas.length === 0) {
        throw new Error('Todavía no hay inventarios en la base: sube el primer archivo de HioPOS (CSV o Excel).');
      }
      const rawData = lineas.map(aFormatoHioPOS);
      const { articles: items, debug } = normalizeData(rawData);
      if (items.length === 0) throw new Error('No se encontraron articulos validos.');
      setFileInfo({ name: NOMBRE_FUENTE, sheet: 'cruce_inventarios', rows: rawData.length });
      if (onFileNameChange) onFileNameChange(NOMBRE_FUENTE);
      onLineasCargadas?.(lineas);
      onDataLoaded(items, debug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar desde Supabase');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carga automática al montar el componente: trae los inventarios de
   * Supabase sin intervención del usuario.
   */
  useEffect(() => {
    loadFromSupabase();
  }, []);

  /**
   * Sube un inventario de HioPOS (.csv, .xlsx o .xls) a la base de Supabase y
   * luego recarga todo desde la base. Si el archivo trae un documento (fecha +
   * serie + almacén) que ya estaba, lo reemplaza; así subir dos veces el mismo
   * inventario no duplica nada.
   */
  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const lineas = await leerArchivoInventario(file);
      if (lineas.length === 0) throw new Error('El archivo no trae líneas de inventario.');
      const r = await subirInventario(file.name, lineas);
      setAviso(
        `Se guardaron ${r.filas} líneas de ${r.documentos} inventario(s)` +
          (r.reemplazadas ? ` (reemplazaron ${r.reemplazadas} líneas que ya estaban).` : '.')
      );
      setLoading(false);
      await loadFromSupabase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handler del <input type="file">: toma el primer archivo y lo procesa.
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };
  // Handler de drag & drop: evita el comportamiento por defecto y procesa el archivo soltado.
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // --- Render: estado de carga -------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-[#0A1A2A] border border-[#1A3A5A] rounded-xl">
        <Loader2 className="w-4 h-4 text-[#38BDF8] animate-spin" />
        <span className="text-sm text-blue-700 font-medium">
          Cargando inventarios desde Supabase...
        </span>
      </div>
    );
  }

  // Si ya hay datos cargados y metadatos disponibles, el panel se oculta.
  if (hasData && fileInfo && !forzarVisible) {
    return null;
  }

  // Con datos ya cargados, el panel se muestra como dropdown anclado al header
  // (no desplaza el layout); sin datos, se muestra inline como siempre.
  const comoDropdown = hasData && forzarVisible;

  // --- Render: panel de carga (Supabase + Excel local) -------------------------
  return (
    <div
      className={
        comoDropdown
          ? 'absolute right-6 top-full mt-2 z-50 w-96 max-w-[90vw] bg-[#081423] border border-[#1A3A5A] rounded-xl p-4 shadow-2xl flex flex-col gap-3'
          : 'flex flex-col gap-3'
      }
    >
      {comoDropdown && (
        <p className="text-[10px] uppercase tracking-widest text-[#8EA3BF] font-bold">
          Cargar otra fuente de datos
        </p>
      )}
      {/* Banner de error con acción de reintento sobre Supabase. */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#2A1010] border border-[#5A2020] rounded-xl text-[#EF4444] text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={loadFromSupabase}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 underline"
          >
            <RefreshCw className="w-3 h-3" /> Reintentar
          </button>
        </div>
      )}

      {aviso && (
        <div className="px-4 py-2 bg-[#0B2A1A] border border-[#1F5A3A] rounded-xl text-emerald-400 text-sm">{aviso}</div>
      )}

      {/* Acción principal: recarga manual desde Supabase. */}
      <button
        onClick={loadFromSupabase}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors shadow-sm disabled:opacity-60"
      >
        <Cloud className="w-4 h-4" />
        Recargar desde Supabase
      </button>

      {/* Separador visual entre las dos fuentes de datos. */}
      <div className="relative flex items-center gap-2 text-xs text-gray-400">
        <div className="flex-1 h-px bg-[#243A57]" />
        <span>o bien</span>
        <div className="flex-1 h-px bg-[#243A57]" />
      </div>

      {/* Zona de carga local: drag & drop o clic para abrir el selector de archivos. */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-[#243A57] rounded-xl p-4 text-center cursor-pointer hover:border-[#38BDF8] hover:bg-[#1A2E4A] transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileInput}
        />
        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
        <p className="text-xs font-medium text-[#8EA3BF]">Subir inventario de HioPOS a la base</p>
        <p className="text-xs text-gray-400">
          Arrastra el archivo .csv o .xlsx o haz clic para seleccionar. Queda guardado para todos.
        </p>
      </div>
    </div>
  );
};

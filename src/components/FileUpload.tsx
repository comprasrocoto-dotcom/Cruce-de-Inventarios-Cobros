import React, { useRef, useState, useEffect } from 'react';
import { Upload, AlertCircle, Loader2, RefreshCw, Cloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import { normalizeData } from '../utils/inventory';
import { ArticleSummary } from '../types';
import { SHEET_API_URL, SHEET_NAME } from '../config';

/**
 * Props del componente FileUpload.
 *
 * @property onDataLoaded     Callback que recibe los artículos normalizados y,
 *                            opcionalmente, info de depuración y un preview.
 * @property onReset          Callback que se dispara al limpiar la carga actual.
 * @property onFileNameChange Callback opcional para notificar el nombre de la
 *                            fuente cargada (archivo local o "Google Sheets - ...").
 * @property hasData          Indica si ya hay datos cargados en la app padre.
 *                            Se usa para ocultar el panel de carga una vez listo.
 */
interface FileUploadProps {
  onDataLoaded: (data: ArticleSummary[], debug?: any, preview?: any[]) => void;
  onReset: () => void;
  onFileNameChange?: (name: string) => void;
  hasData: boolean;
}

/**
 * FileUpload
 *
 * Componente responsable de obtener la base de datos de inventario por dos vías:
 *
 *   1. Google Sheets (vía Apps Script) — fuente principal. Se carga
 *      automáticamente al montar el componente y puede recargarse manualmente.
 *   2. Excel local (.xlsx / .xls) — fuente alternativa, por drag & drop o
 *      selección manual de archivo.
 *
 * En ambos casos los datos crudos se pasan por `normalizeData` antes de
 * entregarse al padre mediante `onDataLoaded`.
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onDataLoaded,
  onReset,
  onFileNameChange,
  hasData,
}) => {
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
   * Carga los datos desde Google Sheets a través del Web App de Apps Script.
   *
   * El endpoint devuelve directamente un JSON: un array de objetos (una fila por
   * artículo) o, en caso de fallo controlado en el backend, un objeto { error }.
   * Por eso se valida tanto el `error` explícito como que la respuesta sea un
   * array no vacío antes de normalizar.
   */
  const loadFromGoogleSheets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(SHEET_API_URL);
      if (!response.ok) throw new Error(`Error al acceder a Google Sheets: ${response.status}`);

      const rawData = await response.json();

      if (rawData && rawData.error) throw new Error(rawData.error);
      if (!Array.isArray(rawData) || rawData.length === 0) {
        throw new Error('La hoja de Google Sheets no devolvió datos');
      }

      const { articles: items, errors, debug } = normalizeData(rawData);
      if (items.length === 0) throw new Error('No se encontraron articulos validos.');

      setFileInfo({
        name: `Google Sheets - ${SHEET_NAME}`,
        sheet: SHEET_NAME,
        rows: rawData.length,
      });
      if (onFileNameChange) onFileNameChange(`Google Sheets - ${SHEET_NAME}`);
      onDataLoaded(items, debug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar desde Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Carga automática al montar el componente: intenta traer los datos de
   * Google Sheets sin intervención del usuario.
   */
  useEffect(() => {
    loadFromGoogleSheets();
  }, []);

  /**
   * Procesa un archivo Excel local (.xlsx / .xls).
   *
   * Flujo:
   *   1. Lee el archivo como ArrayBuffer y lo parsea con SheetJS (XLSX).
   *   2. Selecciona la hoja cuyo nombre contenga "BASE DE DATOS"; si no existe,
   *      usa la primera hoja del libro.
   *   3. Convierte la hoja a matriz (header:1), separa cabeceras de filas de
   *      datos y descarta filas totalmente vacías.
   *   4. Reconstruye objetos { cabecera: valor } y los normaliza.
   *
   * @param file Archivo seleccionado o soltado por el usuario.
   */
  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const sheetName =
        workbook.SheetNames.find((n) => n.toUpperCase().includes('BASE DE DATOS')) ||
        workbook.SheetNames[0];
      if (!sheetName) throw new Error('No se encontraron hojas en el archivo Excel');
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd',
      });
      if (rawData.length < 2) throw new Error('El archivo Excel no tiene datos suficientes');
      const headers = rawData[0] as string[];
      const dataRows = rawData
        .slice(1)
        .filter((row) => row.some((cell: any) => cell !== '' && cell != null));
      const formattedData: any[] = dataRows.map((row) => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = (row as any[])[index] ?? '';
        });
        return obj;
      });
      const { articles: items, errors, debug } = normalizeData(formattedData);
      if (items.length === 0) throw new Error('No se encontraron articulos validos.');
      setFileInfo({ name: file.name, sheet: sheetName, rows: dataRows.length });
      if (onFileNameChange) onFileNameChange(file.name);
      onDataLoaded(items, debug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
    } finally {
      setLoading(false);
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
          Cargando datos desde Google Sheets...
        </span>
      </div>
    );
  }

  // Si ya hay datos cargados y metadatos disponibles, el panel se oculta.
  if (hasData && fileInfo) {
    return null;
  }

  // --- Render: panel de carga (Google Sheets + Excel local) --------------------
  return (
    <div className="flex flex-col gap-3">
      {/* Banner de error con acción de reintento sobre Google Sheets. */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#2A1010] border border-[#5A2020] rounded-xl text-[#EF4444] text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button
            onClick={loadFromGoogleSheets}
            className="ml-auto flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 underline"
          >
            <RefreshCw className="w-3 h-3" /> Reintentar
          </button>
        </div>
      )}

      {/* Acción principal: recarga manual desde Google Sheets. */}
      <button
        onClick={loadFromGoogleSheets}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors shadow-sm disabled:opacity-60"
      >
        <Cloud className="w-4 h-4" />
        Cargar desde Google Sheets
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
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileInput}
        />
        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
        <p className="text-xs font-medium text-[#8EA3BF]">Cargar Excel local</p>
        <p className="text-xs text-gray-400">
          Arrastra tu archivo .xlsx o haz clic para seleccionar
        </p>
      </div>
    </div>
  );
};

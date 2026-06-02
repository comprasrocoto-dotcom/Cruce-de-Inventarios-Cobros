import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, RefreshCw, Cloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import { normalizeData } from '../utils/inventory';
import { ArticleSummary } from '../types';
import { motion } from 'motion/react';

const SHEET_ID = '1Sce90Tdc-f4RdiF1aWdotYKO4jkFn1Dy';
const SHEET_NAME = 'BASE DE DATOS';
const CSV_URL = '/api/sheets';

interface FileUploadProps {
  onDataLoaded: (data: ArticleSummary[], debug?: any, preview?: any[]) => void;
  onReset: () => void;
  onFileNameChange?: (name: string) => void;
  hasData: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, onReset, onFileNameChange, hasData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; sheet: string; rows: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFromGoogleSheets = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(CSV_URL);
      if (!response.ok) throw new Error(`Error al acceder a Google Sheets: ${response.status}`);
      const csvText = await response.text();
      const rows = csvText.split('\n').map(row => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '"') { inQuotes = !inQuotes; }
          else if (row[i] === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
          else { current += row[i]; }
        }
        result.push(current.trim());
        return result;
      }).filter(row => row.some(cell => cell !== ''));
      if (rows.length < 2) throw new Error('El archivo de Google Sheets no tiene datos suficientes');
      const headers = rows[0];
      const dataRows = rows.slice(1);
      const rawData: any[] = dataRows.map(row => {
        const obj: any = {};
        headers.forEach((header, idx) => { obj[header] = row[idx] ?? ''; });
        return obj;
      });
      const { articles, debug, preview } = normalizeData(rawData);
      if (articles.length === 0) throw new Error('No se encontraron articulos validos.');
      setFileInfo({ name: `Google Sheets - ${SHEET_NAME}`, sheet: SHEET_NAME, rows: dataRows.length });
      if (onFileNameChange) onFileNameChange(`Google Sheets - ${SHEET_NAME}`);
      onDataLoaded(articles, debug, preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar desde Google Sheets');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames.find(n => n.toUpperCase().includes('BASE DE DATOS')) || workbook.SheetNames[0];
      if (!sheetName) throw new Error('No se encontraron hojas en el archivo Excel');
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
      if (rawData.length < 2) throw new Error('El archivo Excel no tiene datos suficientes');
      const headers = rawData[0] as string[];
      const dataRows = rawData.slice(1).filter(row => row.some((cell: any) => cell !== '' && cell != null));
      const formattedData: any[] = dataRows.map(row => {
        const obj: any = {};
        headers.forEach((header, idx) => { obj[header] = (row as any[])[idx] ?? ''; });
        return obj;
      });
      const { articles, debug, preview } = normalizeData(formattedData);
      if (articles.length === 0) throw new Error('No se encontraron articulos validos.');
      setFileInfo({ name: file.name, sheet: sheetName, rows: dataRows.length });
      if (onFileNameChange) onFileNameChange(file.name);
      onDataLoaded(articles, debug, preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleFile(file); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); };
  const handleReset = () => { setFileInfo(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = ''; onReset(); };

  if (hasData && fileInfo) {
    return (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            {fileInfo.name.startsWith('Google Sheets') ? <Cloud className="w-5 h-5 text-emerald-600" /> : <FileSpreadsheet className="w-5 h-5 text-emerald-600" />}
          </div>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">{fileInfo.name}</p>
            <p className="text-emerald-600 text-xs">Hoja: {fileInfo.sheet} · {fileInfo.rows.toLocaleString()} filas</p>
          </div>
        </div>
        <div className="flex gap-2">
          {fileInfo.name.startsWith('Google Sheets') && (
            <button onClick={loadFromGoogleSheets} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          )}
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5" />
            Cambiar
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={loadFromGoogleSheets} disabled={loading}
        className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed">
        {loading ? <><Loader2 className="w-5 h-5 animate-spin" />Cargando desde Google Sheets...</> : <><Cloud className="w-5 h-5" />Cargar desde Google Sheets</>}
      </motion.button>
      <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-200" /><span className="text-xs text-gray-400 font-medium">o bien</span><div className="flex-1 h-px bg-gray-200" /></div>
      <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-6 text-center cursor-pointer transition-colors group">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileInput} className="hidden" />
        <Upload className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mx-auto mb-2 transition-colors" />
        <p className="text-sm font-medium text-gray-600 group-hover:text-blue-600 transition-colors">Cargar Excel local</p>
        <p className="text-xs text-gray-400 mt-1">Arrastra tu archivo .xlsx o haz clic para seleccionar</p>
      </div>
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Error al cargar</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

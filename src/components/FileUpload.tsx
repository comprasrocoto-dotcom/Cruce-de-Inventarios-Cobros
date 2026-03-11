import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, Table } from 'lucide-react';
import * as XLSX from 'xlsx';
import { normalizeData } from '../utils/inventory';
import { ArticleSummary } from '../types';
import { motion } from 'motion/react';

interface FileUploadProps {
  onDataLoaded: (data: ArticleSummary[], debug?: any, preview?: any[]) => void;
  onReset: () => void;
  hasData: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, onReset, hasData }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string, sheet: string, rows: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      
      let sheetName = workbook.SheetNames.find(name => 
        name.toUpperCase().includes("BASE DE DATOS")
      ) || workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("No se encontraron hojas en el archivo Excel");
      }

      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true });
      
      if (json.length === 0) {
        throw new Error("El archivo no contiene datos válidos o la hoja está vacía");
      }

      const { articles, errors, debug: debugInfo } = normalizeData(json);
      
      if (errors.length > 0) {
        setError(errors[0]);
        setLoading(false);
        return;
      }

      setFileInfo({
        name: file.name,
        sheet: sheetName,
        rows: json.length
      });

      onDataLoaded(articles, debugInfo, json.slice(0, 10));
      setLoading(false);
    } catch (err: any) {
      console.error("Excel Processing Error:", err);
      setError(err.message || "No se pudo leer el archivo");
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFileInfo(null);
    setError(null);
    onReset();
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
      />
      
      <div className="flex items-center gap-3">
        {hasData && fileInfo && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg border border-white/10">
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-200" />
            <span className="text-[10px] font-bold text-white truncate max-w-[120px]">{fileInfo.name}</span>
            <button 
              onClick={handleReset}
              className="p-1 hover:bg-white/20 rounded-md transition-colors"
              title="Cambiar archivo"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className={`
            flex items-center gap-2 px-3.5 py-2 bg-[#2F80ED] hover:bg-[#1C6DD0] text-white rounded-lg text-[13px] font-bold transition-all shadow-sm
            ${loading ? 'opacity-70 cursor-not-allowed' : ''}
          `}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>{loading ? 'Cargando...' : 'Cargar Excel'}</span>
        </button>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full right-0 mt-2 w-64 z-50 flex items-center space-x-2 bg-rose-50 border border-rose-100 p-3 rounded-xl text-rose-700 shadow-xl"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <p className="text-[10px] font-bold leading-tight">{error}</p>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded">
            <X className="w-3 h-3" />
          </button>
        </motion.div>
      )}
    </div>
  );
};

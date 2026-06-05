import React, { useRef, useState, useEffect } from 'react';



import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, RefreshCw, Cloud } from 'lucide-react';



import * as XLSX from 'xlsx';



import { normalizeData } from '../utils/inventory';



import { ArticleSummary } from '../types';



import { motion } from 'motion/react';







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



        headers.forEach((header, index) => { obj[header] = row[index] ?? ''; });



        return obj;



      });



      const { articles: items, errors, debug } = normalizeData(rawData);



      if (items.length === 0) throw new Error('No se encontraron articulos validos.');



      setFileInfo({ name: `Google Sheets - ${SHEET_NAME}`, sheet: SHEET_NAME, rows: dataRows.length });



      if (onFileNameChange) onFileNameChange(`Google Sheets - ${SHEET_NAME}`);



      onDataLoaded(items, debug);



    } catch (err) {



      setError(err instanceof Error ? err.message : 'Error al cargar desde Google Sheets');



    } finally {



      setLoading(false);



    }



  };







  useEffect(() => {



    loadFromGoogleSheets();



  }, []);







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



        headers.forEach((header, index) => { obj[header] = (row as any[])[index] ?? ''; });



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







  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) handleFile(file); };



  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); };



  const handleReset = () => { setFileInfo(null); setError(null); if (fileInputRef.current) fileInputRef.current.value = ''; onReset(); };







  if (loading) {



    return (



      <div className="flex items-center gap-3 px-4 py-2 bg-[#0A1A2A] border border-[#1A3A5A] rounded-xl">



        <Loader2 className="w-4 h-4 text-[#38BDF8] animate-spin" />



        <span className="text-sm text-blue-700 font-medium">Cargando datos desde Google Sheets...</span>



      </div>



    );



  }















  if (hasData && fileInfo) { return null; }



  return (



    <div className="flex flex-col gap-3">



      {error && (



        <div className="flex items-center gap-2 px-4 py-2 bg-[#2A1010] border border-[#5A2020] rounded-xl text-[#EF4444] text-sm">



          <AlertCircle className="w-4 h-4 flex-shrink-0" />



          <span>{error}</span>



          <button onClick={loadFromGoogleSheets} className="ml-auto flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 underline">



            <RefreshCw className="w-3 h-3" /> Reintentar



          </button>



        </div>



      )}



      <button



        onClick={loadFromGoogleSheets}



        disabled={loading}



        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl transition-colors shadow-sm disabled:opacity-60"



      >



        <Cloud className="w-4 h-4" />



        Cargar desde Google Sheets



      </button>



      <div className="relative flex items-center gap-2 text-xs text-gray-400">



        <div className="flex-1 h-px bg-[#243A57]" />



        <span>o bien</span>



        <div className="flex-1 h-px bg-[#243A57]" />



      </div>



      <div



        onDrop={handleDrop}



        onDragOver={(e) => e.preventDefault()}



        onClick={() => fileInputRef.current?.click()}



        className="border-2 border-dashed border-[#243A57] rounded-xl p-4 text-center cursor-pointer hover:border-[#38BDF8] hover:bg-[#1A2E4A] transition-colors"



      >



        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} />



        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />



        <p className="text-xs font-medium text-[#8EA3BF]">Cargar Excel local</p>



        <p className="text-xs text-gray-400">Arrastra tu archivo .xlsx o haz clic para seleccionar</p>



      </div>



    </div>



  );



};




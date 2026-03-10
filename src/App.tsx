import React, { useState, useCallback } from 'react';
import { Resumen } from './components/Resumen';
import { Analisis } from './components/Analisis';
import { Cobros } from './components/Cobros';
import { Confiabilidad } from './components/Confiabilidad';
import { InventoryItem } from './utils';
import { Upload, LayoutDashboard, BarChart2, DollarSign, ShieldCheck, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'RESUMEN' | 'ANÁLISIS' | 'COBROS' | 'CONFIABILIDAD';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('RESUMEN');
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        const mappedData: InventoryItem[] = jsonData.map(row => {
          // Mapping for Artículo with fallback and encoding variants
          const articulo = row['Artículo'] || row['Articulo'] || row['ArtÃculo'] || 'Sin artículo';
          
          // Mapping for Unidad (from Subartículo) with fallback and encoding variants
          let unidad = row['Subartículo'] || row['Subarticulo'] || row['SubartÃculo'] || 'Sin unidad';
          
          // Normalization of units
          const upperUnidad = String(unidad).toUpperCase().trim();
          if (upperUnidad === 'UN') unidad = 'UNIDADES';
          else if (upperUnidad === 'GR') unidad = 'GRAMOS';
          else if (upperUnidad === 'OZ') unidad = 'ONZAS';

          // Mapping for Coste Línea with fallback and encoding variants
          const costeLinea = Number(row['Coste Línea'] || row['Coste Linea'] || row['Coste LÃnea'] || 0);

          // Mapping for CC with fallback variants
          const cc = row['CC'] || row['Cc'] || row['Centro de Costos'] || row['Centro Costos'] || row['C.C.'] || row['CENTRO COSTOS'] || '';
          const ccValue = cc ? String(cc).trim() : 'Sin CC';

          return {
            fechaDoc: row['Fecha Doc'] || '',
            serieNumero: row['Serie / Número'] || '',
            sede: row['Sede'] || 'Sin Sede',
            cc: ccValue,
            subfamilia: row['Subfamilia'] || '',
            articulo: articulo,
            codBarras: row['Cód. Barras'] || '',
            subarticulo: row['Subartículo'] || row['Subarticulo'] || row['SubartÃculo'] || '',
            costeLinea: costeLinea,
            stockFecha: Number(row['Stock a Fecha'] || 0),
            variacionStock: Number(row['Variación Stock'] || 0),
            stockInventario: Number(row['Stock Inventario'] || 0),
            unidad: unidad
          };
        });

        // Temporal debug log
        if (mappedData.length > 0) {
          console.log("Primer registro transformado:", {
            sede: mappedData[0].sede,
            cc: mappedData[0].cc,
            articulo: mappedData[0].articulo,
            unidad: mappedData[0].unidad,
            variacion: mappedData[0].variacionStock,
            coste: mappedData[0].costeLinea
          });
        }

        setInventoryData(mappedData);
      } catch (error) {
        console.error("Error parsing Excel:", error);
        alert("Error al cargar el archivo. Asegúrese de que sea un Excel válido con las columnas requeridas.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const renderContent = () => {
    if (inventoryData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-6">
          <div className="p-8 bg-white rounded-3xl border-2 border-dashed border-brand-border flex flex-col items-center text-center max-w-md shadow-sm">
            <div className="p-4 bg-blue-50 rounded-full mb-4">
              <FileSpreadsheet className="w-12 h-12 text-brand-primary" />
            </div>
            <h2 className="text-2xl font-bold text-brand-text mb-2">Cargar Base de Datos</h2>
            <p className="text-gray-500 mb-6">
              Seleccione su archivo Excel de inventario para comenzar el análisis de auditoría y cobros.
            </p>
            <label className="cursor-pointer bg-brand-primary hover:bg-brand-hover text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Seleccionar Archivo
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
          </div>
          {isLoading && <p className="text-brand-primary font-bold animate-pulse">Procesando datos...</p>}
        </div>
      );
    }

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'RESUMEN' && <Resumen data={inventoryData} />}
          {activeTab === 'ANÁLISIS' && <Analisis data={inventoryData} />}
          {activeTab === 'COBROS' && <Cobros data={inventoryData} />}
          {activeTab === 'CONFIABILIDAD' && <Confiabilidad data={inventoryData} />}
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Bar */}
      <header className="bg-brand-topbar text-white px-6 py-4 flex justify-between items-center shadow-lg z-10">
        <div className="flex items-center gap-3">
          <div className="bg-brand-primary p-2 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">CRUCES DE INVENTARIO</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold">Auditoría y Cobros por Sede</p>
          </div>
        </div>
        
        {inventoryData.length > 0 && (
          <div className="flex items-center gap-4">
            <label className="cursor-pointer text-xs font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
              <Upload className="w-3 h-3" />
              Actualizar Datos
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
            <div className="h-8 w-px bg-white/10"></div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-400 uppercase">Estado</p>
              <p className="text-xs font-bold text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Sistema Activo
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      {inventoryData.length > 0 && (
        <nav className="bg-white border-b border-brand-border px-6 flex items-center gap-8 shadow-sm">
          {(['RESUMEN', 'ANÁLISIS', 'COBROS', 'CONFIABILIDAD'] as Tab[]).map((tab) => {
            const Icon = {
              RESUMEN: LayoutDashboard,
              ANÁLISIS: BarChart2,
              COBROS: DollarSign,
              CONFIABILIDAD: ShieldCheck
            }[tab];

            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-bold text-sm transition-all ${
                  activeTab === tab 
                    ? 'border-brand-primary text-brand-primary' 
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab}
              </button>
            );
          })}
        </nav>
      )}

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {renderContent()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-brand-border p-4 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        © {new Date().getFullYear()} PROMPT MAESTRO – SISTEMA DE AUDITORÍA DE INVENTARIOS
      </footer>
    </div>
  );
}

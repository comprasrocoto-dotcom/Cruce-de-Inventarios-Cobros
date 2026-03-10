import React from 'react';
import { Card } from './Card';
import { CircularProgress } from './CircularProgress';
import { InventoryItem, formatCurrency, getReliabilityStatus, getReliabilityColor } from '../utils';
import { Users, Package, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';

interface ResumenProps {
  data: InventoryItem[];
}

export const Resumen: React.FC<ResumenProps> = ({ data }) => {
  const sedes = Array.from(new Set(data.map(item => item.sede)));
  const totalArticulos = data.length;
  const totalDiferencias = data.filter(item => item.variacionStock !== 0).length;
  const impactoTotal = data.reduce((acc, item) => acc + (Math.abs(item.variacionStock) * item.costeLinea), 0);
  
  const articulosSinDiferencia = data.filter(item => item.variacionStock === 0).length;
  const confiabilidadPromedio = totalArticulos > 0 ? (articulosSinDiferencia / totalArticulos) * 100 : 0;

  const statsBySede = sedes.map(sede => {
    const sedeData = data.filter(item => item.sede === sede);
    const sedeTotal = sedeData.length;
    const sedeSinDiferencia = sedeData.filter(item => item.variacionStock === 0).length;
    const sedeDiferencias = sedeData.filter(item => item.variacionStock !== 0).length;
    const sedeImpacto = sedeData.reduce((acc, item) => acc + (Math.abs(item.variacionStock) * item.costeLinea), 0);
    const sedeConfiabilidad = sedeTotal > 0 ? (sedeSinDiferencia / sedeTotal) * 100 : 0;

    return {
      nombre: sede,
      confiabilidad: sedeConfiabilidad,
      articulos: sedeTotal,
      diferencias: sedeDiferencias,
      impacto: sedeImpacto
    };
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Indicadores Generales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="flex flex-col items-center justify-center text-center p-4">
          <div className="p-3 bg-blue-100 rounded-full mb-3">
            <Users className="w-6 h-6 text-brand-primary" />
          </div>
          <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Sedes</p>
          <p className="text-2xl font-bold">{sedes.length}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center p-4">
          <div className="p-3 bg-purple-100 rounded-full mb-3">
            <Package className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Artículos</p>
          <p className="text-2xl font-bold">{totalArticulos}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center p-4">
          <div className="p-3 bg-orange-100 rounded-full mb-3">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
          </div>
          <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Diferencias</p>
          <p className="text-2xl font-bold">{totalDiferencias}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center p-4">
          <div className="p-3 bg-green-100 rounded-full mb-3">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Impacto Econ.</p>
          <p className="text-2xl font-bold">${formatCurrency(impactoTotal)}</p>
        </Card>
        <Card className="flex flex-col items-center justify-center text-center p-4">
          <div className="p-3 bg-indigo-100 rounded-full mb-3">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Confiabilidad</p>
          <p className="text-2xl font-bold">{Math.round(confiabilidadPromedio)}%</p>
        </Card>
      </div>

      {/* Tarjetas por Sede */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-brand-text">Resumen por Sede</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {statsBySede.map((sede, idx) => (
            <Card key={idx} className="hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold text-brand-text">{sede.nombre}</h3>
                  <span 
                    className="text-xs font-bold px-2 py-1 rounded-full uppercase"
                    style={{ 
                      backgroundColor: `${getReliabilityColor(sede.confiabilidad)}20`,
                      color: getReliabilityColor(sede.confiabilidad)
                    }}
                  >
                    {getReliabilityStatus(sede.confiabilidad)}
                  </span>
                </div>
                <CircularProgress percentage={sede.confiabilidad} size={70} strokeWidth={8} />
              </div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-brand-border pt-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Artículos</p>
                  <p className="text-lg font-bold">{sede.articulos}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Diferencias</p>
                  <p className="text-lg font-bold text-orange-600">{sede.diferencias}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Impacto Económico</p>
                  <p className="text-lg font-bold text-brand-primary">${formatCurrency(sede.impacto)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

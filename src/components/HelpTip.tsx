/**
 * Sistema de ayudas "?" con panel lateral.
 *
 * Replica el patrón del dashboard de cocina de Rocoto: cada sección, gráfica
 * o filtro tiene un botón "?" que despliega A UN COSTADO una explicación en
 * lenguaje llano, enriquecida con EJEMPLOS CONSTRUIDOS CON LOS DATOS REALES
 * del corte actual (no ejemplos inventados).
 *
 * Piezas:
 *   <HelpProvider articles={...}>  envuelve la app y aporta los datos para
 *                                  los ejemplos dinámicos + renderiza el panel.
 *   <HelpTip clave="..." />        el botón "?" que abre la ayuda de esa clave.
 *
 * Los textos viven centralizados en src/help.tsx (diccionario AYUDAS).
 */
import React, { createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle } from 'lucide-react';
import { ArticleSummary } from '../types';
import { AYUDAS, HelpCtx } from '../help';

interface HelpContextValue {
  abrir: (clave: string) => void;
}

const HelpContext = createContext<HelpContextValue>({ abrir: () => {} });

export const HelpProvider: React.FC<{
  articles: ArticleSummary[];
  children: React.ReactNode;
}> = ({ articles, children }) => {
  const [clave, setClave] = useState<string | null>(null);

  const entrada = clave ? AYUDAS[clave] : null;
  const ctx: HelpCtx = { articles };

  return (
    <HelpContext.Provider value={{ abrir: setClave }}>
      {/* Cuando el panel está abierto, el contenido se DESPLAZA (no se tapa):
          en pantallas grandes se abre espacio a la derecha; en móvil el panel
          flota encima (no hay ancho para ambos). */}
      <div
        className={
          entrada
            ? 'lg:pr-[430px] transition-[padding] duration-300'
            : 'transition-[padding] duration-300'
        }
      >
        {children}
      </div>

      {/* Panel lateral (banda a un costado, como el dashboard de cocina) */}
      <AnimatePresence>
        {entrada && (
          <>
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed right-0 top-0 h-full w-[420px] max-w-[94vw] z-[71] bg-[#f5f7fa] border-l border-brand-border shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-brand-border bg-[#f7f8fa]">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="bg-[#1976d2]/15 p-1.5 rounded-lg text-[#1976d2] flex-shrink-0">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-text-main text-sm uppercase tracking-tight truncate">
                    {entrada.titulo}
                  </h3>
                </div>
                <button
                  onClick={() => setClave(null)}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-black/5 transition-colors flex-shrink-0"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-[13px] leading-relaxed text-[#424242]">
                {entrada.contenido(ctx)}
              </div>
              <div className="px-5 py-3 border-t border-brand-border bg-[#f7f8fa] text-[10px] text-text-secondary">
                Toca <b className="text-[#1976d2]">?</b> en cualquier sección para entender qué
                estás viendo. Los ejemplos usan los datos del corte actual.
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </HelpContext.Provider>
  );
};

/** Botón "?" que abre la ayuda de la clave indicada. */
export const HelpTip: React.FC<{ clave: string; className?: string }> = ({
  clave,
  className = '',
}) => {
  const { abrir } = useContext(HelpContext);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        abrir(clave);
      }}
      className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#1976d2]/20 text-[#1976d2] text-[11px] font-black leading-none hover:bg-[#1976d2] hover:text-[#ffffff] transition-colors flex-shrink-0 align-middle ${className}`}
      title="¿Qué estoy viendo? (abre explicación al costado)"
      type="button"
    >
      ?
    </button>
  );
};

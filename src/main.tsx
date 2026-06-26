/**
 * Punto de entrada de la aplicación. Monta el componente raíz <App /> en el
 * DOM dentro de React.StrictMode y carga los estilos globales (Tailwind).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

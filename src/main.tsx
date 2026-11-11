/**
 * Punto de entrada de la aplicación. Monta el componente raíz <App /> en el
 * DOM dentro de React.StrictMode y carga los estilos globales (Tailwind).
 * <AuthGate> exige iniciar sesión (Supabase) antes de mostrar la app.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthGate } from './components/AuthGate';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>
);

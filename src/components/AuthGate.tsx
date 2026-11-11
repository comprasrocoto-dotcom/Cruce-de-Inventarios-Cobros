/**
 * AuthGate — exige iniciar sesión antes de mostrar la app.
 *
 * Usa el mismo inicio de sesión del Informe de Rentabilidad Centralizado
 * (Supabase Auth, correo + contraseña): las cuentas se crean y las contraseñas
 * se cambian allá. Además, el correo debe estar registrado en `cruce_accesos`
 * (rol admin, editor o lector); si no, se muestra un aviso y no se cargan datos.
 */
import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, LogOut, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { URL_RENTABILIDAD } from '../config';

const Login: React.FC = () => {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: correo.trim().toLowerCase(),
      password: clave,
    });
    if (error) {
      const m = error.message.toLowerCase();
      setError(
        m.includes('invalid')
          ? 'Correo o contraseña incorrectos.'
          : m.includes('fetch') || m.includes('network')
            ? 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.'
            : `No se pudo iniciar sesión: ${error.message}`
      );
    }
    setEnviando(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4">
      <form
        onSubmit={entrar}
        className="w-full max-w-sm space-y-4 rounded border border-linea bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]" style={{ borderTop: '4px solid #1976d2' }}
      >
        <div className="flex items-center gap-2 text-text-main">
          <Lock className="w-5 h-5 text-[#1976d2]" />
          <h1 className="text-lg font-medium text-tinta">Cruce de Inventarios y Cobros</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Entra con el mismo correo y contraseña del Informe de Rentabilidad.
        </p>
        <label className="block text-xs text-text-secondary">
          Correo
          <input
            type="email"
            required
            autoComplete="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="mt-1 h-9 w-full rounded-sm border border-linea bg-white px-2.5 text-text-main outline-none focus:border-[#1976d2]"
          />
        </label>
        <label className="block text-xs text-text-secondary">
          Contraseña
          <input
            type="password"
            required
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className="mt-1 h-9 w-full rounded-sm border border-linea bg-white px-2.5 text-text-main outline-none focus:border-[#1976d2]"
          />
        </label>
        {error && <p className="text-sm text-[#d32f2f]">{error}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-[#1976d2] font-medium text-white hover:bg-[#1565c0] disabled:opacity-60"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          Entrar
        </button>
        <p className="text-xs text-text-secondary">
          ¿No tienes cuenta u olvidaste la contraseña? Créala o cámbiala en el{' '}
          <a
            href={URL_RENTABILIDAD}
            target="_blank"
            rel="noreferrer"
            className="text-[#1976d2] underline"
          >
            Informe de Rentabilidad
          </a>
          . Solo los correos autorizados pueden entrar.
        </p>
      </form>
    </div>
  );
};

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [listo, setListo] = useState(false);
  // Rol en el Cruce (cruce_accesos): admin, editor o lector. null = sin acceso.
  const [rol, setRol] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setListo(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return setRol(undefined);
    supabase.rpc('cruce_mi_rol').then(({ data, error }) => setRol(error ? null : ((data as string) ?? null)));
  }, [session?.user.id]);

  if (!listo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
        <Loader2 className="w-6 h-6 text-[#1976d2] animate-spin" />
      </div>
    );
  }
  if (!session) return <Login />;
  if (rol === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
        <Loader2 className="w-6 h-6 text-[#1976d2] animate-spin" />
      </div>
    );
  }
  if (rol === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4">
        <div className="w-full max-w-sm space-y-3 rounded border border-linea bg-white p-6 text-sm text-text-secondary">
          <p className="text-text-main font-bold">Tu correo no tiene acceso al Cruce de Inventarios</p>
          <p>
            Entraste como <b>{session.user.email}</b>. Pídele al administrador que te agregue al Cruce.
          </p>
          <button onClick={() => supabase.auth.signOut()} className="text-[#1976d2] underline">
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {/* Usuario conectado + salir (esquina inferior derecha, no tapa el header). */}
      <div className="fixed right-3 bottom-3 z-50 flex items-center gap-2 rounded-full border border-linea bg-white/95 px-3 py-1.5 text-xs text-text-secondary shadow-md">
        <span className="max-w-[180px] truncate">{session.user.email}</span>
        <span className="uppercase text-[10px] text-slate-500">{rol}</span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-1 text-[#1976d2] hover:text-[#0d47a1]"
          title="Cerrar sesión"
        >
          <LogOut className="w-3.5 h-3.5" />
          Salir
        </button>
      </div>
    </>
  );
};

/**
 * AuthGate — exige iniciar sesión antes de mostrar la app.
 *
 * Usa el mismo inicio de sesión del Informe de Rentabilidad Centralizado
 * (Supabase Auth, correo + contraseña). Además, el correo debe estar registrado
 * en `cruce_accesos` (rol admin, editor o lector); si no, se muestra un aviso.
 *
 * Los usuarios nuevos los crea un administrador en el panel "Usuarios": la
 * persona recibe un enlace de un solo uso (?token_hash=…&type=invite|recovery)
 * y al abrirlo escribe ella misma su contraseña en la pantalla CrearClave.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Logo } from './Logo';
import { URL_RENTABILIDAD } from '../config';

/** Rol del usuario en el Cruce, para que la app muestre opciones de administrador. */
const RolContext = createContext<string | null>(null);
export const useRol = () => useContext(RolContext);

// Enlace de invitación o de cambio de contraseña (se lee una sola vez al cargar).
const PARAMS = new URLSearchParams(window.location.search);
const ENLACE =
  PARAMS.get('token_hash') && ['invite', 'recovery'].includes(PARAMS.get('type') ?? '')
    ? { token_hash: PARAMS.get('token_hash')!, type: PARAMS.get('type') as 'invite' | 'recovery' }
    : null;
if (ENLACE) window.history.replaceState(null, '', window.location.pathname);

const Tarjeta: React.FC<{ children: React.ReactNode; onSubmit?: (e: React.FormEvent) => void }> = ({ children, onSubmit }) => (
  <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4">
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-4 rounded border border-linea bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      style={{ borderTop: '4px solid #1976d2' }}
    >
      {children}
    </form>
  </div>
);

/** El usuario abre el enlace del administrador y escribe su propia contraseña. */
const CrearClave: React.FC<{ email: string; nueva: boolean; onListo: () => void }> = ({ email, nueva, onListo }) => {
  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clave.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (clave !== repetir) return setError('Las dos contraseñas no coinciden.');
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password: clave });
    setEnviando(false);
    if (error) return setError(`No se pudo guardar la contraseña: ${error.message}`);
    onListo();
  };

  const campo = 'mt-1 h-9 w-full rounded-sm border border-linea bg-white px-2.5 text-text-main outline-none focus:border-[#1976d2]';
  return (
    <Tarjeta onSubmit={guardar}>
      <div className="flex items-center gap-2 text-text-main">
        <Logo size={36} className="shrink-0" />
        <h1 className="text-lg font-medium text-tinta">{nueva ? 'Crea tu contraseña' : 'Cambia tu contraseña'}</h1>
      </div>
      <p className="text-sm text-text-secondary">
        Cuenta: <b className="text-text-main">{email}</b>. Con este correo y la contraseña que escribas entrarás al
        Cruce de Inventarios.
      </p>
      <label className="block text-xs text-text-secondary">
        Contraseña nueva (mínimo 8 caracteres)
        <input type="password" required autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} className={campo} />
      </label>
      <label className="block text-xs text-text-secondary">
        Repite la contraseña
        <input type="password" required autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} className={campo} />
      </label>
      {error && <p className="text-sm text-[#d32f2f]">{error}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-sm bg-[#1976d2] font-medium text-white hover:bg-[#1565c0] disabled:opacity-60"
      >
        {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
        Guardar y entrar
      </button>
    </Tarjeta>
  );
};

const Login: React.FC<{ aviso?: string | null }> = ({ aviso }) => {
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
        <div className="flex items-center gap-3 text-text-main">
          <Logo size={44} className="shrink-0" />
          <h1 className="text-lg font-medium leading-tight text-tinta">Cruce de Inventarios y Cobros</h1>
        </div>
        <p className="text-sm text-text-secondary">
          Entra con el mismo correo y contraseña del Informe de Rentabilidad.
        </p>
        {aviso && <p className="rounded-sm bg-[#fdecea] px-3 py-2 text-sm text-[#b71c1c]">{aviso}</p>}
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
          ¿No tienes cuenta u olvidaste la contraseña? Pídele al administrador del Cruce un enlace para
          crearla o cambiarla (también puedes cambiarla en el{' '}
          <a
            href={URL_RENTABILIDAD}
            target="_blank"
            rel="noreferrer"
            className="text-[#1976d2] underline"
          >
            Informe de Rentabilidad
          </a>
          ). Solo los correos autorizados pueden entrar.
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
  // Abrió un enlace de invitación/cambio de contraseña: falta escribir la clave.
  const [pidiendoClave, setPidiendoClave] = useState<'invite' | 'recovery' | null>(null);
  const [avisoEnlace, setAvisoEnlace] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (ENLACE) {
        const { data, error } = await supabase.auth.verifyOtp(ENLACE);
        if (error || !data.session) {
          setAvisoEnlace('El enlace ya se usó o venció. Pídele al administrador uno nuevo.');
        } else {
          setPidiendoClave(ENLACE.type);
        }
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setListo(true);
    })();
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
  if (!session) return <Login aviso={avisoEnlace} />;
  if (pidiendoClave) {
    return <CrearClave email={session.user.email ?? ''} nueva={pidiendoClave === 'invite'} onListo={() => setPidiendoClave(null)} />;
  }
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
    <RolContext.Provider value={rol}>
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
    </RolContext.Provider>
  );
};

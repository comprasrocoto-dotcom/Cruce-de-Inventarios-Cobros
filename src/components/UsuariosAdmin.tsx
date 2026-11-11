/**
 * Panel administrativo de usuarios (solo rol admin).
 *
 * Crea usuarios, cambia su rol, les quita el acceso y genera enlaces de un solo
 * uso para crear o cambiar la contraseña. Todo pasa por la función segura
 * `cruce-usuarios` de Supabase: la página nunca ve ni guarda contraseñas, la
 * persona escribe la suya al abrir el enlace.
 */
import React, { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, MessageCircle, Trash2, UserPlus, Users, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Usuario {
  email: string;
  rol: string;
  creado: string;
  tiene_cuenta: boolean;
  activo: boolean;
  ultimo_ingreso: string | null;
}

const ROLES: { valor: string; texto: string; ayuda: string }[] = [
  { valor: 'lector', texto: 'Lector', ayuda: 'Solo consulta informes y novedades.' },
  { valor: 'editor', texto: 'Editor', ayuda: 'Además sube y borra inventarios.' },
  { valor: 'admin', texto: 'Administrador', ayuda: 'Todo, incluida la gestión de usuarios y tolerancias.' },
];

async function llamar<T = Record<string, unknown>>(body: Record<string, string>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('cruce-usuarios', { body });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        msg = ((await ctx.json()) as { error?: string }).error ?? msg;
      } catch {
        /* respuesta sin JSON */
      }
    }
    throw new Error(msg);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

const fecha = (s: string | null) =>
  s ? new Date(s).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** Caja con el enlace para entregar al usuario. */
const EnlaceListo: React.FC<{ email: string; enlace: string; onCerrar: () => void }> = ({ email, enlace, onCerrar }) => {
  const [copiado, setCopiado] = useState(false);
  const texto = `Hola. Este es tu enlace para crear tu contraseña del Cruce de Inventarios (cuenta ${email}). Sirve una sola vez y vence pronto: ${enlace}`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* el usuario puede seleccionar el texto a mano */
    }
  };
  return (
    <div className="rounded border border-[#a5d6a7] bg-[#e8f5e9] p-3 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[#1b5e20]">
          Listo. Envíale este enlace a <b>{email}</b>: al abrirlo escribe su propia contraseña. Sirve una sola vez y
          vence en aproximadamente una hora; si vence, genera otro con <KeyRound className="inline h-3.5 w-3.5" />.
        </p>
        <button onClick={onCerrar} className="text-[#1b5e20]/70 hover:text-[#1b5e20]" aria-label="Cerrar aviso">
          <X className="h-4 w-4" />
        </button>
      </div>
      <input readOnly value={enlace} onFocus={(e) => e.target.select()} className="mb-2 h-8 w-full rounded-sm border border-linea bg-white px-2 font-mono text-[11px]" />
      <div className="flex flex-wrap gap-2">
        <button onClick={copiar} className="flex h-8 items-center gap-1.5 rounded-sm bg-marca px-3 text-xs font-medium text-white hover:bg-marca-hover">
          {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copiado ? 'Copiado' : 'Copiar enlace'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
          target="_blank"
          rel="noreferrer"
          className="flex h-8 items-center gap-1.5 rounded-sm border border-[#2e7d32] bg-white px-3 text-xs font-medium text-[#2e7d32] hover:bg-[#e8f5e9]"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Enviar por WhatsApp
        </a>
      </div>
    </div>
  );
};

export const UsuariosAdmin: React.FC<{ onCerrar: () => void }> = ({ onCerrar }) => {
  const [miCorreo, setMiCorreo] = useState('');
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState('lector');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [enlace, setEnlace] = useState<{ email: string; enlace: string } | null>(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState<string | null>(null);

  const cargar = async () => {
    try {
      const r = await llamar<{ usuarios: Usuario[] }>({ accion: 'listar' });
      setUsuarios(r.usuarios ?? []);
    } catch (e) {
      setError((e as Error).message);
      setUsuarios([]);
    }
  };
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMiCorreo(data.session?.user.email ?? ''));
    cargar();
  }, []);

  const accion = async (clave: string, fn: () => Promise<void>) => {
    setOcupado(clave);
    setError(null);
    setAviso(null);
    try {
      await fn();
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(null);
    }
  };

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    const email = correo.trim().toLowerCase();
    accion('crear', async () => {
      const r = await llamar<{ enlace?: string; yaTeniaCuenta?: boolean }>({ accion: 'crear', email, rol });
      setCorreo('');
      if (r.enlace) setEnlace({ email, enlace: r.enlace });
      else {
        setEnlace(null);
        setAviso(`${email} ya tenía cuenta (la del Informe de Rentabilidad): ya puede entrar al Cruce con su contraseña de siempre.`);
      }
    });
  };

  const pedirEnlace = (email: string) =>
    accion('enlace:' + email, async () => {
      const r = await llamar<{ enlace: string }>({ accion: 'enlace', email });
      setEnlace({ email, enlace: r.enlace });
    });

  const cambiarRol = (email: string, nuevo: string) =>
    accion('rol:' + email, async () => {
      await llamar({ accion: 'cambiar_rol', email, rol: nuevo });
      setAviso(`Rol de ${email} actualizado. El cambio aplica la próxima vez que entre o recargue la página.`);
    });

  const quitar = (email: string) =>
    accion('quitar:' + email, async () => {
      await llamar({ accion: 'quitar', email });
      setConfirmarQuitar(null);
      setAviso(`${email} ya no tiene acceso al Cruce. Su cuenta y su acceso al Informe de Rentabilidad no cambian.`);
    });

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-10" onClick={onCerrar}>
      <div
        role="dialog"
        aria-label="Usuarios"
        className="w-full max-w-4xl rounded border border-linea bg-white shadow-xl"
        style={{ borderTop: '4px solid #1976d2' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-linea px-5 py-3">
          <h2 className="flex items-center gap-2 text-[17px] font-medium text-tinta">
            <Users className="h-5 w-5" /> Usuarios del Cruce de Inventarios
          </h2>
          <button onClick={onCerrar} className="text-text-secondary hover:text-text-main" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Crear usuario */}
          <form onSubmit={crear} className="flex flex-wrap items-end gap-3 rounded border border-linea bg-fondo p-3">
            <label className="min-w-[220px] flex-1 text-xs text-text-secondary">
              Correo del usuario nuevo
              <input
                type="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="nombre@empresa.com"
                className="mt-1 h-9 w-full rounded-sm border border-linea bg-white px-2.5 text-sm text-text-main"
              />
            </label>
            <label className="text-xs text-text-secondary">
              Rol
              <select value={rol} onChange={(e) => setRol(e.target.value)} className="mt-1 block h-9 rounded-sm border border-linea bg-white px-2 text-sm">
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.texto}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={ocupado === 'crear'}
              className="flex h-9 items-center gap-2 rounded-sm bg-marca px-4 text-sm font-medium text-white hover:bg-marca-hover disabled:opacity-60"
            >
              {ocupado === 'crear' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Crear usuario
            </button>
            <p className="w-full text-[11px] text-text-secondary">
              {ROLES.find((r) => r.valor === rol)?.ayuda} La cuenta es la misma del Informe de Rentabilidad: si el
              correo es nuevo, allá queda con permiso mínimo (sin marcas asignadas).
            </p>
          </form>

          {enlace && <EnlaceListo {...enlace} onCerrar={() => setEnlace(null)} />}
          {aviso && <p className="rounded-sm bg-marca-suave px-3 py-2 text-sm text-tinta-2">{aviso}</p>}
          {error && <p className="rounded-sm bg-[#fdecea] px-3 py-2 text-sm text-[#b71c1c]">{error}</p>}

          {/* Lista */}
          {usuarios === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-marca" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs">
                    <th className="px-3 py-2">Correo</th>
                    <th className="px-3 py-2">Rol</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Último ingreso</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const yo = u.email === miCorreo.toLowerCase();
                    return (
                      <tr key={u.email} className="border-b border-linea">
                        <td className="px-3 py-2">
                          {u.email}
                          {yo && <span className="ml-1 text-[11px] text-text-secondary">(tú)</span>}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={u.rol}
                            disabled={yo || ocupado === 'rol:' + u.email}
                            onChange={(e) => cambiarRol(u.email, e.target.value)}
                            className="h-8 rounded-sm border border-linea bg-white px-1.5 text-sm disabled:opacity-60"
                            aria-label={`Rol de ${u.email}`}
                          >
                            {ROLES.map((r) => (
                              <option key={r.valor} value={r.valor}>
                                {r.texto}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {u.activo ? (
                            <span className="rounded-full bg-[#e8f5e9] px-2 py-0.5 text-xs font-medium text-[#2e7d32]">Activo</span>
                          ) : (
                            <span className="rounded-full bg-[#fff3e0] px-2 py-0.5 text-xs font-medium text-[#a84300]">
                              {u.tiene_cuenta ? 'Falta crear contraseña' : 'Sin cuenta'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-text-secondary">{fecha(u.ultimo_ingreso)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => pedirEnlace(u.email)}
                              disabled={!!ocupado}
                              title={u.activo ? 'Enlace para cambiar la contraseña' : 'Enlace para crear la contraseña'}
                              className="flex h-8 items-center gap-1 rounded-sm border border-marca px-2 text-xs text-marca hover:bg-marca-suave disabled:opacity-50"
                            >
                              {ocupado === 'enlace:' + u.email ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                              Enlace
                            </button>
                            {!yo &&
                              (confirmarQuitar === u.email ? (
                                <>
                                  <button
                                    onClick={() => quitar(u.email)}
                                    disabled={!!ocupado}
                                    className="h-8 rounded-sm bg-[#d32f2f] px-2 text-xs font-medium text-white hover:bg-[#b71c1c] disabled:opacity-50"
                                  >
                                    Sí, quitar
                                  </button>
                                  <button onClick={() => setConfirmarQuitar(null)} className="h-8 px-1.5 text-xs text-text-secondary">
                                    No
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => setConfirmarQuitar(u.email)}
                                  title="Quitar acceso al Cruce"
                                  className="flex h-8 items-center rounded-sm border border-linea px-2 text-[#d32f2f] hover:bg-[#fdecea]"
                                  aria-label={`Quitar acceso a ${u.email}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

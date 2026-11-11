/**
 * cruce-usuarios — panel administrativo de usuarios del Cruce de Inventarios.
 *
 * Solo responde a un usuario con rol "admin" en cruce_accesos. Acciones:
 *  - listar:      usuarios del Cruce con su rol y si ya activaron la cuenta.
 *  - crear:       da acceso a un correo. Si no tiene cuenta, la crea (lo agrega a
 *                 la lista de accesos de Rentabilidad con rol "marca" y sin marcas,
 *                 que es lo que exige la base para crear cuentas) y devuelve un
 *                 enlace de un solo uso para que la persona ponga su contraseña.
 *  - enlace:      genera un enlace nuevo para crear o cambiar la contraseña.
 *  - cambiar_rol: admin / editor / lector.
 *  - quitar:      le quita el acceso al Cruce (la cuenta y Rentabilidad no se tocan).
 * Nunca recibe ni guarda contraseñas: la persona la escribe ella misma al abrir el enlace.
 */
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const APP_URL = 'https://cruce-de-inventarios-cobros.vercel.app';
const ROLES = ['admin', 'editor', 'lector'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function buscarUsuario(email: string) {
  const { data, error } = await admin.rpc('cruce_usuario_auth', { p_email: email });
  if (error) throw new Error(error.message);
  return (data as { id: string; activo: boolean }[] | null)?.[0] ?? null;
}

/** Enlace propio de la app (no depende de las URL permitidas en Supabase Auth). */
async function crearEnlace(email: string, existe: boolean) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: existe ? 'recovery' : 'invite',
    email,
  });
  if (error) throw new Error(error.message);
  const tipo = existe ? 'recovery' : 'invite';
  return `${APP_URL}/?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${tipo}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: quien } = await admin.auth.getUser(jwt);
    const miCorreo = quien?.user?.email?.toLowerCase();
    if (!miCorreo) return json({ error: 'Inicia sesión de nuevo.' }, 401);
    const { data: yo } = await admin.from('cruce_accesos').select('rol').eq('email', miCorreo).maybeSingle();
    if (yo?.rol !== 'admin') return json({ error: 'Solo un administrador puede gestionar usuarios.' }, 403);

    const body = await req.json().catch(() => ({}));
    const accion = String(body.accion ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const rol = String(body.rol ?? 'lector');
    if (accion !== 'listar' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Correo no válido.' }, 400);
    if ((accion === 'crear' || accion === 'cambiar_rol') && !ROLES.includes(rol)) return json({ error: 'Rol no válido.' }, 400);

    if (accion === 'listar') {
      const { data, error } = await admin.rpc('cruce_listar_usuarios');
      if (error) throw new Error(error.message);
      return json({ usuarios: data });
    }

    if (accion === 'crear') {
      // Requisito de la base para crear cuentas: estar en la lista de Rentabilidad.
      // Rol "marca" sin marcas = no ve nada allá. Si ya estaba, no se cambia.
      const { error: e1 } = await admin.from('accesos').upsert({ email, rol: 'marca' }, { onConflict: 'email', ignoreDuplicates: true });
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await admin.from('cruce_accesos').upsert({ email, rol }, { onConflict: 'email' });
      if (e2) throw new Error(e2.message);
      const u = await buscarUsuario(email);
      if (u?.activo) return json({ ok: true, yaTeniaCuenta: true });
      return json({ ok: true, enlace: await crearEnlace(email, !!u) });
    }

    if (accion === 'enlace') {
      const { data: acc } = await admin.from('cruce_accesos').select('email').eq('email', email).maybeSingle();
      if (!acc) return json({ error: 'Ese correo no tiene acceso al Cruce.' }, 404);
      const u = await buscarUsuario(email);
      if (!u) await admin.from('accesos').upsert({ email, rol: 'marca' }, { onConflict: 'email', ignoreDuplicates: true });
      return json({ ok: true, enlace: await crearEnlace(email, !!u) });
    }

    if (accion === 'cambiar_rol' || accion === 'quitar') {
      if (email === miCorreo) return json({ error: 'No puedes cambiar ni quitar tu propio acceso.' }, 400);
      const q = accion === 'quitar'
        ? admin.from('cruce_accesos').delete().eq('email', email)
        : admin.from('cruce_accesos').update({ rol }).eq('email', email);
      const { error } = await q;
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

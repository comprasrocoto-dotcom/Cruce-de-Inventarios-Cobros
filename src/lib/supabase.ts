/**
 * Cliente de Supabase (proyecto "informe-rentabilidad-centralizado").
 *
 * Es la misma base de datos y el mismo inicio de sesión del Informe de
 * Rentabilidad Centralizado: los usuarios entran con su correo y contraseña de
 * siempre, y la base (Row Level Security) solo les entrega las marcas que
 * tienen asignadas. La URL y la clave publicable son públicas por diseño: la
 * seguridad la pone la base, no la página.
 */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

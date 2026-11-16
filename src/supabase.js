import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configOk = Boolean(url && key);

export const supabase = configOk
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export async function loginConGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw error;
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function guardarPartida({ resultado, puntuacion, duracion, intentos }) {
  const { data, error } = await supabase
    .from('partidas')
    .insert({ resultado, puntuacion, duracion, intentos })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerHistorial() {
  const { data, error, count } = await supabase
    .from('partidas')
    .select('id, fecha, resultado, puntuacion, duracion, intentos', { count: 'exact' })
    .order('fecha', { ascending: false });
  if (error) throw error;
  return { partidas: data, total: count ?? data.length };
}

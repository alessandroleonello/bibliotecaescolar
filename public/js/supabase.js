/**
 * Supabase Modular Client Initialization (ES Modules via CDN)
 * Zero build tools required.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { getActiveSupabaseConfig } from './supabase-config.js';

const config = getActiveSupabaseConfig();

let supabase = null;
let isConfigured = false;

try {
  isConfigured = !config.anonKey.includes('DEMO-KEY') && config.url.startsWith('https://');
  if (isConfigured) {
    supabase = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
  }
} catch (err) {
  console.warn('Supabase initialization fallback:', err);
}

/**
 * Creates a secondary Supabase client (without session persistence)
 * Used by superadmin / school_admin to provision new accounts without losing their active login.
 */
export function getSecondarySupabase() {
  const cfg = getActiveSupabaseConfig();
  return createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/**
 * Keep-Alive Heartbeat:
 * Executado ao carregar para registrar atividade no banco de dados
 * e prevenir a pausa automática de 7 dias do plano gratuito do Supabase.
 */
export async function pingHeartbeat() {
  if (!isConfigured || !supabase) return;
  try {
    const { error } = await supabase
      .from('heartbeat')
      .update({ last_ping: new Date().toISOString() })
      .eq('id', 1);

    if (error) {
      // Se não existir linha id=1, tenta inserir
      await supabase.from('heartbeat').upsert({ id: 1, last_ping: new Date().toISOString() });
    }
    console.log('💓 Supabase Heartbeat: Ping de atividade registrado com sucesso.');
  } catch (e) {
    console.warn('Aviso de Heartbeat Supabase:', e.message);
  }
}

export const isSupabaseConfigured = () => isConfigured;
export { supabase, isConfigured };

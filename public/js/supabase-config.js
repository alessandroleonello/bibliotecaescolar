/**
 * Supabase Project Configuration
 * 
 * Substitua os valores abaixo pelas credenciais do seu projeto no Supabase:
 * Settings -> API -> Project URL & Project API Keys (anon public).
 */

export const supabaseConfig = {
  url: "https://bijrbjttgslqbqioiggo.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpanJianR0Z3NscWJxaW9pZ2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NDY4NjUsImV4cCI6MjEwNzMyMjg2NX0.5vcKM3i4HzpOcDcvI-2mcFXpoIN7ZUt3g3_-xFFx1tY"
};

/**
 * Permite carregar configuração salva dinamicamente pelo painel se houver
 */
export function getActiveSupabaseConfig() {
  const saved = localStorage.getItem('biblioteca_supabase_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn('Erro ao carregar config salva do Supabase:', e);
    }
  }
  return supabaseConfig;
}

/**
 * Salva credenciais customizadas no localStorage
 */
export function saveSupabaseConfig(cfg) {
  localStorage.setItem('biblioteca_supabase_config', JSON.stringify(cfg));
}

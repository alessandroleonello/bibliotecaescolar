/**
 * Authentication and User Profile Management via Supabase
 */
import { supabase, isConfigured, pingHeartbeat } from './supabase.js';

let currentUser = null;
let currentProfile = null;
let authListeners = [];

/**
 * Carrega o perfil do usuário na tabela public.profiles
 */
export async function loadUserProfile(userId) {
  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        return {
          uid: data.id,
          email: data.email,
          name: data.name,
          role: data.role,
          schoolId: data.school_id,
          schoolName: data.school_name,
          active: data.active
        };
      }
    } catch (err) {
      console.warn('Erro ao carregar perfil no Supabase:', err);
    }
  }

  return null;
}

/**
 * Inicializa o observador de autenticação
 */
export function initAuth(onChangeCallback) {
  if (onChangeCallback) authListeners.push(onChangeCallback);

  if (!isConfigured || !supabase) {
    notifyListeners();
    return;
  }

  // Ping heartbeat no início
  pingHeartbeat();

  // Observa mudanças de sessão no Supabase
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      currentProfile = await loadUserProfile(session.user.id);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    notifyListeners();
  });

  // Checa sessão atual
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (session?.user) {
      currentUser = session.user;
      currentProfile = await loadUserProfile(session.user.id);
      notifyListeners();
    }
  });
}

function notifyListeners() {
  authListeners.forEach(cb => {
    try {
      cb({ user: currentUser, profile: currentProfile });
    } catch (e) {
      console.error(e);
    }
  });
}

/**
 * Login com e-mail e senha institucional
 */
export async function login(email, password) {
  if (!isConfigured || !supabase) {
    throw new Error('Supabase não conectado. Verifique as configurações do projeto.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    throw new Error(error.message);
  }

  currentUser = data.user;
  currentProfile = await loadUserProfile(currentUser.id);

  if (currentProfile && !currentProfile.active) {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    throw new Error('Sua conta está desativada. Entre em contato com a administração da escola.');
  }

  // Dispara heartbeat para manter o banco ativo
  pingHeartbeat();

  notifyListeners();
  return { user: currentUser, profile: currentProfile };
}

/**
 * Logout
 */
export async function logout() {
  currentUser = null;
  currentProfile = null;
  if (isConfigured && supabase) {
    await supabase.auth.signOut();
  }
  notifyListeners();
}

/**
 * Recuperação de senha por e-mail
 */
export async function resetPassword(email) {
  if (!isConfigured || !supabase) {
    throw new Error('Supabase não configurado.');
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/public/index.html#/login`
  });
  if (error) throw new Error(error.message);
  return true;
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentProfile() {
  return currentProfile;
}

export function isAuthenticated() {
  return !!currentUser;
}

export function hasRole(role) {
  if (!currentProfile) return false;
  return currentProfile.role === role;
}

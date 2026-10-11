/**
 * Supabase Service: Schools, School Admins, Categories & Staff Management
 */
import { supabase, isConfigured, getSecondarySupabase, pingHeartbeat } from '../supabase.js';

const STORAGE_KEY = 'biblio_local_schools';
const STAFF_KEY = 'biblio_local_staff_';

export const DEFAULT_CATEGORIES = [
  'Literatura Brasileira',
  'Literatura Estrangeira',
  'Infantojuvenil',
  'Ficção Científica',
  'História & Geografia',
  'Ciências',
  'Poesia',
  'Didático',
  'Quadrinhos / HQ',
  'Outros'
];

function getLocalSchools() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveLocalSchools(schools) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schools));
}

/**
 * Lista todas as escolas
 */
export async function listSchools() {
  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('schools').select('*').order('name');
      if (data && !error && data.length > 0) return data;
    } catch (e) {
      console.warn('Fallback local schools:', e);
    }
  }
  return getLocalSchools();
}

/**
 * Busca escola por ID
 */
export async function getSchool(schoolId) {
  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase.from('schools').select('*').eq('id', schoolId).single();
      if (data && !error) return data;
    } catch (e) {
      console.warn(e);
    }
  }
  return getLocalSchools().find(s => s.id === schoolId) || null;
}

/**
 * Cadastra uma nova escola e cria a conta do gestor escolar no Supabase Auth
 */
export async function createSchool({ name, email, slug, phone = '' }) {
  const cleanSlug = (slug || name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const schoolId = 'esc-' + Date.now();
  const schoolData = {
    id: schoolId,
    name,
    email,
    slug: cleanSlug,
    phone,
    status: 'active',
    settings: {
      loanDays: 14,
      maxLoansPerStudent: 2,
      renewalsAllowed: 1,
      blockIfOverdue: true,
      publicCatalogEnabled: true,
      grades: ['6º ano', '7º ano', '8º ano', '9º ano', '1º EM', '2º EM', '3º EM'],
      requestHoldHours: 48,
      categories: [...DEFAULT_CATEGORIES]
    }
  };

  if (isConfigured && supabase) {
    try {
      // 1. Grava a escola
      await supabase.from('schools').insert(schoolData);

      // 2. Cria conta de acesso do gestor via cliente secundário (sem deslogar superadmin)
      const secClient = getSecondarySupabase();
      const tempPassword = 'Escola#' + Math.random().toString(36).substring(2, 10);
      const { data: authData, error: authErr } = await secClient.auth.signUp({
        email,
        password: tempPassword
      });

      if (authData?.user) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          email,
          name: `Gestor (${name})`,
          role: 'school_admin',
          school_id: schoolId,
          school_name: name,
          active: true
        });

        // 3. Envia e-mail de redefinição para que a escola defina sua senha própria
        await secClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/public/index.html#/login`
        });
      }

      pingHeartbeat();
    } catch (err) {
      console.warn('Aviso de criação no Supabase:', err.message);
    }
  }

  const locals = getLocalSchools();
  locals.unshift({ ...schoolData, created_at: new Date().toISOString() });
  saveLocalSchools(locals);

  return schoolData;
}

/**
 * Ativa ou desativa uma escola
 */
export async function toggleSchoolStatus(schoolId, newStatus) {
  if (isConfigured && supabase) {
    try {
      await supabase.from('schools').update({ status: newStatus }).eq('id', schoolId);
      pingHeartbeat();
    } catch (e) {
      console.warn(e);
    }
  }

  const locals = getLocalSchools();
  const found = locals.find(s => s.id === schoolId);
  if (found) {
    found.status = newStatus;
    saveLocalSchools(locals);
  }
  return true;
}

/**
 * Reenvia o e-mail de convite
 */
export async function resendSchoolInvite(email) {
  if (isConfigured && supabase) {
    try {
      const sec = getSecondarySupabase();
      await sec.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/public/index.html#/login`
      });
      return true;
    } catch (e) {
      console.warn(e);
    }
  }
  return true;
}

/**
 * Atualiza configurações da escola
 */
export async function updateSchoolSettings(schoolId, settings) {
  if (isConfigured && supabase) {
    try {
      await supabase.from('schools').update({ settings }).eq('id', schoolId);
      pingHeartbeat();
    } catch (e) {
      console.warn(e);
    }
  }

  const locals = getLocalSchools();
  const found = locals.find(s => s.id === schoolId);
  if (found) {
    found.settings = { ...found.settings, ...settings };
    saveLocalSchools(locals);
  }
  return true;
}

/**
 * CATEGORIES MANAGEMENT (CRUD)
 */
export async function listCategories(schoolId) {
  const school = await getSchool(schoolId);
  const categories = school?.settings?.categories;
  if (Array.isArray(categories) && categories.length > 0) {
    return categories;
  }
  return [...DEFAULT_CATEGORIES];
}

export async function addCategory(schoolId, categoryName) {
  const clean = categoryName.trim();
  if (!clean) throw new Error('O nome da categoria não pode ser vazio.');

  const current = await listCategories(schoolId);
  if (current.some(c => c.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`A categoria "${clean}" já existe.`);
  }

  const updated = [...current, clean];
  const school = await getSchool(schoolId);
  const newSettings = { ...(school?.settings || {}), categories: updated };
  await updateSchoolSettings(schoolId, newSettings);
  return updated;
}

export async function updateCategory(schoolId, oldName, newName) {
  const cleanNew = newName.trim();
  if (!cleanNew) throw new Error('O novo nome não pode ser vazio.');

  const current = await listCategories(schoolId);
  const idx = current.findIndex(c => c.toLowerCase() === oldName.trim().toLowerCase());
  if (idx === -1) throw new Error('Categoria original não encontrada.');

  current[idx] = cleanNew;
  const school = await getSchool(schoolId);
  const newSettings = { ...(school?.settings || {}), categories: current };
  await updateSchoolSettings(schoolId, newSettings);

  if (isConfigured && supabase) {
    try {
      await supabase.from('books').update({ category: cleanNew }).eq('school_id', schoolId).eq('category', oldName);
    } catch (e) {
      console.warn(e);
    }
  }

  try {
    const rawBooks = localStorage.getItem('biblio_local_books_' + schoolId);
    if (rawBooks) {
      const books = JSON.parse(rawBooks);
      books.forEach(b => {
        if (b.category === oldName) b.category = cleanNew;
      });
      localStorage.setItem('biblio_local_books_' + schoolId, JSON.stringify(books));
    }
  } catch (e) {
    console.warn(e);
  }

  return current;
}

export async function deleteCategory(schoolId, categoryName) {
  const current = await listCategories(schoolId);
  const filtered = current.filter(c => c.toLowerCase() !== categoryName.trim().toLowerCase());
  if (filtered.length === current.length) return current;

  const school = await getSchool(schoolId);
  const newSettings = { ...(school?.settings || {}), categories: filtered };
  await updateSchoolSettings(schoolId, newSettings);

  if (isConfigured && supabase) {
    try {
      await supabase.from('books').update({ category: 'Outros' }).eq('school_id', schoolId).eq('category', categoryName);
    } catch (e) {
      console.warn(e);
    }
  }

  try {
    const rawBooks = localStorage.getItem('biblio_local_books_' + schoolId);
    if (rawBooks) {
      const books = JSON.parse(rawBooks);
      books.forEach(b => {
        if (b.category === categoryName) b.category = 'Outros';
      });
      localStorage.setItem('biblio_local_books_' + schoolId, JSON.stringify(books));
    }
  } catch (e) {
    console.warn(e);
  }

  return filtered;
}

/**
 * STAFF MANAGEMENT (Funcionários e Bibliotecários da Escola)
 */
function getLocalStaff(schoolId) {
  const data = localStorage.getItem(STAFF_KEY + schoolId);
  return data ? JSON.parse(data) : [];
}

function saveLocalStaff(schoolId, list) {
  localStorage.setItem(STAFF_KEY + schoolId, JSON.stringify(list));
}

export async function listStaff(schoolId) {
  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('school_id', schoolId)
        .eq('role', 'staff')
        .order('name');

      if (data && !error && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          name: d.name,
          email: d.email,
          jobTitle: d.job_title || 'Bibliotecário',
          role: d.role,
          active: d.active,
          schoolId: d.school_id
        }));
      }
    } catch (e) {
      console.warn('Fallback local staff:', e.message);
    }
  }
  return getLocalStaff(schoolId);
}

export async function createStaff(schoolId, { name, email, jobTitle = 'Bibliotecário' }) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  if (!cleanEmail || !cleanName) throw new Error('Nome e e-mail são obrigatórios.');

  const staffList = await listStaff(schoolId);
  if (staffList.some(s => s.email.toLowerCase() === cleanEmail)) {
    throw new Error(`O e-mail "${cleanEmail}" já está cadastrado para um funcionário desta escola.`);
  }

  const staffId = 'staff-' + Date.now();
  const staffObj = {
    id: staffId,
    name: cleanName,
    email: cleanEmail,
    jobTitle: jobTitle.trim() || 'Bibliotecário',
    role: 'staff',
    schoolId,
    active: true,
    created_at: new Date().toISOString()
  };

  if (isConfigured && supabase) {
    try {
      const secClient = getSecondarySupabase();
      const tempPass = 'Staff#' + Math.random().toString(36).substring(2, 10);
      const { data: authData, error: authErr } = await secClient.auth.signUp({
        email: cleanEmail,
        password: tempPass
      });

      if (authData?.user) {
        staffObj.id = authData.user.id;
        await supabase.from('profiles').insert({
          id: authData.user.id,
          email: cleanEmail,
          name: cleanName,
          job_title: staffObj.jobTitle,
          role: 'staff',
          school_id: schoolId,
          active: true
        });

        await secClient.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: `${window.location.origin}/public/index.html#/login`
        });
      }
      pingHeartbeat();
    } catch (authErr) {
      console.warn('Aviso ao criar funcionário no Supabase:', authErr.message);
    }
  }

  const locals = getLocalStaff(schoolId);
  locals.unshift(staffObj);
  saveLocalStaff(schoolId, locals);

  return staffObj;
}

export async function toggleStaffStatus(schoolId, staffId, newStatus) {
  if (isConfigured && supabase) {
    try {
      await supabase.from('profiles').update({ active: newStatus }).eq('id', staffId);
      pingHeartbeat();
    } catch (e) {
      console.warn(e);
    }
  }

  const locals = getLocalStaff(schoolId);
  const found = locals.find(s => s.id === staffId);
  if (found) {
    found.active = newStatus;
    saveLocalStaff(schoolId, locals);
  }
  return true;
}

export async function resendStaffInvite(email) {
  if (isConfigured && supabase) {
    try {
      const sec = getSecondarySupabase();
      await sec.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/public/index.html#/login`
      });
      return true;
    } catch (e) {
      console.warn(e);
    }
  }
  return true;
}

export async function deleteStaff(schoolId, staffId) {
  if (isConfigured && supabase) {
    try {
      await supabase.from('profiles').delete().eq('id', staffId);
      pingHeartbeat();
    } catch (e) {
      console.warn(e);
    }
  }
  const locals = getLocalStaff(schoolId);
  const filtered = locals.filter(s => s.id !== staffId);
  saveLocalStaff(schoolId, filtered);
  return true;
}

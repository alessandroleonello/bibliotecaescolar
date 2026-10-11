/**
 * Supabase Service: Copies Management (Tombos & Exemplares)
 */
import { supabase, isConfigured, pingHeartbeat } from '../supabase.js';
import { getBook, saveBook } from './books.js';

const STORAGE_KEY = 'biblio_local_copies_';

function getLocalCopies(schoolId) {
  const data = localStorage.getItem(STORAGE_KEY + schoolId);
  if (data) return JSON.parse(data);
  const initial = [
    { id: 'cop-101', bookId: 'livro-001', code: 'TMB-00101', status: 'available', condition: 'Bom', notes: '' },
    { id: 'cop-102', bookId: 'livro-001', code: 'TMB-00102', status: 'available', condition: 'Excelente', notes: '' },
    { id: 'cop-103', bookId: 'livro-001', code: 'TMB-00103', status: 'available', condition: 'Bom', notes: '' },
    { id: 'cop-104', bookId: 'livro-001', code: 'TMB-00104', status: 'loaned', condition: 'Bom', notes: '' },
    { id: 'cop-201', bookId: 'livro-002', code: 'TMB-00201', status: 'available', condition: 'Novo', notes: '' },
    { id: 'cop-202', bookId: 'livro-002', code: 'TMB-00202', status: 'available', condition: 'Novo', notes: '' },
    { id: 'cop-203', bookId: 'livro-002', code: 'TMB-00203', status: 'available', condition: 'Excelente', notes: '' },
    { id: 'cop-204', bookId: 'livro-002', code: 'TMB-00204', status: 'available', condition: 'Bom', notes: '' },
    { id: 'cop-205', bookId: 'livro-002', code: 'TMB-00205', status: 'loaned', condition: 'Bom', notes: '' }
  ];
  localStorage.setItem(STORAGE_KEY + schoolId, JSON.stringify(initial));
  return initial;
}

function saveLocalCopies(schoolId, copies) {
  localStorage.setItem(STORAGE_KEY + schoolId, JSON.stringify(copies));
}

function mapFromDb(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    schoolId: row.school_id,
    code: row.code,
    status: row.status,
    condition: row.condition,
    notes: row.notes,
    createdAt: row.created_at
  };
}

/**
 * Lists copies of a book, or all copies of the school
 */
export async function listCopies(schoolId, bookId = null) {
  let copies = [];
  if (isConfigured && supabase) {
    try {
      let q = supabase.from('copies').select('*').eq('school_id', schoolId);
      if (bookId) q = q.eq('book_id', bookId);
      const { data, error } = await q.order('code');
      if (data && !error && data.length > 0) {
        copies = data.map(mapFromDb);
      }
    } catch (e) {
      console.warn('Fallback local copies:', e.message);
    }
  }

  if (copies.length === 0) {
    copies = getLocalCopies(schoolId);
    if (bookId) {
      return copies.filter(c => c.bookId === bookId);
    }
  }

  return copies;
}

/**
 * Adds copies manually with custom codes/tombos defined by the school
 */
export async function addManualCopies(schoolId, bookId, copiesData) {
  const allCopies = await listCopies(schoolId);
  const existingCodes = new Set(allCopies.map(c => c.code.trim().toUpperCase()));
  const newCopies = [];

  for (let i = 0; i < copiesData.length; i++) {
    const item = copiesData[i];
    const cleanCode = String(item.code || '').trim().toUpperCase();
    if (!cleanCode) continue;

    if (existingCodes.has(cleanCode)) {
      throw new Error(`O código/tombo "${cleanCode}" já está cadastrado nesta escola.`);
    }
    existingCodes.add(cleanCode);

    const copyObj = {
      id: 'cop-' + Date.now() + '-' + i,
      bookId,
      code: cleanCode,
      status: item.status || 'available',
      condition: item.condition || 'Bom',
      notes: item.notes || '',
      createdAt: new Date().toISOString()
    };
    newCopies.push(copyObj);
  }

  if (newCopies.length === 0) return [];

  if (isConfigured && supabase) {
    try {
      const dbRows = newCopies.map(c => ({
        id: c.id,
        school_id: schoolId,
        book_id: bookId,
        code: c.code,
        status: c.status,
        condition: c.condition,
        notes: c.notes
      }));
      await supabase.from('copies').insert(dbRows);
      pingHeartbeat();
    } catch (e) {
      console.warn('Erro ao salvar cópias manuais no Supabase:', e.message);
    }
  }

  // Local fallback
  const locals = getLocalCopies(schoolId);
  locals.push(...newCopies);
  saveLocalCopies(schoolId, locals);

  // Update book total and available copies
  const book = await getBook(schoolId, bookId);
  if (book) {
    const updatedCopies = locals.filter(c => c.bookId === bookId);
    const available = updatedCopies.filter(c => c.status === 'available').length;
    await saveBook(schoolId, {
      ...book,
      totalCopies: updatedCopies.length,
      availableCopies: available
    }, bookId);
  }

  return newCopies;
}

/**
 * Generates N sequential copies for a book
 */
export async function generateCopies(schoolId, bookId, quantity, options = {}) {
  const prefix = options.prefix || 'TMB-';
  const startNumber = Number(options.startNumber || 100);
  const condition = options.condition || 'Bom';

  const allCopies = await listCopies(schoolId);
  const newCopies = [];
  
  let currentNum = startNumber;
  const existingCodes = new Set(allCopies.map(c => c.code.toUpperCase()));

  for (let i = 0; i < quantity; i++) {
    let candidateCode = `${prefix}${String(currentNum).padStart(5, '0')}`;
    while (existingCodes.has(candidateCode)) {
      currentNum++;
      candidateCode = `${prefix}${String(currentNum).padStart(5, '0')}`;
    }
    existingCodes.add(candidateCode);

    const copyObj = {
      id: 'cop-' + Date.now() + '-' + i,
      bookId,
      code: candidateCode,
      status: 'available',
      condition,
      notes: options.notes || '',
      createdAt: new Date().toISOString()
    };
    newCopies.push(copyObj);
    currentNum++;
  }

  if (isConfigured && supabase) {
    try {
      const dbRows = newCopies.map(c => ({
        id: c.id,
        school_id: schoolId,
        book_id: bookId,
        code: c.code,
        status: c.status,
        condition: c.condition,
        notes: c.notes
      }));
      await supabase.from('copies').insert(dbRows);
      pingHeartbeat();
    } catch (e) {
      console.warn('Erro ao salvar cópias no Supabase:', e.message);
    }
  }

  // Local fallback
  const locals = getLocalCopies(schoolId);
  locals.push(...newCopies);
  saveLocalCopies(schoolId, locals);

  // Update book total and available copies
  const book = await getBook(schoolId, bookId);
  if (book) {
    const updatedCopies = locals.filter(c => c.bookId === bookId);
    const available = updatedCopies.filter(c => c.status === 'available').length;
    await saveBook(schoolId, {
      ...book,
      totalCopies: updatedCopies.length,
      availableCopies: available
    }, bookId);
  }

  return newCopies;
}

/**
 * Updates copy details
 */
export async function updateCopy(schoolId, copyId, { code, status, condition, notes }) {
  const locals = getLocalCopies(schoolId);
  const found = locals.find(c => c.id === copyId);
  if (!found) throw new Error('Exemplar não encontrado.');

  if (code && code.trim().toUpperCase() !== found.code.toUpperCase()) {
    const cleanCode = code.trim().toUpperCase();
    const duplicate = locals.find(c => c.id !== copyId && c.code.toUpperCase() === cleanCode);
    if (duplicate) {
      throw new Error(`O tombo "${cleanCode}" já pertence a outro exemplar.`);
    }
    found.code = cleanCode;
  }

  if (status) found.status = status;
  if (condition) found.condition = condition;
  if (notes !== undefined) found.notes = notes;

  if (isConfigured && supabase) {
    try {
      await supabase.from('copies').update({
        code: found.code,
        status: found.status,
        condition: found.condition,
        notes: found.notes
      }).eq('id', copyId);
      pingHeartbeat();
    } catch (e) {
      console.warn(e);
    }
  }

  saveLocalCopies(schoolId, locals);

  // Refresh book counts
  const book = await getBook(schoolId, found.bookId);
  if (book) {
    const bookCopies = locals.filter(c => c.bookId === found.bookId);
    const available = bookCopies.filter(c => c.status === 'available').length;
    await saveBook(schoolId, {
      ...book,
      availableCopies: available
    }, found.bookId);
  }

  return found;
}

export async function updateCopyStatus(schoolId, copyId, newStatus, condition = null) {
  return updateCopy(schoolId, copyId, { status: newStatus, condition });
}

export async function deleteCopy(schoolId, copyId) {
  const locals = getLocalCopies(schoolId);
  const found = locals.find(c => c.id === copyId);
  if (!found) return true;
  if (found.status === 'loaned') {
    throw new Error('Não é possível excluir um exemplar atualmente emprestado.');
  }

  const bookId = found.bookId;
  const filtered = locals.filter(c => c.id !== copyId);
  saveLocalCopies(schoolId, filtered);

  if (isConfigured && supabase) {
    try {
      await supabase.from('copies').delete().eq('id', copyId);
      pingHeartbeat();
    } catch (e) {
      console.warn(e);
    }
  }

  // Refresh book counts
  const book = await getBook(schoolId, bookId);
  if (book) {
    const bookCopies = filtered.filter(c => c.bookId === bookId);
    const available = bookCopies.filter(c => c.status === 'available').length;
    await saveBook(schoolId, {
      ...book,
      totalCopies: bookCopies.length,
      availableCopies: available
    }, bookId);
  }

  return true;
}

export async function findCopyByCode(schoolId, code) {
  const allCopies = await listCopies(schoolId);
  const clean = code.trim().toUpperCase();
  return allCopies.find(c => c.code.toUpperCase() === clean) || null;
}

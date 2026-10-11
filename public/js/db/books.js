/**
 * Supabase Service: Books Management & Public Catalog Mirror
 */
import { supabase, isConfigured, pingHeartbeat } from '../supabase.js';
import { normalizeText } from '../utils/search.js';

const STORAGE_KEY = 'biblio_local_books_';

function getLocalBooks(schoolId) {
  const data = localStorage.getItem(STORAGE_KEY + schoolId);
  return data ? JSON.parse(data) : [];
}

function saveLocalBooks(schoolId, books) {
  localStorage.setItem(STORAGE_KEY + schoolId, JSON.stringify(books));
}

function mapFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    schoolId: row.school_id,
    title: row.title,
    authors: row.authors || [],
    publisher: row.publisher,
    isbn: row.isbn,
    category: row.category,
    year: row.year,
    edition: row.edition,
    synopsis: row.synopsis,
    coverUrl: row.cover_url,
    shelfLocation: row.shelf_location,
    totalCopies: row.total_copies || 0,
    availableCopies: row.available_copies || 0,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapToDb(schoolId, b) {
  return {
    id: b.id,
    school_id: schoolId,
    title: b.title,
    authors: Array.isArray(b.authors) ? b.authors : [b.authors || ''],
    publisher: b.publisher || '',
    isbn: b.isbn || '',
    category: b.category || 'Geral',
    year: b.year || null,
    edition: b.edition || '',
    synopsis: b.synopsis || '',
    cover_url: b.coverUrl || '',
    shelf_location: b.shelfLocation || '',
    total_copies: b.totalCopies !== undefined ? b.totalCopies : 0,
    available_copies: b.availableCopies !== undefined ? b.availableCopies : 0,
    active: b.active !== false
  };
}

/**
 * Lists books for a school with optional filter
 */
export async function listBooks(schoolId, filterText = '') {
  let books = [];
  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('school_id', schoolId)
        .order('title');

      if (data && !error && data.length > 0) {
        books = data.map(mapFromDb);
      }
    } catch (err) {
      console.warn('Usando armazenamento local de livros:', err.message);
    }
  }

  if (books.length === 0) {
    books = getLocalBooks(schoolId);
  }

  if (!filterText) return books;

  const norm = normalizeText(filterText);

  // Permite buscar também pelo código/tombo de qualquer exemplar da escola
  let matchingBookIdsByCopy = new Set();
  try {
    const rawCopies = localStorage.getItem('biblio_local_copies_' + schoolId);
    if (rawCopies) {
      const copies = JSON.parse(rawCopies);
      copies.filter(c => normalizeText(c.code).includes(norm)).forEach(c => matchingBookIdsByCopy.add(c.bookId));
    }
  } catch (e) {
    // ignorar
  }

  return books.filter(b => {
    return matchingBookIdsByCopy.has(b.id) ||
      normalizeText(b.title).includes(norm) ||
      (b.authors && b.authors.some(a => normalizeText(a).includes(norm))) ||
      (b.isbn && b.isbn.includes(norm)) ||
      (b.category && normalizeText(b.category).includes(norm));
  });
}

/**
 * Gets a book by ID
 */
export async function getBook(schoolId, bookId) {
  if (isConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();
      if (data && !error) return mapFromDb(data);
    } catch (e) {
      console.warn(e);
    }
  }
  return getLocalBooks(schoolId).find(b => b.id === bookId) || null;
}

/**
 * Saves (create or update) a book
 */
export async function saveBook(schoolId, bookData, bookId = null) {
  const isNew = !bookId;
  const id = bookId || 'livro-' + Date.now();

  const payload = {
    ...bookData,
    id,
    authors: Array.isArray(bookData.authors) ? bookData.authors : [bookData.authors || ''],
    active: bookData.active !== false,
    updatedAt: new Date().toISOString()
  };

  if (isNew) {
    payload.createdAt = new Date().toISOString();
    payload.totalCopies = Number(bookData.totalCopies || 0);
    payload.availableCopies = Number(bookData.totalCopies || 0);
  }

  if (isConfigured && supabase) {
    try {
      const dbPayload = mapToDb(schoolId, payload);
      await supabase.from('books').upsert(dbPayload);
      pingHeartbeat();
    } catch (err) {
      console.warn('Erro ao salvar no Supabase (usando fallback local):', err.message);
    }
  }

  // Local fallback
  const locals = getLocalBooks(schoolId);
  const existingIdx = locals.findIndex(b => b.id === id);
  if (existingIdx >= 0) {
    locals[existingIdx] = { ...locals[existingIdx], ...payload };
  } else {
    locals.unshift({ id, ...payload });
  }
  saveLocalBooks(schoolId, locals);

  return { id, ...payload };
}

/**
 * Fetches book details from Google Books API by ISBN
 */
export async function fetchBookByISBN(isbn) {
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
  if (!cleanIsbn) throw new Error('ISBN inválido');

  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
  if (!res.ok) throw new Error('Livro não encontrado');
  const data = await res.json();

  if (!data.items || data.items.length === 0) {
    throw new Error('Nenhum resultado encontrado para este ISBN.');
  }

  const vol = data.items[0].volumeInfo;
  return {
    title: vol.title || '',
    authors: vol.authors || [''],
    publisher: vol.publisher || '',
    year: vol.publishedDate ? parseInt(vol.publishedDate.substring(0, 4)) : '',
    synopsis: vol.description || '',
    category: vol.categories ? vol.categories[0] : 'Literatura Geral',
    isbn: cleanIsbn,
    coverUrl: vol.imageLinks?.thumbnail?.replace('http://', 'https://') || ''
  };
}

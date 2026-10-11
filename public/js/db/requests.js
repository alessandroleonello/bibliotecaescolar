/**
 * Supabase Service: Public Loan Requests Queue & Approvals
 */
import { supabase, isConfigured } from '../supabase.js';
import { createLoan } from './loans.js';
import { addDays } from '../utils/dates.js';

const STORAGE_KEY = 'biblio_local_requests_';

function fromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    schoolId: row.school_id,
    bookId: row.book_id,
    bookTitle: row.book_title,
    studentName: row.student_name,
    grade: row.grade,
    studentRa: row.student_ra,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    handledBy: row.handled_by,
    handledAt: row.handled_at,
    rejectionReason: row.rejection_reason
  };
}

function getLocalRequests(schoolId) {
  const data = localStorage.getItem(STORAGE_KEY + schoolId);
  return data ? JSON.parse(data) : [];
}

function saveLocalRequests(schoolId, requests) {
  localStorage.setItem(STORAGE_KEY + schoolId, JSON.stringify(requests));
}

/**
 * Lists requests of a school
 */
export async function listRequests(schoolId, status = 'pending') {
  let list = [];

  if (isConfigured && supabase) {
    try {
      let query = supabase
        .from('loan_requests')
        .select('*')
        .eq('school_id', schoolId);

      if (status) {
        query = query.eq('status', status);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        list = data.map(fromDb);
      }
    } catch (e) {
      console.warn('Fallback local requests:', e.message);
    }
  }

  if (list.length === 0) {
    list = getLocalRequests(schoolId);
    if (status) {
      list = list.filter(r => r.status === status);
    }
  }

  // Filter out or mark expired
  const now = new Date();
  list.forEach(r => {
    if (r.status === 'pending' && new Date(r.expiresAt) < now) {
      r.status = 'expired';
    }
  });

  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Submits a public loan request (from catalogo.html)
 */
export async function submitPublicRequest(schoolId, { bookId, bookTitle, studentName, grade, studentRa = '' }) {
  const now = new Date();
  const expiresAt = addDays(now, 2); // 48h hold
  const requestId = 'req-' + Date.now();

  const reqObj = {
    id: requestId,
    schoolId,
    bookId,
    bookTitle,
    studentName: studentName.trim(),
    grade,
    studentRa: studentRa.trim(),
    status: 'pending',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };

  if (isConfigured && supabase) {
    try {
      const { error } = await supabase.from('loan_requests').insert({
        id: requestId,
        school_id: schoolId,
        book_id: bookId,
        book_title: bookTitle,
        student_name: studentName.trim(),
        grade,
        student_ra: studentRa.trim(),
        status: 'pending',
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      });
      if (error) throw error;
    } catch (e) {
      console.warn('Erro ao salvar request no Supabase:', e.message);
    }
  }

  const locals = getLocalRequests(schoolId);
  locals.unshift(reqObj);
  saveLocalRequests(schoolId, locals);

  return reqObj;
}

/**
 * Approves a request and turns it into an active loan
 */
export async function approveRequest(schoolId, requestId, { copyId, studentId, staffName }) {
  const all = await listRequests(schoolId, null);
  const req = all.find(r => r.id === requestId);
  if (!req) throw new Error('Solicitação não encontrada.');
  if (req.status !== 'pending') throw new Error('Esta solicitação não está mais pendente.');

  // Cria o empréstimo
  const loan = await createLoan(schoolId, {
    bookId: req.bookId,
    copyId,
    studentId,
    staffName,
    requestId
  });

  const now = new Date().toISOString();
  const updateData = {
    status: 'approved',
    handled_by: staffName,
    handled_at: now
  };

  if (isConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('loan_requests')
        .update(updateData)
        .eq('id', requestId);
      if (error) console.warn('Erro ao atualizar loan_request no Supabase:', error.message);
    } catch (e) {
      console.warn(e);
    }
  }

  const locals = getLocalRequests(schoolId);
  const found = locals.find(r => r.id === requestId);
  if (found) {
    found.status = 'approved';
    found.handledBy = staffName;
    found.handledAt = now;
    saveLocalRequests(schoolId, locals);
  }

  return loan;
}

/**
 * Rejects a request with a reason
 */
export async function rejectRequest(schoolId, requestId, reason, staffName) {
  const now = new Date().toISOString();
  const updateData = {
    status: 'rejected',
    rejection_reason: reason,
    handled_by: staffName,
    handled_at: now
  };

  if (isConfigured && supabase) {
    try {
      const { error } = await supabase
        .from('loan_requests')
        .update(updateData)
        .eq('id', requestId);
      if (error) console.warn('Erro ao rejeitar loan_request no Supabase:', error.message);
    } catch (e) {
      console.warn(e);
    }
  }

  const locals = getLocalRequests(schoolId);
  const found = locals.find(r => r.id === requestId);
  if (found) {
    found.status = 'rejected';
    found.rejectionReason = reason;
    found.handledBy = staffName;
    found.handledAt = now;
    saveLocalRequests(schoolId, locals);
  }

  return true;
}

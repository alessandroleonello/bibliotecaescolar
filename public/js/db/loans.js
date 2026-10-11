/**
 * Supabase Service: Loans, Returns, and Renewals Transactions
 */
import { supabase, isConfigured, pingHeartbeat } from '../supabase.js';
import { getBook, saveBook } from './books.js';
import { getSchool } from './schools.js';
import { listCopies, updateCopyStatus } from './copies.js';
import { getStudent } from './students.js';
import { addDays, isOverdue } from '../utils/dates.js';

const STORAGE_KEY = 'biblio_local_loans_';

function getLocalLoans(schoolId) {
  const data = localStorage.getItem(STORAGE_KEY + schoolId);
  if (data) return JSON.parse(data);
  const now = new Date();
  
  const pastDue = new Date(now);
  pastDue.setDate(pastDue.getDate() - 5);
  
  const futureDue = new Date(now);
  futureDue.setDate(futureDue.getDate() + 9);

  const initial = [
    {
      id: 'emp-001',
      bookId: 'livro-001',
      copyId: 'cop-104',
      studentId: 'aluno-001',
      snapshot: {
        bookTitle: 'Dom Casmurro',
        copyCode: 'TMB-00104',
        studentName: 'Lucas Silva Santos',
        grade: '8º ano'
      },
      loanedAt: new Date(now.getTime() - 19 * 86400000).toISOString(),
      dueAt: pastDue.toISOString(),
      renewals: 0,
      status: 'open',
      loanedBy: 'Carlos Santos'
    },
    {
      id: 'emp-002',
      bookId: 'livro-002',
      copyId: 'cop-205',
      studentId: 'aluno-002',
      snapshot: {
        bookTitle: 'O Pequeno Príncipe',
        copyCode: 'TMB-00205',
        studentName: 'Beatriz Almeida Costa',
        grade: '9º ano'
      },
      loanedAt: new Date(now.getTime() - 5 * 86400000).toISOString(),
      dueAt: futureDue.toISOString(),
      renewals: 0,
      status: 'open',
      loanedBy: 'Carlos Santos'
    }
  ];
  localStorage.setItem(STORAGE_KEY + schoolId, JSON.stringify(initial));
  return initial;
}

function saveLocalLoans(schoolId, loans) {
  localStorage.setItem(STORAGE_KEY + schoolId, JSON.stringify(loans));
}

function mapFromDb(row) {
  return {
    id: row.id,
    bookId: row.book_id,
    copyId: row.copy_id,
    studentId: row.student_id,
    snapshot: row.snapshot,
    loanedAt: row.loaned_at,
    dueAt: row.due_at,
    returnedAt: row.returned_at,
    renewals: row.renewals || 0,
    status: row.status,
    loanedBy: row.loaned_by,
    returnedBy: row.returned_by,
    requestId: row.request_id
  };
}

/**
 * Lists loans of a school
 */
export async function listLoans(schoolId, options = {}) {
  let loans = [];
  if (isConfigured && supabase) {
    try {
      let q = supabase.from('loans').select('*').eq('school_id', schoolId);
      if (options.status) q = q.eq('status', options.status);
      if (options.studentId) q = q.eq('student_id', options.studentId);
      const { data, error } = await q.order('loaned_at', { ascending: false });

      if (data && !error && data.length > 0) {
        loans = data.map(mapFromDb);
      }
    } catch (e) {
      console.warn('Fallback local loans:', e.message);
    }
  }

  if (loans.length === 0) {
    loans = getLocalLoans(schoolId);
    if (options.status) loans = loans.filter(l => l.status === options.status);
    if (options.studentId) loans = loans.filter(l => l.studentId === options.studentId);
  }

  return loans.sort((a, b) => new Date(b.loanedAt) - new Date(a.loanedAt));
}

/**
 * Creates a loan with strict validation and atomic updates
 */
export async function createLoan(schoolId, { bookId, copyId, studentId, staffName = 'Bibliotecário', customDays = null, requestId = null }) {
  const school = await getSchool(schoolId);
  const settings = school?.settings || { loanDays: 14, maxLoansPerStudent: 2, renewalsAllowed: 1, blockIfOverdue: true };

  const student = await getStudent(schoolId, studentId);
  if (!student) throw new Error('Aluno não encontrado.');
  if (!student.active) throw new Error('Aluno inativo no sistema.');

  const book = await getBook(schoolId, bookId);
  if (!book) throw new Error('Livro não encontrado.');

  const copies = await listCopies(schoolId, bookId);
  const copy = copies.find(c => c.id === copyId);
  if (!copy) throw new Error('Exemplar não encontrado.');
  if (copy.status !== 'available') throw new Error(`O exemplar ${copy.code} não está disponível (Status: ${copy.status}).`);

  // Check student active loans limit
  const allLoans = await listLoans(schoolId, { status: 'open' });
  const studentLoans = allLoans.filter(l => l.studentId === studentId);

  if (studentLoans.length >= settings.maxLoansPerStudent) {
    throw new Error(`Limite atingido: O aluno já possui ${studentLoans.length} empréstimo(s) em aberto (máximo permitido: ${settings.maxLoansPerStudent}).`);
  }

  if (settings.blockIfOverdue) {
    const hasOverdue = studentLoans.some(l => isOverdue(l.dueAt));
    if (hasOverdue) {
      throw new Error('Empréstimo bloqueado: O aluno possui empréstimos em atraso pendentes de devolução.');
    }
  }

  const days = customDays || settings.loanDays || 14;
  const now = new Date();
  const due = addDays(now, days);

  const loanId = 'emp-' + Date.now();
  const loanPayload = {
    id: loanId,
    bookId,
    copyId,
    studentId,
    snapshot: {
      bookTitle: book.title,
      copyCode: copy.code,
      studentName: student.name,
      grade: student.grade
    },
    loanedAt: now.toISOString(),
    dueAt: due.toISOString(),
    renewals: 0,
    status: 'open',
    loanedBy: staffName,
    requestId: requestId || null
  };

  if (isConfigured && supabase) {
    try {
      // 1. Insere o empréstimo
      await supabase.from('loans').insert({
        id: loanId,
        school_id: schoolId,
        book_id: bookId,
        copy_id: copyId,
        student_id: studentId,
        snapshot: loanPayload.snapshot,
        loaned_at: loanPayload.loanedAt,
        due_at: loanPayload.dueAt,
        renewals: 0,
        status: 'open',
        loaned_by: staffName,
        request_id: requestId
      });

      // 2. Atualiza a cópia para loaned (o trigger do PostgreSQL atualiza o livro automaticamente)
      await supabase.from('copies').update({ status: 'loaned' }).eq('id', copyId);

      pingHeartbeat();
    } catch (err) {
      console.warn('Erro ao gravar empréstimo no Supabase:', err.message);
    }
  }

  // Local storage updates
  const locals = getLocalLoans(schoolId);
  locals.unshift(loanPayload);
  saveLocalLoans(schoolId, locals);

  await updateCopyStatus(schoolId, copyId, 'loaned');

  return loanPayload;
}

/**
 * Returns a loaned copy
 */
export async function returnLoan(schoolId, loanId, { condition = 'Bom', staffName = 'Bibliotecário', isDamaged = false, isLost = false } = {}) {
  const allLoans = await listLoans(schoolId);
  const loan = allLoans.find(l => l.id === loanId);
  if (!loan) throw new Error('Empréstimo não encontrado.');
  if (loan.status !== 'open') throw new Error('Este empréstimo já foi finalizado.');

  const now = new Date().toISOString();
  const newCopyStatus = isLost ? 'lost' : (isDamaged ? 'damaged' : 'available');

  const updateData = {
    status: isLost ? 'lost' : 'returned',
    returnedAt: now,
    returnedBy: staffName
  };

  if (isConfigured && supabase) {
    try {
      await supabase.from('loans').update({
        status: updateData.status,
        returned_at: now,
        returned_by: staffName
      }).eq('id', loanId);

      await supabase.from('copies').update({
        status: newCopyStatus,
        condition
      }).eq('id', loan.copyId);

      pingHeartbeat();
    } catch (err) {
      console.warn('Erro ao devolver no Supabase:', err.message);
    }
  }

  // Local updates
  const locals = getLocalLoans(schoolId);
  const found = locals.find(l => l.id === loanId);
  if (found) {
    Object.assign(found, updateData);
    saveLocalLoans(schoolId, locals);
  }

  await updateCopyStatus(schoolId, loan.copyId, newCopyStatus, condition);

  return true;
}

/**
 * Renews a loan
 */
export async function renewLoan(schoolId, loanId, staffName = 'Bibliotecário') {
  const school = await getSchool(schoolId);
  const settings = school?.settings || { loanDays: 14, renewalsAllowed: 1 };

  const allLoans = await listLoans(schoolId);
  const loan = allLoans.find(l => l.id === loanId);
  if (!loan) throw new Error('Empréstimo não encontrado.');
  if (loan.status !== 'open') throw new Error('Apenas empréstimos em aberto podem ser renovados.');

  const currentRenewals = loan.renewals || 0;
  if (currentRenewals >= settings.renewalsAllowed) {
    throw new Error(`Limite de renovações atingido (${settings.renewalsAllowed} renovação(ões) permitida(s)).`);
  }

  const currentDue = new Date(loan.dueAt);
  const newDue = addDays(currentDue, settings.loanDays || 14);

  const updateData = {
    dueAt: newDue.toISOString(),
    renewals: currentRenewals + 1
  };

  if (isConfigured && supabase) {
    try {
      await supabase.from('loans').update({
        due_at: updateData.dueAt,
        renewals: updateData.renewals
      }).eq('id', loanId);

      pingHeartbeat();
    } catch (e) {
      console.warn(e);
    }
  }

  const locals = getLocalLoans(schoolId);
  const found = locals.find(l => l.id === loanId);
  if (found) {
    Object.assign(found, updateData);
    saveLocalLoans(schoolId, locals);
  }

  return updateData;
}

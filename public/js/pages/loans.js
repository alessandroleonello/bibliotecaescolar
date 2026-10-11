/**
 * Circulation: Loan Checkout and Open Loans Management Page Controller
 */
import { listLoans, createLoan, returnLoan, renewLoan } from '../db/loans.js';
import { listStudents } from '../db/students.js';
import { listBooks } from '../db/books.js';
import { listCopies, findCopyByCode } from '../db/copies.js';
import { getCurrentProfile } from '../auth.js';
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';
import { formatDate, isOverdue, daysBetween } from '../utils/dates.js';

export async function renderLoansPage(container) {
  const profile = getCurrentProfile();
  const schoolId = profile?.schoolId || 'escola-modelo-01';

  let selectedStudent = null;
  let selectedCopy = null;
  let selectedBook = null;

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
        Circulação & Empréstimos
      </h2>
      <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
        Realize novos empréstimos de balcão e acompanhe os prazos de devolução.
      </p>
    </div>

    <!-- Quick Checkout Box -->
    <div class="card" style="margin-bottom: 2rem; border-top: 4px solid var(--primary-600);">
      <div class="card-header">
        <h3 class="card-title">📖 Novo Empréstimo no Balcão</h3>
      </div>
      <div class="card-body">
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.5rem;">
          
          <!-- Step 1: Student Selection -->
          <div style="background:var(--slate-50); padding:1.25rem; border-radius:var(--radius-lg); border:1px solid var(--border-subtle);">
            <div style="font-weight:700; font-size:0.9rem; color:var(--slate-800); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
              <span style="width:24px; height:24px; border-radius:50%; background:var(--primary-600); color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.8rem;">1</span>
              Localizar Aluno
            </div>

            <div class="form-group" style="margin-bottom:0.75rem;">
              <input type="text" id="loan-student-search" class="form-control" placeholder="Digite nome ou RA do aluno..." autocomplete="off" />
            </div>

            <div id="student-search-results" style="max-height:160px; overflow-y:auto; display:none; background:#fff; border:1px solid var(--border-subtle); border-radius:var(--radius-md); margin-bottom:0.75rem;"></div>

            <div id="selected-student-box" style="display:none; padding:0.75rem; background:#fff; border-radius:var(--radius-md); border:1px solid var(--success-border);">
              <div style="font-weight:700; color:var(--slate-900);" id="sel-student-name">-</div>
              <div style="font-size:0.8rem; color:var(--slate-500);">
                RA: <span id="sel-student-ra" class="mono">-</span> • Série: <span id="sel-student-grade">-</span>
              </div>
            </div>
          </div>

          <!-- Step 2: Copy Selection -->
          <div style="background:var(--slate-50); padding:1.25rem; border-radius:var(--radius-lg); border:1px solid var(--border-subtle);">
            <div style="font-weight:700; font-size:0.9rem; color:var(--slate-800); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
              <span style="width:24px; height:24px; border-radius:50%; background:var(--primary-600); color:#fff; display:flex; align-items:center; justify-content:center; font-size:0.8rem;">2</span>
              Escanear / Localizar Exemplar
            </div>

            <div class="form-group" style="margin-bottom:0.75rem;">
              <input type="text" id="loan-copy-code" class="form-control mono" placeholder="Escanear código de barras ou digitar tombo..." autocomplete="off" />
            </div>

            <div id="selected-copy-box" style="display:none; padding:0.75rem; background:#fff; border-radius:var(--radius-md); border:1px solid var(--success-border);">
              <div style="font-weight:700; color:var(--slate-900);" id="sel-copy-title">-</div>
              <div style="font-size:0.8rem; color:var(--slate-500);">
                Tombo: <strong class="mono" id="sel-copy-code" style="color:var(--primary-700);">-</strong> • Estado: <span id="sel-copy-cond">-</span>
              </div>
            </div>
          </div>

        </div>

        <div style="margin-top:1.5rem; display:flex; justify-content:flex-end;">
          <button id="btn-confirm-checkout" class="btn btn-primary btn-lg" disabled>
            <span>Confirmar Empréstimo (14 dias)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Active Loans Table -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Empréstimos em Aberto</h3>
        <div style="display:flex; gap:0.5rem;">
          <button id="filter-all-loans" class="btn btn-sm btn-primary">Todos em Aberto</button>
          <button id="filter-overdue-loans" class="btn btn-sm btn-secondary" style="color:var(--danger-main);">⚠️ Apenas Atrasados</button>
        </div>
      </div>
      <div class="table-container" style="border:none;">
        <table class="table">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>Livro & Exemplar</th>
              <th>Data Retirada</th>
              <th>Vencimento</th>
              <th>Status</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody id="loans-tbody">
            <tr><td colspan="6" style="text-align:center; padding:2rem;"><span class="spinner"></span> Carregando empréstimos...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Student Search Typeahead
  const studentSearchInput = container.querySelector('#loan-student-search');
  const studentResults = container.querySelector('#student-search-results');
  const selectedStudentBox = container.querySelector('#selected-student-box');
  const confirmBtn = container.querySelector('#btn-confirm-checkout');

  studentSearchInput.addEventListener('input', async () => {
    const val = studentSearchInput.value.trim();
    if (val.length < 2) {
      studentResults.style.display = 'none';
      return;
    }
    const students = await listStudents(schoolId, val);
    if (students.length === 0) {
      studentResults.innerHTML = `<div style="padding:0.75rem; font-size:0.8rem; color:var(--slate-500);">Nenhum aluno encontrado</div>`;
    } else {
      studentResults.innerHTML = students.slice(0, 5).map(s => `
        <div class="student-item" data-id="${s.id}" style="padding:0.6rem 0.8rem; border-bottom:1px solid var(--slate-100); cursor:pointer; font-size:0.85rem;">
          <div style="font-weight:600;">${s.name}</div>
          <div style="font-size:0.75rem; color:var(--slate-500);">RA: ${s.ra}-${s.raDigit || '0'} • ${s.grade}</div>
        </div>
      `).join('');

      studentResults.querySelectorAll('.student-item').forEach(item => {
        item.addEventListener('click', async () => {
          const sId = item.getAttribute('data-id');
          selectedStudent = students.find(s => s.id === sId);
          studentResults.style.display = 'none';
          studentSearchInput.value = '';

          container.querySelector('#sel-student-name').textContent = selectedStudent.name;
          container.querySelector('#sel-student-ra').textContent = `${selectedStudent.ra}-${selectedStudent.raDigit || '0'}`;
          container.querySelector('#sel-student-grade').textContent = selectedStudent.grade;
          selectedStudentBox.style.display = 'block';
          checkCheckoutReady();
        });
      });
    }
    studentResults.style.display = 'block';
  });

  // Copy Code Search
  const copyInput = container.querySelector('#loan-copy-code');
  const selectedCopyBox = container.querySelector('#selected-copy-box');

  const handleCopySearch = async () => {
    const code = copyInput.value.trim();
    if (!code) return;
    const copy = await findCopyByCode(schoolId, code);
    if (!copy) {
      toast.warning(`Nenhum exemplar com o código "${code}" foi encontrado.`);
      return;
    }
    if (copy.status !== 'available') {
      toast.error(`O exemplar ${copy.code} não está disponível para empréstimo (Status: ${copy.status}).`);
      return;
    }

    const books = await listBooks(schoolId);
    selectedBook = books.find(b => b.id === copy.bookId);
    selectedCopy = copy;

    container.querySelector('#sel-copy-title').textContent = selectedBook?.title || 'Título Desconhecido';
    container.querySelector('#sel-copy-code').textContent = copy.code;
    container.querySelector('#sel-copy-cond').textContent = copy.condition || 'Bom';
    selectedCopyBox.style.display = 'block';
    checkCheckoutReady();
  };

  copyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCopySearch();
    }
  });

  function checkCheckoutReady() {
    confirmBtn.disabled = !(selectedStudent && selectedCopy);
  }

  // Confirm Checkout
  confirmBtn.addEventListener('click', async () => {
    if (!selectedStudent || !selectedCopy) return;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner"></span> Registrando...`;

    try {
      await createLoan(schoolId, {
        bookId: selectedCopy.bookId,
        copyId: selectedCopy.id,
        studentId: selectedStudent.id,
        staffName: profile?.name || 'Bibliotecário'
      });

      toast.success(`Empréstimo registrado com sucesso para ${selectedStudent.name}!`);
      
      // Reset form
      selectedStudent = null;
      selectedCopy = null;
      selectedBook = null;
      selectedStudentBox.style.display = 'none';
      selectedCopyBox.style.display = 'none';
      copyInput.value = '';
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<span>Confirmar Empréstimo (14 dias)</span>`;

      loadLoansTable();
    } catch (err) {
      toast.error(err.message);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<span>Confirmar Empréstimo (14 dias)</span>`;
    }
  });

  // Load Loans Table
  let currentFilter = 'all';

  async function loadLoansTable() {
    const tbody = container.querySelector('#loans-tbody');
    let loans = await listLoans(schoolId, { status: 'open' });

    if (currentFilter === 'overdue') {
      loans = loans.filter(l => isOverdue(l.dueAt));
    }

    if (loans.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:3rem 1rem;">
            <div class="empty-state" style="padding:0;">
              <div class="empty-state-icon">📖</div>
              <div class="empty-state-title">Nenhum empréstimo em aberto</div>
              <div class="empty-state-text">Não há empréstimos pendentes no momento.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = loans.map(l => {
      const overdue = isOverdue(l.dueAt);
      const days = daysBetween(new Date(), new Date(l.dueAt));

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--slate-900);">${l.snapshot?.studentName}</div>
            <div style="font-size:0.775rem; color:var(--slate-500);">${l.snapshot?.grade || ''}</div>
          </td>
          <td>
            <div style="font-weight:600;">${l.snapshot?.bookTitle}</div>
            <div class="mono" style="font-size:0.75rem; color:var(--primary-700);">${l.snapshot?.copyCode}</div>
          </td>
          <td>${formatDate(l.loanedAt)}</td>
          <td>
            <span style="font-weight:600; color:${overdue ? 'var(--danger-main)' : 'var(--slate-800)'};">
              ${formatDate(l.dueAt)}
            </span>
          </td>
          <td>
            ${overdue ? `
              <span class="badge badge-danger">
                <span class="badge-dot"></span> Atrasado (${days}d)
              </span>
            ` : `
              <span class="badge badge-info">
                <span class="badge-dot"></span> Em dia
              </span>
            `}
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:0.4rem;">
              <button class="btn btn-sm btn-primary btn-return-action" data-id="${l.id}" title="Devolver livro">
                Devolver
              </button>
              <button class="btn btn-sm btn-secondary btn-renew-action" data-id="${l.id}" title="Renovar por mais 14 dias">
                Renovar (${l.renewals || 0})
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('.btn-return-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lId = btn.getAttribute('data-id');
        if (confirm('Confirmar a devolução deste exemplar?')) {
          await returnLoan(schoolId, lId, { staffName: profile?.name || 'Bibliotecário' });
          toast.success('Livro devolvido com sucesso!');
          loadLoansTable();
        }
      });
    });

    tbody.querySelectorAll('.btn-renew-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lId = btn.getAttribute('data-id');
        try {
          await renewLoan(schoolId, lId, profile?.name || 'Bibliotecário');
          toast.success('Empréstimo renovado por mais 14 dias!');
          loadLoansTable();
        } catch (err) {
          toast.error(err.message);
        }
      });
    });
  }

  // Filter Buttons
  container.querySelector('#filter-all-loans').addEventListener('click', () => {
    currentFilter = 'all';
    container.querySelector('#filter-all-loans').className = 'btn btn-sm btn-primary';
    container.querySelector('#filter-overdue-loans').className = 'btn btn-sm btn-secondary';
    loadLoansTable();
  });

  container.querySelector('#filter-overdue-loans').addEventListener('click', () => {
    currentFilter = 'overdue';
    container.querySelector('#filter-all-loans').className = 'btn btn-sm btn-secondary';
    container.querySelector('#filter-overdue-loans').className = 'btn btn-sm btn-danger';
    loadLoansTable();
  });

  await loadLoansTable();
}

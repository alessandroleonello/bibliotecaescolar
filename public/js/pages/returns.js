/**
 * Fast Return Station Page Controller (Optimized for Barcode Scanner)
 */
import { listLoans, returnLoan } from '../db/loans.js';
import { findCopyByCode } from '../db/copies.js';
import { getCurrentProfile } from '../auth.js';
import { toast } from '../ui/toast.js';
import { formatDate, isOverdue, daysBetween } from '../utils/dates.js';

export function renderReturnsPage(container) {
  const profile = getCurrentProfile();
  const schoolId = profile?.schoolId || 'escola-modelo-01';

  let currentFoundLoan = null;

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
        Devolução Rápida no Balcão
      </h2>
      <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
        Passe o leitor óptico sobre a etiqueta do livro para processar a devolução instantânea.
      </p>
    </div>

    <!-- Scanner Box -->
    <div class="card" style="max-width: 680px; margin: 0 auto 2rem; padding: 2rem; text-align:center;">
      <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">⚡</div>
      <h3 style="font-size: 1.25rem; font-weight: 700; color: var(--slate-900); margin-bottom: 0.5rem;">
        Escanear Código da Cópia
      </h3>
      <p style="font-size: 0.875rem; color: var(--slate-500); margin-bottom: 1.5rem;">
        O leitor de código de barras preencherá o campo e confirmará automaticamente.
      </p>

      <div style="display:flex; gap:0.75rem; max-width:480px; margin: 0 auto;">
        <input type="text" id="return-code-input" class="form-control mono" placeholder="TMB-00104" autofocus style="font-size:1.2rem; text-align:center; letter-spacing:0.05em;" />
        <button id="btn-search-return" class="btn btn-primary" style="padding: 0 1.5rem;">Buscar</button>
      </div>

      <!-- Result Card -->
      <div id="return-result-box" style="display:none; margin-top: 2rem; text-align:left; background:var(--slate-50); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
          <div>
            <div style="font-size:0.75rem; color:var(--slate-400); font-weight:700; text-transform:uppercase;">Livro Emprestado</div>
            <div style="font-size:1.2rem; font-weight:800; color:var(--slate-900);" id="ret-book-title">-</div>
            <div style="font-size:0.85rem; color:var(--slate-500);">Tombo: <strong class="mono" id="ret-copy-code" style="color:var(--primary-700);">-</strong></div>
          </div>
          <div id="ret-overdue-badge"></div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; padding:1rem; background:#fff; border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-bottom:1.25rem;">
          <div>
            <div style="font-size:0.75rem; color:var(--slate-400); font-weight:600;">Aluno / Leitor</div>
            <div style="font-weight:700; color:var(--slate-800);" id="ret-student-name">-</div>
            <div style="font-size:0.8rem; color:var(--slate-500);" id="ret-student-grade">-</div>
          </div>
          <div>
            <div style="font-size:0.75rem; color:var(--slate-400); font-weight:600;">Data de Retirada</div>
            <div style="font-size:0.9rem; color:var(--slate-800);" id="ret-loan-date">-</div>
            <div style="font-size:0.75rem; color:var(--slate-500);">Prazo: <span id="ret-due-date">-</span></div>
          </div>
        </div>

        <!-- Condition Selection -->
        <div class="form-group">
          <label class="form-label" for="ret-condition">Estado de Conservação na Devolução:</label>
          <select id="ret-condition" class="form-control">
            <option value="Excelente">Excelente (Sem marcas)</option>
            <option value="Bom" selected>Bom (Normal de uso)</option>
            <option value="Danificado">Danificado (Páginas rasgadas / manchado)</option>
            <option value="Perdido">Perdido / Extraviado</option>
          </select>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
          <button class="btn btn-secondary" id="btn-cancel-return">Cancelar</button>
          <button class="btn btn-primary" id="btn-confirm-return">
            <span>Confirmar Devolução</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const codeInput = container.querySelector('#return-code-input');
  const resultBox = container.querySelector('#return-result-box');
  const searchBtn = container.querySelector('#btn-search-return');

  const processScan = async () => {
    const code = codeInput.value.trim();
    if (!code) return;

    searchBtn.disabled = true;
    searchBtn.textContent = '...';

    const copy = await findCopyByCode(schoolId, code);
    if (!copy) {
      toast.warning(`Nenhum exemplar com tombo "${code}" foi localizado.`);
      searchBtn.disabled = false;
      searchBtn.textContent = 'Buscar';
      return;
    }

    const openLoans = await listLoans(schoolId, { status: 'open' });
    const loan = openLoans.find(l => l.copyId === copy.id);

    if (!loan) {
      toast.info(`O exemplar ${copy.code} já está disponível na biblioteca (não há empréstimo em aberto).`);
      searchBtn.disabled = false;
      searchBtn.textContent = 'Buscar';
      return;
    }

    currentFoundLoan = loan;

    container.querySelector('#ret-book-title').textContent = loan.snapshot?.bookTitle;
    container.querySelector('#ret-copy-code').textContent = copy.code;
    container.querySelector('#ret-student-name').textContent = loan.snapshot?.studentName;
    container.querySelector('#ret-student-grade').textContent = loan.snapshot?.grade;
    container.querySelector('#ret-loan-date').textContent = formatDate(loan.loanedAt);
    container.querySelector('#ret-due-date').textContent = formatDate(loan.dueAt);

    const overdue = isOverdue(loan.dueAt);
    const badgeEl = container.querySelector('#ret-overdue-badge');
    if (overdue) {
      const days = daysBetween(new Date(), new Date(loan.dueAt));
      badgeEl.innerHTML = `<span class="badge badge-danger"><span class="badge-dot"></span> Atrasado em ${days} dias</span>`;
    } else {
      badgeEl.innerHTML = `<span class="badge badge-success"><span class="badge-dot"></span> No prazo</span>`;
    }

    resultBox.style.display = 'block';
    searchBtn.disabled = false;
    searchBtn.textContent = 'Buscar';
  };

  codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      processScan();
    }
  });

  searchBtn.addEventListener('click', processScan);

  // Confirm Return
  container.querySelector('#btn-confirm-return')?.addEventListener('click', async () => {
    if (!currentFoundLoan) return;

    const condition = container.querySelector('#ret-condition').value;
    const isDamaged = condition === 'Danificado';
    const isLost = condition === 'Perdido';

    await returnLoan(schoolId, currentFoundLoan.id, {
      condition,
      isDamaged,
      isLost,
      staffName: profile?.name || 'Bibliotecário'
    });

    toast.success(`Livro "${currentFoundLoan.snapshot?.bookTitle}" devolvido com sucesso!`);
    
    // Reset
    currentFoundLoan = null;
    resultBox.style.display = 'none';
    codeInput.value = '';
    codeInput.focus();
  });

  container.querySelector('#btn-cancel-return')?.addEventListener('click', () => {
    currentFoundLoan = null;
    resultBox.style.display = 'none';
    codeInput.value = '';
    codeInput.focus();
  });
}

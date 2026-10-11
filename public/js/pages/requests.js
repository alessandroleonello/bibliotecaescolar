/**
 * Public Loan Requests Queue Page Controller
 */
import { listRequests, approveRequest, rejectRequest } from '../db/requests.js';
import { listStudents } from '../db/students.js';
import { listCopies } from '../db/copies.js';
import { getCurrentProfile } from '../auth.js';
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';
import { formatDateTime } from '../utils/dates.js';

export async function renderRequestsPage(container) {
  const profile = getCurrentProfile();
  const schoolId = profile?.schoolId || 'escola-modelo-01';

  let currentTab = 'pending';

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
            Solicitações do Catálogo Público
          </h2>
          <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
            Pedidos de empréstimo enviados pelos alunos através do link público da escola.
          </p>
        </div>

        <a href="catalogo.html?escola=${profile?.schoolSlug || 'modelo'}" target="_blank" class="btn btn-secondary">
          <span>Abrir Catálogo do Aluno</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </div>

    <!-- Tabs and Table -->
    <div class="card">
      <div class="card-header">
        <div style="display:flex; gap:0.5rem;">
          <button id="tab-pending" class="btn btn-sm btn-primary">Fila Pendente</button>
          <button id="tab-handled" class="btn btn-sm btn-secondary">Histórico de Atendidas</button>
        </div>
      </div>

      <div class="table-container" style="border:none;">
        <table class="table">
          <thead>
            <tr>
              <th>Aluno Solicitante</th>
              <th>Livro Solicitado</th>
              <th>Data do Envio</th>
              <th>Válida até</th>
              <th>Status</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody id="requests-tbody">
            <tr><td colspan="6" style="text-align:center; padding:2rem;"><span class="spinner"></span> Carregando solicitações...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  async function loadTable() {
    const tbody = container.querySelector('#requests-tbody');
    const filterStatus = currentTab === 'pending' ? 'pending' : null;
    let requests = await listRequests(schoolId, filterStatus);

    if (currentTab === 'handled') {
      requests = requests.filter(r => r.status !== 'pending');
    }

    if (requests.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:3rem 1rem;">
            <div class="empty-state" style="padding:0;">
              <div class="empty-state-icon">📬</div>
              <div class="empty-state-title">Nenhuma solicitação ${currentTab === 'pending' ? 'pendente' : 'no histórico'}</div>
              <div class="empty-state-text">Quando os alunos solicitarem livros pelo catálogo online, eles aparecerão aqui.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = requests.map(r => {
      const isPending = r.status === 'pending';
      let statusBadge = `<span class="badge badge-warning"><span class="badge-dot"></span> Pendente</span>`;
      if (r.status === 'approved') statusBadge = `<span class="badge badge-success"><span class="badge-dot"></span> Aprovada</span>`;
      if (r.status === 'rejected') statusBadge = `<span class="badge badge-danger"><span class="badge-dot"></span> Recusada</span>`;
      if (r.status === 'expired') statusBadge = `<span class="badge badge-neutral"><span class="badge-dot"></span> Expirada</span>`;

      return `
        <tr>
          <td>
            <div style="font-weight:700; color:var(--slate-900);">${r.studentName}</div>
            <div style="font-size:0.775rem; color:var(--slate-500);">${r.grade} ${r.studentRa ? `• RA: ${r.studentRa}` : ''}</div>
          </td>
          <td>
            <strong style="color:var(--slate-800);">${r.bookTitle}</strong>
          </td>
          <td>${formatDateTime(r.createdAt)}</td>
          <td>${formatDateTime(r.expiresAt)}</td>
          <td>${statusBadge}</td>
          <td style="text-align:right;">
            ${isPending ? `
              <div style="display:inline-flex; gap:0.4rem;">
                <button class="btn btn-sm btn-primary btn-approve-req" data-id="${r.id}">
                  Aprovar
                </button>
                <button class="btn btn-sm btn-ghost btn-reject-req" data-id="${r.id}" style="color:var(--danger-main);">
                  Recusar
                </button>
              </div>
            ` : `
              <span style="font-size:0.75rem; color:var(--slate-400);">Por: ${r.handledBy || '-'}</span>
            `}
          </td>
        </tr>
      `;
    }).join('');

    // Attach Approve listeners
    tbody.querySelectorAll('.btn-approve-req').forEach(btn => {
      btn.addEventListener('click', () => openApproveModal(btn.getAttribute('data-id')));
    });

    // Attach Reject listeners
    tbody.querySelectorAll('.btn-reject-req').forEach(btn => {
      btn.addEventListener('click', () => openRejectModal(btn.getAttribute('data-id')));
    });
  }

  // Approve Modal
  async function openApproveModal(requestId) {
    const all = await listRequests(schoolId, null);
    const req = all.find(r => r.id === requestId);
    if (!req) return;

    // Get available copies of this book
    const copies = await listCopies(schoolId, req.bookId);
    const availableCopies = copies.filter(c => c.status === 'available');

    // Find student in directory if possible
    const students = await listStudents(schoolId, req.studentName);
    let matchedStudent = students.length > 0 ? students[0] : null;

    modal.open({
      title: 'Aprovar Solicitação de Empréstimo',
      maxWidth: '560px',
      body: `
        <div style="padding:0.75rem 1rem; background:var(--slate-50); border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-bottom:1.25rem;">
          <div style="font-size:0.8rem; color:var(--slate-500);">Obra Solicitada:</div>
          <div style="font-size:1.1rem; font-weight:700; color:var(--slate-900);">${req.bookTitle}</div>
          <div style="font-size:0.85rem; color:var(--slate-600); margin-top:0.25rem;">
            Aluno: <strong>${req.studentName}</strong> (${req.grade})
          </div>
        </div>

        <form id="approve-form">
          <div class="form-group">
            <label class="form-label" for="app-select-copy">Selecione o Exemplar Físico a ser Entregue <span class="required">*</span></label>
            ${availableCopies.length === 0 ? `
              <div class="badge badge-danger" style="margin-top:0.25rem;">Atenção: Nenhuma cópia disponível deste livro no momento!</div>
            ` : `
              <select id="app-select-copy" class="form-control" required>
                ${availableCopies.map(c => `
                  <option value="${c.id}">${c.code} — Estado: ${c.condition || 'Bom'}</option>
                `).join('')}
              </select>
            `}
          </div>

          <div class="form-group">
            <label class="form-label" for="app-select-student">Confirmar Cadastro do Aluno <span class="required">*</span></label>
            <select id="app-select-student" class="form-control" required>
              ${matchedStudent ? `
                <option value="${matchedStudent.id}" selected>${matchedStudent.name} (RA: ${matchedStudent.ra}-${matchedStudent.raDigit || '0'})</option>
              ` : `
                <option value="">Selecione o aluno correspondente...</option>
              `}
              ${(await listStudents(schoolId)).map(s => `
                <option value="${s.id}">${s.name} (${s.grade} • RA: ${s.ra})</option>
              `).join('')}
            </select>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-app-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-app-confirm" ${availableCopies.length === 0 ? 'disabled' : ''}>
          Confirmar e Gerar Empréstimo
        </button>
      `
    });

    document.getElementById('modal-app-cancel')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-app-confirm')?.addEventListener('click', async () => {
      const copyId = document.getElementById('app-select-copy')?.value;
      const studentId = document.getElementById('app-select-student')?.value;

      if (!copyId || !studentId) {
        toast.warning('Selecione o exemplar e o aluno.');
        return;
      }

      try {
        await approveRequest(schoolId, requestId, {
          copyId,
          studentId,
          staffName: profile?.name || 'Bibliotecário'
        });
        toast.success(`Empréstimo gerado com sucesso!`);
        modal.close();
        loadTable();
      } catch (err) {
        toast.error(err.message);
      }
    });
  }

  // Reject Modal
  function openRejectModal(requestId) {
    modal.open({
      title: 'Recusar Solicitação',
      body: `
        <p style="font-size:0.9rem; color:var(--slate-600); margin-bottom:1rem;">
          Informe o motivo da recusa desta solicitação:
        </p>
        <div class="form-group">
          <label class="form-label" for="reject-reason">Motivo</label>
          <select id="reject-reason" class="form-control">
            <option value="Sem cópias disponíveis no momento">Sem cópias disponíveis no momento</option>
            <option value="Aluno com limite de empréstimos atingido">Aluno com limite de empréstimos atingido</option>
            <option value="Aluno com pendência/atraso na biblioteca">Aluno com pendência/atraso na biblioteca</option>
            <option value="Dados incompletos ou não localizados">Dados incompletos ou não localizados</option>
            <option value="Outro">Outro motivo</option>
          </select>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-rej-cancel">Cancelar</button>
        <button class="btn btn-danger" id="modal-rej-confirm">Recusar Solicitação</button>
      `
    });

    document.getElementById('modal-rej-cancel')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-rej-confirm')?.addEventListener('click', async () => {
      const reason = document.getElementById('reject-reason')?.value;
      await rejectRequest(schoolId, requestId, reason, profile?.name || 'Bibliotecário');
      toast.info('Solicitação recusada.');
      modal.close();
      loadTable();
    });
  }

  // Tab toggles
  container.querySelector('#tab-pending').addEventListener('click', () => {
    currentTab = 'pending';
    container.querySelector('#tab-pending').className = 'btn btn-sm btn-primary';
    container.querySelector('#tab-handled').className = 'btn btn-sm btn-secondary';
    loadTable();
  });

  container.querySelector('#tab-handled').addEventListener('click', () => {
    currentTab = 'handled';
    container.querySelector('#tab-pending').className = 'btn btn-sm btn-secondary';
    container.querySelector('#tab-handled').className = 'btn btn-sm btn-primary';
    loadTable();
  });

  await loadTable();
}

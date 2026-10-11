/**
 * School Settings, Rules & Staff Management Page Controller
 */
import { 
  getSchool, 
  updateSchoolSettings, 
  listStaff, 
  createStaff, 
  toggleStaffStatus, 
  resendStaffInvite, 
  deleteStaff 
} from '../db/schools.js';
import { listBooks, saveBook } from '../db/books.js';
import { listCopies } from '../db/copies.js';
import { getCurrentProfile } from '../auth.js';
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';
import { renderQRCode } from '../utils/barcode.js';

export async function renderSettingsPage(container) {
  const profile = getCurrentProfile();
  const schoolId = profile?.schoolId || 'escola-modelo-01';
  const school = await getSchool(schoolId) || {};
  const settings = school.settings || {
    loanDays: 14,
    maxLoansPerStudent: 2,
    renewalsAllowed: 1,
    blockIfOverdue: true,
    publicCatalogEnabled: true,
    requestHoldHours: 48,
    grades: ['6º ano', '7º ano', '8º ano', '9º ano', '1º EM', '2º EM', '3º EM'],
    categories: []
  };

  const publicUrl = `${window.location.origin}/public/catalogo.html?escola=${school.slug || 'modelo'}`;

  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
        Configurações da Biblioteca
      </h2>
      <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
        Parâmetros de empréstimos, cadastro de funcionários e regras de <strong>${school.name || 'Sua Escola'}</strong>.
      </p>
    </div>

    <!-- Top Layout: Settings & QR Code -->
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1.75rem; align-items:start; margin-bottom:2rem;">
      
      <!-- Main Settings Form -->
      <div class="card" style="padding: 2rem;">
        <h3 style="font-size:1.15rem; font-weight:700; color:var(--slate-900); margin-bottom:1.25rem;">
          Regras de Circulação & Prazos
        </h3>

        <form id="settings-form">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.25rem;">
            <div class="form-group">
              <label class="form-label" for="cfg-loan-days">Prazo Padrão de Devolução (dias)</label>
              <input type="number" id="cfg-loan-days" class="form-control" value="${settings.loanDays || 14}" min="1" max="90" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="cfg-max-loans">Limite Máximo de Livros por Aluno</label>
              <input type="number" id="cfg-max-loans" class="form-control" value="${settings.maxLoansPerStudent || 2}" min="1" max="10" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="cfg-renewals">Renovações Permitidas por Livro</label>
              <input type="number" id="cfg-renewals" class="form-control" value="${settings.renewalsAllowed || 1}" min="0" max="5" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="cfg-hold-hours">Tempo de Reserva da Solicitação (horas)</label>
              <input type="number" id="cfg-hold-hours" class="form-control" value="${settings.requestHoldHours || 48}" min="12" max="168" required />
            </div>
          </div>

          <div class="form-group" style="margin-top:0.5rem;">
            <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
              <input type="checkbox" id="cfg-block-overdue" ${settings.blockIfOverdue ? 'checked' : ''} style="width:18px; height:18px;" />
              <span style="font-weight:600; font-size:0.9rem; color:var(--slate-800);">Bloquear novos empréstimos se o aluno tiver livros em atraso</span>
            </label>
          </div>

          <div class="form-group" style="margin-top:1.25rem;">
            <label class="form-label" for="cfg-grades">Séries / Turmas Atendidas (separadas por vírgula)</label>
            <input type="text" id="cfg-grades" class="form-control" value="${(settings.grades || []).join(', ')}" />
          </div>

          <div class="form-group" style="margin-top:1rem;">
            <label class="form-label" for="cfg-categories">Categorias de Livros do Acervo (separadas por vírgula)</label>
            <textarea id="cfg-categories" class="form-control" rows="2">${(settings.categories || []).join(', ')}</textarea>
            <div class="form-hint">Você também pode gerenciar categorias com contadores na aba "Acervo de Livros".</div>
          </div>

          <div style="margin-top:1.75rem; pt:1rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:flex-end;">
            <button type="submit" class="btn btn-primary">Salvar Configurações</button>
          </div>
        </form>
      </div>

      <!-- Right Column: Public QR Code & Maintenance -->
      <div style="display:flex; flex-direction:column; gap:1.5rem;">
        
        <!-- Public Catalog QR Code Card -->
        <div class="card" style="padding: 1.5rem; text-align:center;">
          <h4 style="font-size:1rem; font-weight:700; color:var(--slate-900); margin-bottom:0.25rem;">
            QR Code do Catálogo do Aluno
          </h4>
          <p style="font-size:0.8rem; color:var(--slate-500); margin-bottom:1.25rem;">
            Imprima e cole no balcão para os estudantes acessarem pelo celular.
          </p>

          <div id="qrcode-container" style="display:flex; justify-content:center; margin-bottom:1.25rem; min-height:160px; align-items:center;"></div>

          <div style="background:var(--slate-50); padding:0.5rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle); margin-bottom:0.75rem;">
            <div class="mono truncate" style="font-size:0.75rem; color:var(--slate-600);" id="public-link-text">${publicUrl}</div>
          </div>

          <button id="btn-copy-public-link" class="btn btn-sm btn-secondary" style="width:100%;">
            📋 Copiar Link Público
          </button>
        </div>

        <!-- Recalculate Counters Maintenance Card -->
        <div class="card" style="padding: 1.5rem;">
          <h4 style="font-size:0.95rem; font-weight:700; color:var(--slate-900); margin-bottom:0.35rem;">
            ⚙️ Manutenção do Acervo
          </h4>
          <p style="font-size:0.8rem; color:var(--slate-500); margin-bottom:1rem; line-height:1.5;">
            Recalcula e sincroniza as quantidades de cópias disponíveis diretamente a partir dos exemplares físicos.
          </p>
          <button id="btn-recalculate-counters" class="btn btn-secondary btn-sm" style="width:100%;">
            🔄 Recalcular Contadores do Acervo
          </button>
        </div>

      </div>

    </div>

    <!-- Staff & Librarians Management Section -->
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">👥 Equipe da Biblioteca (Funcionários & Bibliotecários)</h3>
          <p style="font-size:0.85rem; color:var(--slate-500); margin-top:0.2rem;">
            Cadastre os e-mails dos funcionários da biblioteca. Eles receberão um link para cadastrar a própria senha e acessar o sistema.
          </p>
        </div>
        <button id="btn-add-staff" class="btn btn-primary btn-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Convidar Funcionário</span>
        </button>
      </div>

      <div class="table-container" style="border:none;">
        <table class="table" id="staff-table">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>E-mail de Acesso</th>
              <th>Função / Cargo</th>
              <th>Status</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody id="staff-tbody">
            <tr><td colspan="5" style="text-align:center; padding:2rem;"><span class="spinner"></span> Carregando equipe...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Render QR Code
  const qrContainer = container.querySelector('#qrcode-container');
  renderQRCode(qrContainer, publicUrl, 160);

  // Copy link button
  container.querySelector('#btn-copy-public-link').addEventListener('click', () => {
    navigator.clipboard.writeText(publicUrl).then(() => {
      toast.success('Link do catálogo copiado para a área de transferência!');
    }).catch(() => {
      toast.info(`Link: ${publicUrl}`);
    });
  });

  // Save Settings Form
  container.querySelector('#settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSettings = {
      loanDays: parseInt(container.querySelector('#cfg-loan-days').value) || 14,
      maxLoansPerStudent: parseInt(container.querySelector('#cfg-max-loans').value) || 2,
      renewalsAllowed: parseInt(container.querySelector('#cfg-renewals').value) || 1,
      requestHoldHours: parseInt(container.querySelector('#cfg-hold-hours').value) || 48,
      blockIfOverdue: container.querySelector('#cfg-block-overdue').checked,
      grades: container.querySelector('#cfg-grades').value.split(',').map(g => g.trim()).filter(Boolean),
      categories: container.querySelector('#cfg-categories').value.split(',').map(c => c.trim()).filter(Boolean)
    };

    await updateSchoolSettings(schoolId, newSettings);
    toast.success('Configurações salvas com sucesso!');
  });

  // Recalculate counters
  container.querySelector('#btn-recalculate-counters').addEventListener('click', async () => {
    const btn = container.querySelector('#btn-recalculate-counters');
    btn.disabled = true;
    btn.textContent = 'Recalculando...';

    try {
      const books = await listBooks(schoolId);
      const copies = await listCopies(schoolId);

      for (const book of books) {
        const bookCopies = copies.filter(c => c.bookId === book.id);
        const avail = bookCopies.filter(c => c.status === 'available').length;
        await saveBook(schoolId, {
          ...book,
          totalCopies: bookCopies.length,
          availableCopies: avail
        }, book.id);
      }

      toast.success(`Contadores sincronizados para ${books.length} títulos!`);
    } catch (err) {
      toast.error('Erro ao recalcular: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Recalcular Contadores do Acervo';
    }
  });

  // Staff Table Management
  async function loadStaffTable() {
    const tbody = container.querySelector('#staff-tbody');
    const staffMembers = await listStaff(schoolId);

    if (staffMembers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding:2rem; color:var(--slate-500);">
            Nenhum funcionário cadastrado ainda. Clique em "Convidar Funcionário" para adicionar.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = staffMembers.map(st => `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--slate-900); font-size:0.95rem;">${st.name}</div>
        </td>
        <td>
          <span class="mono" style="font-size:0.875rem; color:var(--slate-700);">${st.email}</span>
        </td>
        <td>
          <span style="font-size:0.85rem; color:var(--slate-600);">${st.jobTitle || 'Bibliotecário'}</span>
        </td>
        <td>
          <span class="badge ${st.active ? 'badge-success' : 'badge-danger'}">
            <span class="badge-dot"></span> ${st.active ? 'Ativo' : 'Desativado'}
          </span>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:0.4rem;">
            <button class="btn btn-sm btn-secondary btn-resend-staff" data-email="${st.email}" title="Reenviar link para definir senha">
              Reenviar Convite
            </button>
            <button class="btn btn-sm btn-ghost btn-toggle-staff" data-id="${st.id}" data-active="${st.active ? 'true' : 'false'}" title="${st.active ? 'Desativar acesso' : 'Ativar acesso'}">
              ${st.active ? 'Desativar' : 'Ativar'}
            </button>
            <button class="btn-icon btn-delete-staff" data-id="${st.id}" data-name="${st.name}" title="Excluir funcionário" style="color:var(--danger-main); padding:4px;">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach staff action listeners
    tbody.querySelectorAll('.btn-resend-staff').forEach(btn => {
      btn.addEventListener('click', async () => {
        const email = btn.getAttribute('data-email');
        await resendStaffInvite(email);
        toast.success(`E-mail com link de acesso reenviado para ${email}!`);
      });
    });

    tbody.querySelectorAll('.btn-toggle-staff').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const isActive = btn.getAttribute('data-active') === 'true';
        await toggleStaffStatus(schoolId, id, !isActive);
        toast.info(isActive ? 'Acesso do funcionário desativado.' : 'Acesso do funcionário reativado!');
        loadStaffTable();
      });
    });

    tbody.querySelectorAll('.btn-delete-staff').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        if (confirm(`Deseja realmente remover o acesso de "${name}"?`)) {
          await deleteStaff(schoolId, id);
          toast.success(`Funcionário "${name}" removido.`);
          loadStaffTable();
        }
      });
    });
  }

  // Invite Staff Modal
  container.querySelector('#btn-add-staff')?.addEventListener('click', () => {
    modal.open({
      title: 'Convidar Novo Funcionário (Bibliotecário)',
      maxWidth: '560px',
      body: `
        <p style="font-size:0.9rem; color:var(--slate-600); margin-bottom:1.25rem;">
          Informe os dados do funcionário. O sistema enviará um convite por e-mail para que ele crie sua própria senha.
        </p>

        <form id="add-staff-form">
          <div class="form-group">
            <label class="form-label" for="staff-name">Nome Completo <span class="required">*</span></label>
            <input type="text" id="staff-name" class="form-control" placeholder="ex: Carlos Santos" required />
          </div>

          <div class="form-group">
            <label class="form-label" for="staff-email">E-mail Institucional <span class="required">*</span></label>
            <input type="email" id="staff-email" class="form-control" placeholder="carlos.biblioteca@escola.gva.br" required />
            <div class="form-hint">O funcionário usará este e-mail para fazer login no sistema.</div>
          </div>

          <div class="form-group">
            <label class="form-label" for="staff-job">Função / Cargo na Biblioteca</label>
            <input type="text" id="staff-job" class="form-control" value="Bibliotecário" placeholder="ex: Bibliotecário, Auxiliar, Estagiário" />
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel-staff">Cancelar</button>
        <button class="btn btn-primary" id="modal-confirm-staff">Enviar Convite</button>
      `
    });

    document.getElementById('modal-cancel-staff')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-confirm-staff')?.addEventListener('click', async () => {
      const name = document.getElementById('staff-name')?.value.trim();
      const email = document.getElementById('staff-email')?.value.trim();
      const jobTitle = document.getElementById('staff-job')?.value.trim();

      if (!name || !email) {
        toast.warning('Nome e e-mail são obrigatórios.');
        return;
      }

      try {
        await createStaff(schoolId, { name, email, jobTitle });
        toast.success(`Funcionário "${name}" cadastrado! E-mail de convite enviado para ${email}.`);
        modal.close();
        loadStaffTable();
      } catch (err) {
        toast.error(err.message);
      }
    });
  });

  // Initial load of staff
  await loadStaffTable();
}

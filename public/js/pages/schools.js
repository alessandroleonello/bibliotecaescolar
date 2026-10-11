/**
 * Superadmin - School Management Page Controller
 */
import { listSchools, createSchool, toggleSchoolStatus, resendSchoolInvite } from '../db/schools.js';
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';

export async function renderSchoolsPage(container) {
  container.innerHTML = `
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
            Gestão de Escolas
          </h2>
          <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
            Cadastre novas escolas na plataforma e gerencie acessos institucionais.
          </p>
        </div>

        <button id="btn-add-school" class="btn btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>Nova Escola</span>
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" style="margin-bottom: 1.5rem;">
      <div class="stat-card">
        <div class="stat-icon primary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <div>
          <div class="stat-value" id="stat-active-schools">0</div>
          <div class="stat-label">Escolas Ativas</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <div class="stat-value" id="stat-inactive-schools">0</div>
          <div class="stat-label">Escola Inativa</div>
        </div>
      </div>
    </div>

    <!-- Schools Table -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Rede Escolar Cadastrada</h3>
      </div>
      <div class="table-container" style="border:none;">
        <table class="table">
          <thead>
            <tr>
              <th>Escola</th>
              <th>E-mail do Gestor</th>
              <th>Slug / Link Público</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody id="schools-table-body">
            <tr>
              <td colspan="5" style="text-align:center; padding:2rem; color:var(--slate-500);">
                <span class="spinner"></span> Carregando escolas...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  async function loadSchools() {
    try {
      const schools = await listSchools();
      const activeCount = schools.filter(s => s.status === 'active').length;
      const inactiveCount = schools.filter(s => s.status !== 'active').length;

      const activeEl = container.querySelector('#stat-active-schools');
      const inactiveEl = container.querySelector('#stat-inactive-schools');
      if (activeEl) activeEl.textContent = activeCount;
      if (inactiveEl) inactiveEl.textContent = inactiveCount;

      const tbody = container.querySelector('#schools-table-body');
      if (!tbody) return;

      if (schools.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding:3rem 1rem;">
              <div class="empty-state">
                <div class="empty-state-icon">🏫</div>
                <div class="empty-state-title">Nenhuma escola cadastrada ainda</div>
                <div class="empty-state-text">Clique no botão "Nova Escola" acima para cadastrar a primeira unidade da rede.</div>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = schools.map(s => {
        const isActive = s.status === 'active';
        return `
          <tr>
            <td>
              <div style="font-weight:700; color:var(--slate-900);">${s.name}</div>
              <div style="font-size:0.775rem; color:var(--slate-500);">ID: ${s.id}</div>
            </td>
            <td>${s.email}</td>
            <td>
              <span class="mono" style="font-size:0.8rem; background:var(--slate-100); padding:2px 6px; border-radius:4px;">
                ${s.slug || '-'}
              </span>
            </td>
            <td>
              ${isActive 
                ? '<span class="badge badge-success"><span class="badge-dot"></span> Ativa</span>' 
                : '<span class="badge badge-warning"><span class="badge-dot"></span> Inativa</span>'}
            </td>
            <td>
              <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                <button class="btn btn-sm btn-secondary btn-resend-invite" data-email="${s.email}" title="Reenviar Convite">
                  Reenviar Convite
                </button>
                <button class="btn btn-sm btn-ghost btn-copy-link" data-slug="${s.slug}" title="Copiar Link Público">
                  Copiar Link
                </button>
                <button class="btn btn-sm btn-ghost btn-toggle-status" data-id="${s.id}" data-status="${isActive ? 'inactive' : 'active'}" style="color:${isActive ? 'var(--danger-main)' : 'var(--success-main)'}">
                  ${isActive ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Actions
      tbody.querySelectorAll('.btn-resend-invite').forEach(btn => {
        btn.addEventListener('click', async () => {
          const email = btn.getAttribute('data-email');
          try {
            await resendSchoolInvite(email);
            toast.success(`Convite reenviado para ${email}!`);
          } catch (e) {
            toast.error(e.message || 'Erro ao reenviar convite.');
          }
        });
      });

      tbody.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', () => {
          const slug = btn.getAttribute('data-slug');
          const url = `${window.location.origin}/public/catalogo.html?escola=${slug}`;
          navigator.clipboard.writeText(url)
            .then(() => toast.success('Link do catálogo público copiado!'))
            .catch(() => toast.info(`Link: ${url}`));
        });
      });

      tbody.querySelectorAll('.btn-toggle-status').forEach(btn => {
        btn.addEventListener('click', async () => {
          const schoolId = btn.getAttribute('data-id');
          const newStatus = btn.getAttribute('data-status');
          try {
            await toggleSchoolStatus(schoolId, newStatus);
            toast.success(`Status da escola atualizado para ${newStatus === 'active' ? 'Ativa' : 'Inativa'}.`);
            loadSchools();
          } catch (e) {
            toast.error('Erro ao atualizar status: ' + e.message);
          }
        });
      });

    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar lista de escolas.');
    }
  }

  // Attach new school modal
  container.querySelector('#btn-add-school')?.addEventListener('click', () => {
    modal.open({
      title: 'Cadastrar Nova Escola',
      body: `
        <div class="form-group">
          <label class="form-label" for="new-school-name">Nome da Escola <span class="required">*</span></label>
          <input type="text" id="new-school-name" class="form-control" placeholder="ex: E.E. Castro Alves" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="new-school-email">E-mail do Administrador/Escola <span class="required">*</span></label>
          <input type="email" id="new-school-email" class="form-control" placeholder="biblioteca@escola.gva.br" required />
          <div class="form-hint">O gestor da escola receberá um e-mail de acesso para definir sua própria senha.</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-school-slug">Slug para Link Público (opcional)</label>
          <input type="text" id="new-school-slug" class="form-control mono" placeholder="ex: castro-alves" />
        </div>
        <div class="form-group">
          <label class="form-label" for="new-school-phone">Telefone de Contato (opcional)</label>
          <input type="text" id="new-school-phone" class="form-control" placeholder="ex: (11) 3456-7890" />
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel-school">Cancelar</button>
        <button class="btn btn-primary" id="modal-save-school">Cadastrar Escola</button>
      `
    });

    document.getElementById('modal-cancel-school')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-save-school')?.addEventListener('click', async () => {
      const name = document.getElementById('new-school-name')?.value.trim();
      const email = document.getElementById('new-school-email')?.value.trim();
      const slug = document.getElementById('new-school-slug')?.value.trim();
      const phone = document.getElementById('new-school-phone')?.value.trim();

      if (!name || !email) {
        toast.warning('Preencha o nome e o e-mail da escola.');
        return;
      }

      const saveBtn = document.getElementById('modal-save-school');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner"></span> <span>Cadastrando...</span>`;
      }

      try {
        await createSchool({ name, email, slug, phone });
        toast.success(`Escola "${name}" cadastrada com sucesso!`);
        modal.close();
        loadSchools();
      } catch (err) {
        console.error(err);
        toast.error('Erro ao cadastrar escola: ' + err.message);
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = `Cadastrar Escola`;
        }
      }
    });
  });

  // Initial load
  loadSchools();
}

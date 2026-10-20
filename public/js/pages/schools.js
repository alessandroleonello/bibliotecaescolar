/**
 * Superadmin - School Management Page Controller
 */
import { listSchools, createSchool, toggleSchoolStatus, resendSchoolInvite, setSchoolManagerPassword } from '../db/schools.js';
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
            Cadastre novas escolas na plataforma e gerencie acessos e senhas institucionais.
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
              <th>Ações de Acesso</th>
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

  // Função auxiliar para exibir tela com credenciais prontas para copiar
  function showCredentialsModal(schoolName, email, password) {
    const loginUrl = `${window.location.origin}/public/index.html#/login`;
    const message = `📚 *Acesso ao Sistema de Biblioteca Escolar*\n\nOlá! Seguem seus dados de acesso ao sistema da sua escola (*${schoolName}*):\n\n🔗 *Link de Login:* ${loginUrl}\n📧 *E-mail:* ${email}\n🔑 *Senha:* ${password}\n\nRecomendamos salvar este link nos seus favoritos!`;

    modal.open({
      title: 'Credenciais de Acesso Definidas',
      body: `
        <div style="background:var(--success-bg, #ecfdf5); border:1px solid var(--success-border, #a7f3d0); border-radius:8px; padding:1rem; margin-bottom:1.25rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; color:#065f46; font-weight:700;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Senha configurada com sucesso!</span>
          </div>
          <p style="font-size:0.875rem; color:#047857; margin-top:0.35rem;">
            A gestora da escola já pode fazer login imediatamente com os dados abaixo, sem precisar esperar nem clicar em links de e-mail.
          </p>
        </div>

        <div class="form-group">
          <label class="form-label">Link de Acesso</label>
          <input type="text" class="form-control mono" readonly value="${loginUrl}" />
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
          <div class="form-group">
            <label class="form-label">E-mail de Login</label>
            <input type="text" class="form-control mono" readonly value="${email}" />
          </div>
          <div class="form-group">
            <label class="form-label">Senha</label>
            <input type="text" class="form-control mono" style="font-weight:700; color:var(--primary-700);" readonly value="${password}" />
          </div>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-close-cred">Fechar</button>
        <button class="btn btn-primary" id="modal-copy-cred">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          <span>Copiar Mensagem para WhatsApp</span>
        </button>
      `
    });

    document.getElementById('modal-close-cred')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-copy-cred')?.addEventListener('click', () => {
      navigator.clipboard.writeText(message)
        .then(() => toast.success('Dados de acesso copiados! Pronto para colar no WhatsApp ou e-mail.'))
        .catch(() => toast.info('Copie os dados manualmente dos campos acima.'));
    });
  }

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
            <td>
              <div style="font-weight:500;">${s.email}</div>
            </td>
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
              <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
                <button class="btn btn-sm btn-primary btn-set-pwd" data-email="${s.email}" data-name="${s.name}" title="Definir nova senha diretamente sem depender de e-mail">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span>Definir Senha</span>
                </button>
                <button class="btn btn-sm btn-secondary btn-resend-invite" data-email="${s.email}" title="Reenviar E-mail de Recuperação/Convite">
                  Reenviar E-mail
                </button>
                <button class="btn btn-sm btn-ghost btn-copy-link" data-slug="${s.slug}" title="Copiar Link do Catálogo Público">
                  Link Aluno
                </button>
                <button class="btn btn-sm btn-ghost btn-toggle-status" data-id="${s.id}" data-status="${isActive ? 'inactive' : 'active'}" style="color:${isActive ? 'var(--danger-main)' : 'var(--success-main)'}">
                  ${isActive ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Ação: Definir Senha Manualmente
      tbody.querySelectorAll('.btn-set-pwd').forEach(btn => {
        btn.addEventListener('click', () => {
          const email = btn.getAttribute('data-email');
          const name = btn.getAttribute('data-name');
          const suggestedPassword = 'Escola@' + Math.floor(1000 + Math.random() * 9000);

          modal.open({
            title: `Definir Senha do Gestor`,
            body: `
              <div style="margin-bottom:1rem; font-size:0.9rem; color:var(--slate-600);">
                Defina a senha de acesso para <strong>${name}</strong> (<span class="mono">${email}</span>). A dona da escola poderá logar imediatamente!
              </div>

              <div class="form-group">
                <label class="form-label" for="manual-admin-pwd">Nova Senha de Acesso <span class="required">*</span></label>
                <div class="input-with-icon">
                  <span class="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                  <input type="text" id="manual-admin-pwd" class="form-control mono" value="${suggestedPassword}" required minlength="6" />
                </div>
                <div class="form-hint">Mínimo de 6 caracteres. Você pode usar a senha sugerida acima ou digitar uma de sua preferência.</div>
              </div>
            `,
            footer: `
              <button class="btn btn-secondary" id="modal-cancel-setpwd">Cancelar</button>
              <button class="btn btn-primary" id="modal-confirm-setpwd">
                <span>Salvar e Gerar Acesso</span>
              </button>
            `
          });

          document.getElementById('modal-cancel-setpwd')?.addEventListener('click', () => modal.close());
          document.getElementById('modal-confirm-setpwd')?.addEventListener('click', async () => {
            const newPwd = document.getElementById('manual-admin-pwd')?.value.trim();
            if (!newPwd || newPwd.length < 6) {
              toast.warning('A senha deve ter pelo menos 6 caracteres.');
              return;
            }

            const btnConfirm = document.getElementById('modal-confirm-setpwd');
            if (btnConfirm) {
              btnConfirm.disabled = true;
              btnConfirm.innerHTML = `<span class="spinner"></span> <span>Salvando...</span>`;
            }

            try {
              await setSchoolManagerPassword(email, newPwd);
              toast.success('Senha atualizada com sucesso!');
              modal.close();
              showCredentialsModal(name, email, newPwd);
            } catch (err) {
              console.error(err);
              toast.error('Erro ao definir senha: ' + (err.message || 'Verifique se o usuário existe'));
              if (btnConfirm) {
                btnConfirm.disabled = false;
                btnConfirm.innerHTML = `Salvar e Gerar Acesso`;
              }
            }
          });
        });
      });

      // Actions
      tbody.querySelectorAll('.btn-resend-invite').forEach(btn => {
        btn.addEventListener('click', async () => {
          const email = btn.getAttribute('data-email');
          try {
            await resendSchoolInvite(email);
            toast.success(`E-mail de recuperação reenviado para ${email}!`);
          } catch (e) {
            toast.error(e.message || 'Erro ao reenviar e-mail.');
          }
        });
      });

      tbody.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', () => {
          const slug = btn.getAttribute('data-slug');
          const url = `${window.location.origin}/public/catalogo.html?escola=${slug}`;
          navigator.clipboard.writeText(url)
            .then(() => toast.success('Link do catálogo copiado!'))
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
    const suggestedPassword = 'Escola@' + Math.floor(1000 + Math.random() * 9000);

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
        </div>
        <div class="form-group">
          <label class="form-label" for="new-school-password">Senha de Acesso do Gestor <span class="required">*</span></label>
          <input type="text" id="new-school-password" class="form-control mono" value="${suggestedPassword}" required minlength="6" />
          <div class="form-hint">Você pode usar a senha sugerida acima ou digitar uma personalizada. A gestora poderá logar imediatamente sem precisar de e-mail!</div>
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
      const password = document.getElementById('new-school-password')?.value.trim();
      const slug = document.getElementById('new-school-slug')?.value.trim();
      const phone = document.getElementById('new-school-phone')?.value.trim();

      if (!name || !email || !password) {
        toast.warning('Preencha nome, e-mail e senha de acesso.');
        return;
      }

      const saveBtn = document.getElementById('modal-save-school');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<span class="spinner"></span> <span>Cadastrando...</span>`;
      }

      try {
        const result = await createSchool({ name, email, slug, phone, password });
        toast.success(`Escola "${name}" cadastrada com sucesso!`);
        modal.close();
        loadSchools();
        showCredentialsModal(name, email, password);
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


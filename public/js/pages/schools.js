/**
 * Superadmin - School Management Page Controller
 */
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';

export function renderSchoolsPage(container) {
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
          <div class="stat-value">12</div>
          <div class="stat-label">Escolas Ativas</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <div class="stat-value">1</div>
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
          <tbody>
            <tr>
              <td>
                <div style="font-weight:700; color:var(--slate-900);">E.E. Professora Maria Oliveira</div>
                <div style="font-size:0.775rem; color:var(--slate-500);">ID: esc-001</div>
              </td>
              <td>diretoria@mariaoliveira.gva.br</td>
              <td><span class="mono" style="font-size:0.8rem; background:var(--slate-100); padding:2px 6px; border-radius:4px;">maria-oliveira</span></td>
              <td><span class="badge badge-success"><span class="badge-dot"></span> Ativa</span></td>
              <td>
                <div style="display:flex; gap:0.5rem;">
                  <button class="btn btn-sm btn-secondary" title="Reenviar Convite">Reenviar Convite</button>
                  <button class="btn btn-sm btn-ghost" title="Copiar Link Público">Copiar Link</button>
                </div>
              </td>
            </tr>
            <tr>
              <td>
                <div style="font-weight:700; color:var(--slate-900);">Colégio Estadual Dom Pedro II</div>
                <div style="font-size:0.775rem; color:var(--slate-500);">ID: esc-002</div>
              </td>
              <td>admin@pedrosegundo.edu.br</td>
              <td><span class="mono" style="font-size:0.8rem; background:var(--slate-100); padding:2px 6px; border-radius:4px;">dom-pedro-2</span></td>
              <td><span class="badge badge-success"><span class="badge-dot"></span> Ativa</span></td>
              <td>
                <div style="display:flex; gap:0.5rem;">
                  <button class="btn btn-sm btn-secondary" title="Reenviar Convite">Reenviar Convite</button>
                  <button class="btn btn-sm btn-ghost" title="Copiar Link Público">Copiar Link</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

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
          <div class="form-hint">A escola receberá um e-mail de redefinição de senha para criar seu próprio acesso.</div>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-school-slug">Slug para Link Público (opcional)</label>
          <input type="text" id="new-school-slug" class="form-control mono" placeholder="ex: castro-alves" />
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel-school">Cancelar</button>
        <button class="btn btn-primary" id="modal-save-school">Cadastrar Escola</button>
      `
    });

    document.getElementById('modal-cancel-school')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-save-school')?.addEventListener('click', () => {
      const name = document.getElementById('new-school-name')?.value.trim();
      const email = document.getElementById('new-school-email')?.value.trim();
      if (!name || !email) {
        toast.warning('Preencha os campos obrigatórios.');
        return;
      }
      toast.success(`Escola "${name}" cadastrada! Convite enviado para ${email}.`);
      modal.close();
    });
  });
}

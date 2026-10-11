/**
 * School Dashboard Page Controller (Connected with Live Statistics)
 */
import { getCurrentProfile } from '../auth.js';
import { listLoans } from '../db/loans.js';
import { listRequests } from '../db/requests.js';
import { router } from '../router.js';
import { isOverdue } from '../utils/dates.js';

export async function renderDashboardPage(container) {
  const profile = getCurrentProfile() || {};
  const schoolId = profile.schoolId || 'escola-modelo-01';
  const schoolName = profile.schoolName || 'E.E. Professora Maria Oliveira';

  container.innerHTML = `
    <!-- Top Greeting Banner -->
    <div style="margin-bottom: 2rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
            Olá, ${profile.name?.split(' ')[0] || 'Bibliotecário'}! 👋
          </h2>
          <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
            Painel da biblioteca de <strong>${schoolName}</strong>. Acompanhe a circulação em tempo real.
          </p>
        </div>

        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <a href="tutorial.html" target="_blank" class="btn btn-ghost" style="border: 1px solid var(--slate-200); text-decoration: none;" title="Acessar o Guia e Tutorial da Escola">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span>Tutorial da Escola</span>
          </a>
          <button id="dash-btn-loan" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-0.5-.05"/><path d="M6 2v20"/><polyline points="10 10 14 10 14 14"/></svg>
            <span>Novo Empréstimo</span>
          </button>
          <button id="dash-btn-return" class="btn btn-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            <span>Devolução</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Onboarding / Tutorial Banner -->
    <div style="background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%); border: 1px solid #c7d2fe; border-radius: var(--radius-lg); padding: 1.25rem 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: var(--primary-600); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
          📖
        </div>
        <div>
          <div style="font-weight: 800; color: var(--slate-900); font-size: 1.02rem;">
            Novo por aqui? Veja o Tutorial Completo de Implantação
          </div>
          <div style="font-size: 0.86rem; color: var(--slate-600); margin-top: 0.15rem;">
            Aprenda a configurar regras, cadastrar acervo, importar alunos do SED e operar empréstimos e devoluções.
          </div>
        </div>
      </div>
      <a href="tutorial.html" target="_blank" class="btn btn-sm btn-primary" style="text-decoration: none; flex-shrink: 0;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span>Abrir Tutorial Passo a Passo</span>
      </a>
    </div>

    <!-- Counters Grid -->
    <div class="stats-grid">
      <div class="stat-card" style="cursor:pointer;" onclick="window.location.hash='#/emprestimos'">
        <div class="stat-icon primary">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        </div>
        <div>
          <div class="stat-value" id="stat-loans-open">...</div>
          <div class="stat-label">Empréstimos Abertos</div>
        </div>
      </div>

      <div class="stat-card" style="cursor:pointer;" onclick="window.location.hash='#/emprestimos'">
        <div class="stat-icon danger">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div>
          <div class="stat-value" id="stat-loans-overdue" style="color:var(--danger-main)">...</div>
          <div class="stat-label">Empréstimos Atrasados</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon success">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <div>
          <div class="stat-value" id="stat-returns-today">...</div>
          <div class="stat-label">Devoluções Concluídas</div>
        </div>
      </div>

      <div class="stat-card" style="cursor:pointer;" onclick="window.location.hash='#/solicitacoes'">
        <div class="stat-icon warning">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </div>
        <div>
          <div class="stat-value" id="stat-requests-pending" style="color:var(--warning-main)">...</div>
          <div class="stat-label">Solicitações Pendentes</div>
        </div>
      </div>
    </div>

    <!-- Quick Shortcuts & Info Cards -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:1.5rem; margin-top:1.5rem;">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Atalhos Operacionais</h3>
        </div>
        <div class="card-body" style="display:flex; flex-direction:column; gap:0.75rem;">
          <a href="#/livros" class="btn btn-secondary" style="justify-content:flex-start;">
            <span>📚 Consultar Acervo de Livros & Cópias</span>
          </a>
          <a href="#/alunos" class="btn btn-secondary" style="justify-content:flex-start;">
            <span>🎓 Gerenciar Cadastro de Alunos</span>
          </a>
          <a href="#/importar" class="btn btn-secondary" style="justify-content:flex-start;">
            <span>📥 Assistente de Importação (Planilha SED)</span>
          </a>
          <a href="#/solicitacoes" class="btn btn-secondary" style="justify-content:flex-start;">
            <span>📬 Fila de Solicitações do Catálogo Público</span>
          </a>
          <a href="#/relatorios" class="btn btn-secondary" style="justify-content:flex-start;">
            <span>📊 Relatórios e Exportação em Excel</span>
          </a>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Catálogo Online do Aluno</h3>
          <span class="badge badge-success"><span class="badge-dot"></span> Ativo</span>
        </div>
        <div class="card-body">
          <p style="font-size:0.9rem; color:var(--slate-600); line-height:1.6;">
            O catálogo online desta escola está habilitado e acessível para os alunos realizarem consultas e solicitações públicas de empréstimo.
          </p>
          <div style="margin-top:1.25rem; padding:0.75rem 1rem; background:var(--slate-50); border-radius:var(--radius-md); border:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between;">
            <div style="overflow:hidden;">
              <div style="font-size:0.75rem; color:var(--slate-400); font-weight:600; text-transform:uppercase;">Link Público</div>
              <div class="mono" style="font-size:0.85rem; color:var(--primary-700); font-weight:600;">catalogo.html?escola=modelo</div>
            </div>
            <a href="catalogo.html?escola=modelo" target="_blank" class="btn btn-sm btn-secondary">Abrir</a>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach quick actions
  container.querySelector('#dash-btn-loan')?.addEventListener('click', () => router.navigate('/emprestimos'));
  container.querySelector('#dash-btn-return')?.addEventListener('click', () => router.navigate('/devolucoes'));

  // Load real counters
  try {
    const allLoans = await listLoans(schoolId);
    const openLoans = allLoans.filter(l => l.status === 'open');
    const overdueLoans = openLoans.filter(l => isOverdue(l.dueAt));
    const returnedLoans = allLoans.filter(l => l.status === 'returned');
    const requests = await listRequests(schoolId, 'pending');

    container.querySelector('#stat-loans-open').textContent = openLoans.length;
    container.querySelector('#stat-loans-overdue').textContent = overdueLoans.length;
    container.querySelector('#stat-returns-today').textContent = returnedLoans.length;
    container.querySelector('#stat-requests-pending').textContent = requests.length;
  } catch (e) {
    console.warn('Erro ao atualizar estatísticas:', e);
  }
}

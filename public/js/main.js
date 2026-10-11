/**
 * Main Application Bootstrapper
 */
import { router } from './router.js';
import { initAuth, getCurrentProfile, isAuthenticated, logout } from './auth.js';
import { toast } from './ui/toast.js';
import { renderLoginPage } from './pages/login.js';
import { renderDashboardPage } from './pages/dashboard.js';
import { renderSchoolsPage } from './pages/schools.js';
import { renderBooksPage } from './pages/books.js';
import { renderStudentsPage } from './pages/students.js';
import { renderImportPage } from './pages/import.js';
import { renderLoansPage } from './pages/loans.js';
import { renderReturnsPage } from './pages/returns.js';
import { renderRequestsPage } from './pages/requests.js';
import { renderReportsPage } from './pages/reports.js';
import { renderSettingsPage } from './pages/settings.js';

// Setup routes with complete controllers
router.register('/login', renderLoginPage, { requiresAuth: false, title: 'Login' });
router.register('/dashboard', renderDashboardPage, { requiresAuth: true, title: 'Painel da Biblioteca', roles: ['school_admin', 'staff'] });
router.register('/escolas', renderSchoolsPage, { requiresAuth: true, title: 'Gestão de Escolas', roles: ['superadmin'] });
router.register('/livros', renderBooksPage, { requiresAuth: true, title: 'Acervo de Livros & Cópias', roles: ['school_admin', 'staff'] });
router.register('/alunos', renderStudentsPage, { requiresAuth: true, title: 'Cadastro de Alunos', roles: ['school_admin', 'staff'] });
router.register('/importar', renderImportPage, { requiresAuth: true, title: 'Assistente de Importação SED', roles: ['school_admin', 'staff'] });
router.register('/emprestimos', renderLoansPage, { requiresAuth: true, title: 'Circulação & Empréstimos', roles: ['school_admin', 'staff'] });
router.register('/devolucoes', renderReturnsPage, { requiresAuth: true, title: 'Devolução Rápida no Balcão', roles: ['school_admin', 'staff'] });
router.register('/solicitacoes', renderRequestsPage, { requiresAuth: true, title: 'Solicitações do Catálogo Público', roles: ['school_admin', 'staff'] });
router.register('/relatorios', renderReportsPage, { requiresAuth: true, title: 'Relatórios & Estatísticas', roles: ['school_admin', 'staff'] });
router.register('/configuracoes', renderSettingsPage, { requiresAuth: true, title: 'Configurações da Escola', roles: ['school_admin'] });

// Listen for auth changes and update shell UI
function updateShellUI() {
  const authed = isAuthenticated();
  const profile = getCurrentProfile();

  const sidebar = document.getElementById('app-sidebar');
  const header = document.getElementById('app-header');
  const mainWrapper = document.getElementById('main-wrapper');

  if (!authed) {
    if (sidebar) sidebar.style.display = 'none';
    if (header) header.style.display = 'none';
    if (mainWrapper) mainWrapper.style.marginLeft = '0';
    return;
  }

  if (sidebar) sidebar.style.display = 'flex';
  if (header) header.style.display = 'flex';
  if (mainWrapper) mainWrapper.style.marginLeft = '';

  // Update user profile info in sidebar
  const userNameEl = document.getElementById('sidebar-user-name');
  const userRoleEl = document.getElementById('sidebar-user-role');
  const userAvatarEl = document.getElementById('sidebar-user-avatar');
  const schoolTagEl = document.getElementById('header-school-tag');

  if (profile) {
    if (userNameEl) userNameEl.textContent = profile.name || profile.email;
    if (userRoleEl) {
      const roleLabels = {
        superadmin: 'Superadministrador',
        school_admin: 'Gestor Escolar',
        staff: 'Bibliotecário'
      };
      userRoleEl.textContent = roleLabels[profile.role] || profile.role;
    }
    if (userAvatarEl) {
      userAvatarEl.textContent = (profile.name || profile.email || 'U').charAt(0).toUpperCase();
    }
    if (schoolTagEl) {
      schoolTagEl.textContent = profile.role === 'superadmin' ? 'Plataforma Global' : (profile.schoolName || 'Escola Ativa');
    }
  }

  // Render navigation menu items according to role
  renderNavMenu(profile?.role);
}

function renderNavMenu(role) {
  const navContainer = document.getElementById('sidebar-nav-list');
  if (!navContainer) return;

  if (role === 'superadmin') {
    navContainer.innerHTML = `
      <div class="nav-section-title">Administração</div>
      <a href="#/escolas" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Escolas</span>
      </a>
    `;
  } else {
    navContainer.innerHTML = `
      <div class="nav-section-title">Principal</div>
      <a href="#/dashboard" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
        <span>Início</span>
      </a>

      <div class="nav-section-title">Circulação</div>
      <a href="#/emprestimos" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-0.5-.05"/><path d="M6 2v20"/><polyline points="10 10 14 10 14 14"/></svg>
        <span>Empréstimos</span>
      </a>
      <a href="#/devolucoes" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        <span>Devoluções</span>
      </a>
      <a href="#/solicitacoes" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        <span>Solicitações</span>
      </a>

      <div class="nav-section-title">Cadastros</div>
      <a href="#/livros" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
        <span>Livros & Cópias</span>
      </a>
      <a href="#/alunos" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Alunos</span>
      </a>
      <a href="#/importar" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Importar SED</span>
      </a>

      <div class="nav-section-title">Gestão</div>
      <a href="#/relatorios" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        <span>Relatórios</span>
      </a>
      <a href="#/configuracoes" class="nav-item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Configurações</span>
      </a>
    `;
  }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('app-sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      toast.info('Você saiu da sua conta.');
      router.navigate('/login');
    });
  }

  router.init('page-content');
  router.setBeforeNavigate(() => {
    updateShellUI();
    if (sidebar) sidebar.classList.remove('open');
  });

  initAuth(() => {
    updateShellUI();
    router.handleRoute();
  });
});

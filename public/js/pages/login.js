/**
 * Login Page Controller
 */
import { login, resetPassword, DEMO_USERS, setDemoSession } from '../auth.js';
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';
import { router } from '../router.js';
import { getActiveSupabaseConfig, saveSupabaseConfig } from '../supabase-config.js';

export function renderLoginPage(container) {
  const currentConfig = getActiveSupabaseConfig();
  const isDemo = currentConfig.anonKey.includes('DEMO-KEY') || currentConfig.url.includes('xyzcompany');

  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo-badge">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-0.5-.05"/>
              <path d="M6 2v20"/>
              <path d="M10 7h6"/>
              <path d="M10 11h6"/>
            </svg>
          </div>
          <h1 class="auth-title">Biblioteca Escolar</h1>
          <p class="auth-subtitle">Acesso ao sistema de gestão de acervo e empréstimos</p>
        </div>

        <div class="auth-body">
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-email">E-mail institucional</label>
              <div class="input-with-icon">
                <span class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 16 0c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </span>
                <input type="email" id="login-email" class="form-control" placeholder="exemplo@escola.edu.br" required autocomplete="email" />
              </div>
            </div>

            <div class="form-group">
              <div class="form-label">
                <label for="login-password">Senha de acesso</label>
                <button type="button" id="btn-forgot-password" class="btn-ghost" style="padding:0;font-size:0.8rem;color:var(--primary-600)">Esqueceu a senha?</button>
              </div>
              <div class="input-with-icon">
                <span class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input type="password" id="login-password" class="form-control" placeholder="••••••••" required autocomplete="current-password" />
              </div>
            </div>

            <button type="submit" id="btn-login-submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem;">
              <span>Entrar no sistema</span>
            </button>
          </form>

          <!-- Quick Test / Demo Accounts Section -->
          <div class="demo-pills">
            <div class="demo-pills-title">🚀 Teste Rápido (Ambiente de Demonstração):</div>
            <div class="demo-chips">
              <button class="demo-chip" data-role="superadmin">👑 Superadmin</button>
              <button class="demo-chip" data-role="school_admin">🏫 Gestor Escolar</button>
              <button class="demo-chip" data-role="staff">📖 Bibliotecário</button>
            </div>
            <div style="font-size:0.72rem; color:var(--slate-500); margin-top:0.4rem;">
              Clique em um perfil para login imediato sem necessidade de senha.
            </div>
          </div>

          <div class="auth-footer-help">
            <button type="button" id="btn-config-supabase" class="btn-ghost" style="font-size: 0.8rem;">
              ⚡ Configurar chaves do Supabase
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  const form = container.querySelector('#login-form');
  const submitBtn = container.querySelector('#btn-login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = container.querySelector('#login-email').value.trim();
    const password = container.querySelector('#login-password').value;

    if (!email || !password) {
      toast.warning('Por favor preencha todos os campos.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner"></span> <span>Entrando...</span>`;

    try {
      const result = await login(email, password);
      toast.success(`Bem-vindo, ${result.profile?.name || result.user.email}!`);
      if (result.profile?.role === 'superadmin') {
        router.navigate('/escolas');
      } else {
        router.navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Falha ao autenticar. Verifique e-mail e senha.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Entrar no sistema</span>`;
    }
  });

  // Quick Demo click buttons
  container.querySelectorAll('.demo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const role = chip.getAttribute('data-role');
      const demoUser = DEMO_USERS[role];
      if (demoUser) {
        setDemoSession(role);
        toast.success(`Entrando como ${demoUser.name} (${role})`);
        if (role === 'superadmin') {
          router.navigate('/escolas');
        } else {
          router.navigate('/dashboard');
        }
      }
    });
  });

  // Forgot password
  container.querySelector('#btn-forgot-password').addEventListener('click', () => {
    modal.open({
      title: 'Recuperar Senha',
      body: `
        <p style="font-size:0.9rem;color:var(--slate-600);margin-bottom:1rem;">
          Digite o e-mail cadastrado para receber o link de redefinição de senha:
        </p>
        <div class="form-group">
          <label class="form-label" for="reset-email">E-mail</label>
          <input type="email" id="reset-email" class="form-control" placeholder="exemplo@escola.edu.br" required />
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-reset-confirm">Enviar Link</button>
      `
    });

    document.getElementById('modal-cancel')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-reset-confirm')?.addEventListener('click', async () => {
      const email = document.getElementById('reset-email')?.value.trim();
      if (!email) {
        toast.warning('Informe um e-mail válido.');
        return;
      }
      try {
        await resetPassword(email);
        toast.success('E-mail de recuperação enviado com sucesso!');
        modal.close();
      } catch (e) {
        toast.error('Erro ao enviar e-mail: ' + e.message);
      }
    });
  });

  // Supabase Config modal
  container.querySelector('#btn-config-supabase').addEventListener('click', () => {
    const cfg = getActiveSupabaseConfig();
    modal.open({
      title: 'Configuração do Supabase',
      body: `
        <p style="font-size:0.875rem;color:var(--slate-600);margin-bottom:1rem;">
          Conecte sua base de dados Supabase em segundos. Obtenha essas credenciais no menu <strong>Project Settings -> API</strong> do painel Supabase.
        </p>
        <div class="form-group">
          <label class="form-label" for="cfg-url">Project URL</label>
          <input type="url" id="cfg-url" class="form-control" placeholder="https://xxxxxxxx.supabase.co" value="${cfg.url || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label" for="cfg-anon-key">Project Anon Key (public)</label>
          <textarea id="cfg-anon-key" class="form-control mono" rows="4" style="font-size:0.8rem" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...">${cfg.anonKey || ''}</textarea>
        </div>
        <div style="background:var(--primary-50); border:1px solid var(--primary-200); border-radius:var(--radius-sm); padding:0.75rem; font-size:0.8rem; color:var(--primary-900);">
          💡 <strong>Keep-alive 100% Gratuito:</strong> Para evitar que o banco seja pausado após 7 dias de inatividade no plano gratuito, nosso projeto inclui uma Action automática no GitHub que mantém a base acordada sem custos.
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-cfg-cancel">Cancelar</button>
        <button class="btn btn-primary" id="modal-cfg-save">Salvar Credenciais</button>
      `
    });

    document.getElementById('modal-cfg-cancel')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-cfg-save')?.addEventListener('click', () => {
      const url = document.getElementById('cfg-url')?.value.trim();
      const anonKey = document.getElementById('cfg-anon-key')?.value.trim();
      if (!url || !anonKey) {
        toast.warning('Preencha a URL e a Anon Key do Supabase.');
        return;
      }
      try {
        saveSupabaseConfig({ url, anonKey });
        toast.success('Configurações do Supabase salvas! Recarregando...');
        setTimeout(() => window.location.reload(), 1000);
      } catch (e) {
        toast.error('Erro ao salvar: ' + e.message);
      }
    });
  });
}

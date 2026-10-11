/**
 * Login Page Controller
 */
import { login, resetPassword } from '../auth.js';
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';
import { router } from '../router.js';

export function renderLoginPage(container) {
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

          <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--slate-200); text-align: center;">
            <p style="font-size: 0.82rem; color: var(--slate-500); margin-bottom: 0.6rem;">
              Primeira vez na gestão da biblioteca?
            </p>
            <a href="tutorial.html" class="btn btn-secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-decoration: none;" title="Acessar o passo a passo de configuração e uso da escola">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <span>Tutorial & Guia de Implantação</span>
            </a>
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
}

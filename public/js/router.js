/**
 * Hash-based SPA Router with Role Guards
 */
import { isAuthenticated, getCurrentProfile } from './auth.js';

class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.outlet = null;
    this.beforeNavigate = null;
  }

  init(outletId = 'page-content') {
    this.outlet = document.getElementById(outletId);
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  register(path, handler, options = {}) {
    this.routes[path] = {
      handler,
      requiresAuth: options.requiresAuth !== false,
      roles: options.roles || null,
      title: options.title || 'Biblioteca Escolar'
    };
  }

  setBeforeNavigate(callback) {
    this.beforeNavigate = callback;
  }

  navigate(path) {
    window.location.hash = path.startsWith('#') ? path : `#${path}`;
  }

  async handleRoute() {
    const rawHash = window.location.hash.slice(1) || '/login';
    const [path] = rawHash.split('?');
    const route = this.routes[path] || this.routes['*'] || this.routes['/dashboard'];

    if (!route) {
      this.navigate('/login');
      return;
    }

    const auth = isAuthenticated();
    const profile = getCurrentProfile();

    // Guard: requires auth
    if (route.requiresAuth && !auth) {
      this.navigate('/login');
      return;
    }

    // Guard: already authenticated on login
    if (path === '/login' && auth) {
      if (profile?.role === 'superadmin') {
        this.navigate('/escolas');
      } else {
        this.navigate('/dashboard');
      }
      return;
    }

    // Guard: role check
    if (route.roles && route.roles.length > 0) {
      if (!profile || !route.roles.includes(profile.role)) {
        console.warn(`Acesso negado para a rota ${path} com papel ${profile?.role}`);
        this.navigate(profile?.role === 'superadmin' ? '/escolas' : '/dashboard');
        return;
      }
    }

    if (this.beforeNavigate) {
      this.beforeNavigate({ path, route, profile });
    }

    this.currentRoute = path;
    
    // Update active nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      const href = el.getAttribute('href');
      if (href === `#${path}`) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update Header title
    const titleEl = document.getElementById('header-page-title');
    if (titleEl) {
      titleEl.textContent = route.title;
    }

    if (this.outlet) {
      this.outlet.innerHTML = '';
      await route.handler(this.outlet);
    }
  }
}

export const router = new Router();

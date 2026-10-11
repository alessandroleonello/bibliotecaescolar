/**
 * Modal Dialog Controller
 */
class ModalManager {
  constructor() {
    this.overlay = null;
    this.dialog = null;
    this.titleEl = null;
    this.bodyEl = null;
    this.footerEl = null;
    this.closeBtn = null;
    this.isInitialized = false;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.init());
    } else {
      this.init();
    }
  }

  init() {
    if (this.isInitialized && this.dialog) return;
    if (!document.body) return;

    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'modal-overlay';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }

    // Garante que o conteúdo interno do modal esteja presente mesmo se o elemento já existia no HTML
    if (!overlay.querySelector('.modal-dialog')) {
      overlay.innerHTML = `
        <div class="modal-dialog" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-title">Título</h3>
            <button class="btn-icon modal-close-btn" aria-label="Fechar" type="button">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="modal-body" id="modal-body"></div>
          <div class="modal-footer" id="modal-footer"></div>
        </div>
      `;
    }

    this.overlay = overlay;
    this.dialog = overlay.querySelector('.modal-dialog');
    this.titleEl = overlay.querySelector('#modal-title');
    this.bodyEl = overlay.querySelector('#modal-body');
    this.footerEl = overlay.querySelector('#modal-footer');
    this.closeBtn = overlay.querySelector('.modal-close-btn');

    if (this.closeBtn) {
      this.closeBtn.onclick = () => this.close();
    }

    this.overlay.onclick = (e) => {
      if (e.target === this.overlay) this.close();
    };

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    this.isInitialized = true;
  }

  open({ title, body, footer = null, maxWidth = '560px' }) {
    this.init();
    if (!this.overlay || !this.dialog) return;

    if (this.titleEl) {
      this.titleEl.textContent = title || '';
    }
    this.dialog.style.maxWidth = maxWidth;

    if (this.bodyEl) {
      if (typeof body === 'string') {
        this.bodyEl.innerHTML = body;
      } else if (body instanceof HTMLElement) {
        this.bodyEl.innerHTML = '';
        this.bodyEl.appendChild(body);
      }
    }

    if (this.footerEl) {
      if (footer) {
        this.footerEl.style.display = 'flex';
        if (typeof footer === 'string') {
          this.footerEl.innerHTML = footer;
        } else if (footer instanceof HTMLElement) {
          this.footerEl.innerHTML = '';
          this.footerEl.appendChild(footer);
        }
      } else {
        this.footerEl.style.display = 'none';
        this.footerEl.innerHTML = '';
      }
    }

    this.overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (!this.overlay) return;
    this.overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  isOpen() {
    return this.overlay && this.overlay.classList.contains('open');
  }
}

export const modal = new ModalManager();

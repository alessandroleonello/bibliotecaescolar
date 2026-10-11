/**
 * Books & Copies Management Page Controller
 */
import { listBooks, getBook, saveBook, fetchBookByISBN } from '../db/books.js';
import { listCopies, generateCopies, addManualCopies, updateCopy, updateCopyStatus, deleteCopy } from '../db/copies.js';
import { listCategories, addCategory, updateCategory, deleteCategory } from '../db/schools.js';
import { getCurrentProfile } from '../auth.js';
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';
import { printElement } from '../utils/barcode.js';

export async function renderBooksPage(container) {
  const profile = getCurrentProfile();
  const schoolId = profile?.schoolId || 'escola-modelo-01';

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
            Acervo de Livros
          </h2>
          <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
            Cadastre títulos, gerencie categorias personalizadas e controle os exemplares físicos da escola.
          </p>
        </div>

        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <button id="btn-manage-categories" class="btn btn-secondary">
            🏷️ Categorias
          </button>
          <button id="btn-new-book" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Cadastrar Novo Livro</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Filter and Search Bar -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem 1.25rem;">
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center; justify-content:space-between;">
        <div class="input-with-icon" style="flex:1; min-width:260px;">
          <span class="input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input type="text" id="books-search-input" class="form-control" placeholder="Buscar por título, autor, ISBN, tombo ou categoria..." />
        </div>

        <div style="display:flex; gap:0.5rem;">
          <button id="btn-refresh-books" class="btn btn-secondary btn-icon" title="Atualizar lista">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Books Table -->
    <div class="card">
      <div class="table-container" style="border:none;">
        <table class="table" id="books-table">
          <thead>
            <tr>
              <th>Livro</th>
              <th>Categoria</th>
              <th>ISBN</th>
              <th>Localização</th>
              <th>Exemplares</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody id="books-tbody">
            <tr><td colspan="6" style="text-align:center; padding:2rem;"><span class="spinner"></span> Carregando acervo...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  async function loadTable(search = '') {
    const tbody = container.querySelector('#books-tbody');
    const books = await listBooks(schoolId, search);

    if (books.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:3rem 1rem;">
            <div class="empty-state" style="padding:0;">
              <div class="empty-state-icon">📚</div>
              <div class="empty-state-title">Nenhum livro encontrado</div>
              <div class="empty-state-text">Cadastre o primeiro exemplar ou tente uma busca diferente.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = books.map(book => {
      const avail = book.availableCopies || 0;
      const total = book.totalCopies || 0;
      const badgeClass = avail > 0 ? 'badge-success' : 'badge-danger';
      const badgeLabel = avail > 0 ? `${avail} de ${total} disponíveis` : 'Sem cópias disponíveis';

      return `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:0.875rem;">
              <div style="width:36px; height:48px; border-radius:4px; background:var(--primary-100); color:var(--primary-700); display:flex; align-items:center; justify-content:center; font-weight:bold; flex-shrink:0;">
                ${book.coverUrl ? `<img src="${book.coverUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" />` : '📖'}
              </div>
              <div>
                <div style="font-weight:700; color:var(--slate-900); font-size:0.95rem;">${book.title}</div>
                <div style="font-size:0.8rem; color:var(--slate-500);">${(book.authors || []).join(', ')} • ${book.publisher || 'Editora não informada'}</div>
              </div>
            </div>
          </td>
          <td><span class="badge badge-neutral">${book.category || 'Geral'}</span></td>
          <td><span class="mono" style="font-size:0.825rem;">${book.isbn || '-'}</span></td>
          <td><span style="font-size:0.85rem; color:var(--slate-600);">${book.shelfLocation || '-'}</span></td>
          <td>
            <span class="badge ${badgeClass}"><span class="badge-dot"></span> ${badgeLabel}</span>
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:0.4rem;">
              <button class="btn btn-sm btn-secondary btn-copies" data-id="${book.id}" title="Gerenciar exemplares e tombos">
                🏷️ Exemplares / Tombos
              </button>
              <button class="btn btn-sm btn-ghost btn-edit-book" data-id="${book.id}" title="Editar livro">
                ✏️ Editar
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row listeners
    tbody.querySelectorAll('.btn-copies').forEach(btn => {
      btn.addEventListener('click', () => openCopiesModal(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-edit-book').forEach(btn => {
      btn.addEventListener('click', () => openBookModal(btn.getAttribute('data-id')));
    });
  }

  // Search input debounce
  const searchInput = container.querySelector('#books-search-input');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadTable(searchInput.value), 250);
  });

  container.querySelector('#btn-refresh-books').addEventListener('click', () => loadTable(searchInput.value));
  container.querySelector('#btn-new-book').addEventListener('click', () => openBookModal());
  container.querySelector('#btn-manage-categories').addEventListener('click', () => openCategoriesModal());

  // Categories CRUD Modal
  async function openCategoriesModal() {
    const categories = await listCategories(schoolId);
    const books = await listBooks(schoolId);

    // Count books per category
    const countMap = {};
    books.forEach(b => {
      const cat = b.category || 'Outros';
      countMap[cat] = (countMap[cat] || 0) + 1;
    });

    modal.open({
      title: 'Gerenciar Categorias de Livros',
      maxWidth: '650px',
      body: `
        <!-- Add New Category Form -->
        <div style="background:var(--slate-50); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem; margin-bottom:1.5rem;">
          <div style="font-size:0.85rem; font-weight:700; color:var(--slate-800); margin-bottom:0.5rem;">
            ➕ Adicionar Nova Categoria
          </div>
          <div style="display:flex; gap:0.5rem;">
            <input type="text" id="new-category-name" class="form-control" placeholder="ex: Mangás, Filosofia, Robótica..." />
            <button type="button" id="btn-save-new-category" class="btn btn-primary" style="white-space:nowrap;">
              Adicionar
            </button>
          </div>
        </div>

        <div style="font-weight:700; font-size:0.9rem; color:var(--slate-800); margin-bottom:0.5rem;">
          Categorias Ativas da Escola (${categories.length})
        </div>

        <div class="table-container" style="max-height:350px; overflow-y:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Nome da Categoria</th>
                <th>Livros Vinculados</th>
                <th style="text-align:right;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map(cat => {
                const bookCount = countMap[cat] || 0;
                return `
                  <tr>
                    <td>
                      <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-weight:600; color:var(--slate-900); font-size:0.95rem;">${cat}</span>
                        <button class="btn-icon btn-rename-cat" data-name="${cat}" title="Renomear categoria" style="padding:2px;">
                          ✏️
                        </button>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${bookCount > 0 ? 'badge-info' : 'badge-neutral'}">
                        ${bookCount} livro(s)
                      </span>
                    </td>
                    <td style="text-align:right;">
                      <button class="btn-icon btn-delete-cat" data-name="${cat}" data-count="${bookCount}" title="Excluir categoria" style="color:var(--danger-main); padding:4px;">
                        🗑️
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('open')">Fechar</button>
      `
    });

    // Add Category
    document.getElementById('btn-save-new-category')?.addEventListener('click', async () => {
      const input = document.getElementById('new-category-name');
      const val = input?.value.trim();
      if (!val) {
        toast.warning('Informe o nome da nova categoria.');
        return;
      }
      try {
        await addCategory(schoolId, val);
        toast.success(`Categoria "${val}" adicionada!`);
        openCategoriesModal();
        loadTable(searchInput.value);
      } catch (err) {
        toast.error(err.message);
      }
    });

    // Rename Category
    document.querySelectorAll('.btn-rename-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const oldName = btn.getAttribute('data-name');
        const newName = prompt(`Informe o novo nome para a categoria "${oldName}":`, oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
          try {
            await updateCategory(schoolId, oldName, newName.trim());
            toast.success(`Categoria renomeada para "${newName.trim()}"! Livros atualizados.`);
            openCategoriesModal();
            loadTable(searchInput.value);
          } catch (err) {
            toast.error(err.message);
          }
        }
      });
    });

    // Delete Category
    document.querySelectorAll('.btn-delete-cat').forEach(btn => {
      btn.addEventListener('click', async () => {
        const name = btn.getAttribute('data-name');
        const count = parseInt(btn.getAttribute('data-count') || '0');
        const warning = count > 0 ? ` Existem ${count} livro(s) usando esta categoria, que passarão para "Outros".` : '';
        if (confirm(`Deseja realmente excluir a categoria "${name}"?${warning}`)) {
          try {
            await deleteCategory(schoolId, name);
            toast.success(`Categoria "${name}" excluída.`);
            openCategoriesModal();
            loadTable(searchInput.value);
          } catch (err) {
            toast.error(err.message);
          }
        }
      });
    });
  }

  // Book Edit/Create Modal
  async function openBookModal(bookId = null) {
    let book = null;
    if (bookId) {
      book = await getBook(schoolId, bookId);
    }

    const categories = await listCategories(schoolId);

    modal.open({
      title: book ? 'Editar Livro' : 'Cadastrar Novo Livro',
      maxWidth: '680px',
      body: `
        <!-- ISBN Quick Fill -->
        <div style="background:var(--slate-50); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:0.875rem; margin-bottom:1.25rem;">
          <div style="font-size:0.825rem; font-weight:700; color:var(--slate-700); margin-bottom:0.35rem;">
            🔍 Preenchimento Automático por ISBN (Google Books API)
          </div>
          <div style="display:flex; gap:0.5rem;">
            <input type="text" id="isbn-search-input" class="form-control mono" placeholder="Digite o ISBN (ex: 9788520933114)" value="${book?.isbn || ''}" />
            <button type="button" id="btn-fetch-isbn" class="btn btn-secondary">Buscar</button>
          </div>
        </div>

        <form id="book-form">
          <div class="form-group">
            <label class="form-label" for="book-title">Título da Obra <span class="required">*</span></label>
            <input type="text" id="book-title" class="form-control" value="${book?.title || ''}" required />
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="book-authors">Autores <span class="required">*</span></label>
              <input type="text" id="book-authors" class="form-control" placeholder="Separados por vírgula" value="${(book?.authors || []).join(', ')}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="book-publisher">Editora</label>
              <input type="text" id="book-publisher" class="form-control" value="${book?.publisher || ''}" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <div class="form-label">
                <span>Categoria</span>
                <button type="button" id="btn-quick-new-cat" class="btn-ghost" style="padding:0; font-size:0.75rem; color:var(--primary-600);" title="Cadastrar nova categoria">+ Nova</button>
              </div>
              <select id="book-category" class="form-control">
                ${categories.map(c => `
                  <option value="${c}" ${book?.category === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="book-year">Ano de Publicação</label>
              <input type="number" id="book-year" class="form-control" value="${book?.year || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="book-shelf">Localização na Estante</label>
              <input type="text" id="book-shelf" class="form-control" placeholder="ex: E02-P01" value="${book?.shelfLocation || ''}" />
            </div>
          </div>

          ${!book ? `
            <!-- Copies Input Mode -->
            <div style="margin-top:0.5rem; background:var(--primary-50); padding:1rem; border-radius:var(--radius-md); border:1px solid var(--primary-200);">
              <div style="font-weight:700; font-size:0.9rem; color:var(--primary-900); margin-bottom:0.5rem;">
                📦 Cadastro de Exemplares / Tombos
              </div>
              
              <div style="display:flex; gap:1.25rem; margin-bottom:0.75rem;">
                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; cursor:pointer;">
                  <input type="radio" name="copy-mode" value="manual" checked />
                  <span><strong>Digitar tombos próprios da escola</strong> (ex: etiquetas já existentes)</span>
                </label>
                <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; cursor:pointer;">
                  <input type="radio" name="copy-mode" value="auto" />
                  <span>Gerar códigos sequenciais</span>
                </label>
              </div>

              <!-- Manual Mode Fields -->
              <div id="copy-mode-manual-fields">
                <label class="form-label" style="font-size:0.8rem; color:var(--primary-800);">
                  Tombos dos exemplares (separe por vírgula ou quebra de linha):
                </label>
                <textarea id="manual-copies-input" class="form-control mono" rows="2" placeholder="ex: 1042, 1043, 1044 ou TOMBO-01, TOMBO-02"></textarea>
                <div class="form-hint" style="color:var(--primary-700);">
                  Cada código inserido criará uma cópia com tombo correspondente.
                </div>
              </div>

              <!-- Auto Mode Fields -->
              <div id="copy-mode-auto-fields" style="display:none;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem;">
                  <div>
                    <label class="form-label" style="font-size:0.8rem;">Quantidade de cópias</label>
                    <input type="number" id="auto-copies-qty" class="form-control" value="2" min="1" max="50" />
                  </div>
                  <div>
                    <label class="form-label" style="font-size:0.8rem;">Prefixo do código</label>
                    <input type="text" id="auto-copies-prefix" class="form-control mono" value="TMB-" />
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="form-group" style="margin-top:1rem;">
            <label class="form-label" for="book-synopsis">Sinopse</label>
            <textarea id="book-synopsis" class="form-control" rows="3">${book?.synopsis || ''}</textarea>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel-book">Cancelar</button>
        <button class="btn btn-primary" id="modal-save-book">${book ? 'Salvar Alterações' : 'Cadastrar Livro'}</button>
      `
    });

    // Quick add new category from inside book modal
    document.getElementById('btn-quick-new-cat')?.addEventListener('click', async () => {
      const catName = prompt('Digite o nome da nova categoria de livros:');
      if (catName && catName.trim()) {
        try {
          await addCategory(schoolId, catName.trim());
          const select = document.getElementById('book-category');
          if (select) {
            const opt = document.createElement('option');
            opt.value = catName.trim();
            opt.textContent = catName.trim();
            opt.selected = true;
            select.appendChild(opt);
          }
          toast.success(`Categoria "${catName.trim()}" criada!`);
        } catch (err) {
          toast.error(err.message);
        }
      }
    });

    // Toggle copy mode visibility
    const manualFields = document.getElementById('copy-mode-manual-fields');
    const autoFields = document.getElementById('copy-mode-auto-fields');
    document.querySelectorAll('input[name="copy-mode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.value === 'manual') {
          if (manualFields) manualFields.style.display = 'block';
          if (autoFields) autoFields.style.display = 'none';
        } else {
          if (manualFields) manualFields.style.display = 'none';
          if (autoFields) autoFields.style.display = 'block';
        }
      });
    });

    // Handle ISBN fetch button
    document.getElementById('btn-fetch-isbn')?.addEventListener('click', async () => {
      const isbnVal = document.getElementById('isbn-search-input')?.value;
      if (!isbnVal) {
        toast.warning('Digite um ISBN.');
        return;
      }
      const btn = document.getElementById('btn-fetch-isbn');
      btn.disabled = true;
      btn.textContent = 'Buscando...';
      try {
        const info = await fetchBookByISBN(isbnVal);
        document.getElementById('book-title').value = info.title;
        document.getElementById('book-authors').value = info.authors.join(', ');
        document.getElementById('book-publisher').value = info.publisher;
        if (info.year) document.getElementById('book-year').value = info.year;
        if (info.synopsis) document.getElementById('book-synopsis').value = info.synopsis;
        toast.success('Dados preenchidos via Google Books!');
      } catch (err) {
        toast.error(err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Buscar';
      }
    });

    document.getElementById('modal-cancel-book')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-save-book')?.addEventListener('click', async () => {
      const title = document.getElementById('book-title')?.value.trim();
      const authorsStr = document.getElementById('book-authors')?.value.trim();
      if (!title || !authorsStr) {
        toast.warning('Título e autores são obrigatórios.');
        return;
      }

      const authors = authorsStr.split(',').map(a => a.trim()).filter(Boolean);
      const bookData = {
        title,
        authors,
        publisher: document.getElementById('book-publisher')?.value.trim() || '',
        isbn: document.getElementById('isbn-search-input')?.value.trim() || '',
        category: document.getElementById('book-category')?.value || 'Geral',
        year: document.getElementById('book-year')?.value ? parseInt(document.getElementById('book-year').value) : null,
        shelfLocation: document.getElementById('book-shelf')?.value.trim() || '',
        synopsis: document.getElementById('book-synopsis')?.value.trim() || ''
      };

      try {
        const saved = await saveBook(schoolId, bookData, bookId);

        // Process initial copies if new
        if (!book) {
          const selectedMode = document.querySelector('input[name="copy-mode"]:checked')?.value;
          if (selectedMode === 'manual') {
            const manualRaw = document.getElementById('manual-copies-input')?.value || '';
            const manualCodes = manualRaw.split(/[\n,;]+/).map(c => c.trim()).filter(Boolean);
            if (manualCodes.length > 0) {
              await addManualCopies(schoolId, saved.id, manualCodes.map(code => ({ code, condition: 'Bom' })));
            }
          } else if (selectedMode === 'auto') {
            const qty = parseInt(document.getElementById('auto-copies-qty')?.value || '1');
            const prefix = document.getElementById('auto-copies-prefix')?.value || 'TMB-';
            if (qty > 0) {
              await generateCopies(schoolId, saved.id, qty, { prefix });
            }
          }
        }

        toast.success(`Livro "${title}" salvo com sucesso!`);
        modal.close();
        loadTable(searchInput.value);
      } catch (err) {
        toast.error(err.message);
      }
    });
  }

  // Manage Copies & Tombos Modal
  async function openCopiesModal(bookId) {
    const book = await getBook(schoolId, bookId);
    if (!book) return;

    const copies = await listCopies(schoolId, bookId);

    modal.open({
      title: `Exemplares & Tombos: ${book.title}`,
      maxWidth: '820px',
      body: `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem; margin-bottom:1.25rem;">
          <div>
            <div style="font-size:0.85rem; color:var(--slate-500);">
              Total de Cópias: <strong>${copies.length}</strong> • Disponíveis: <strong>${copies.filter(c => c.status === 'available').length}</strong>
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button id="btn-print-labels" class="btn btn-secondary btn-sm">
              🖨️ Imprimir Todas as Etiquetas
            </button>
            <button id="btn-add-manual-copy" class="btn btn-primary btn-sm">
              ➕ Cadastrar Tombo Manual
            </button>
            <button id="btn-add-more-copies" class="btn btn-secondary btn-sm">
              ⚡ Gerar Sequencial
            </button>
          </div>
        </div>

        <div class="table-container" style="max-height:380px; overflow-y:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Código (Tombo da Escola)</th>
                <th>Status</th>
                <th>Estado</th>
                <th>Observações</th>
                <th style="text-align:right;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${copies.length === 0 ? `
                <tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--slate-500);">Nenhum exemplar cadastrado ainda. Adicione o tombo da escola acima.</td></tr>
              ` : copies.map(c => `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                      <span class="mono" style="font-weight:700; color:var(--primary-700); font-size:0.95rem;">${c.code}</span>
                      <button class="btn-icon btn-edit-tombo" data-id="${c.id}" data-code="${c.code}" title="Alterar código/tombo" style="padding:2px;">
                        ✏️
                      </button>
                    </div>
                  </td>
                  <td>
                    <select class="form-control select-copy-status" data-copy-id="${c.id}" style="padding:2px 8px; font-size:0.8rem; width:auto;">
                      <option value="available" ${c.status === 'available' ? 'selected' : ''}>Disponível</option>
                      <option value="loaned" ${c.status === 'loaned' ? 'selected' : ''}>Emprestado</option>
                      <option value="damaged" ${c.status === 'damaged' ? 'selected' : ''}>Danificado</option>
                      <option value="lost" ${c.status === 'lost' ? 'selected' : ''}>Perdido</option>
                    </select>
                  </td>
                  <td>
                    <select class="form-control select-copy-cond" data-copy-id="${c.id}" style="padding:2px 8px; font-size:0.8rem; width:auto;">
                      <option value="Novo" ${c.condition === 'Novo' ? 'selected' : ''}>Novo</option>
                      <option value="Excelente" ${c.condition === 'Excelente' ? 'selected' : ''}>Excelente</option>
                      <option value="Bom" ${c.condition === 'Bom' || !c.condition ? 'selected' : ''}>Bom</option>
                      <option value="Regular" ${c.condition === 'Regular' ? 'selected' : ''}>Regular</option>
                      <option value="Danificado" ${c.condition === 'Danificado' ? 'selected' : ''}>Danificado</option>
                    </select>
                  </td>
                  <td>
                    <span style="font-size:0.8rem; color:var(--slate-500);">${c.notes || '-'}</span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex; gap:0.25rem;">
                      <button class="btn-icon btn-delete-copy" data-id="${c.id}" data-code="${c.code}" data-status="${c.status}" title="Excluir exemplar" style="color:var(--danger-main); padding:4px;">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `,
      footer: `
        <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('open')">Fechar</button>
      `
    });

    // Change status / condition
    document.querySelectorAll('.select-copy-status').forEach(sel => {
      sel.addEventListener('change', async () => {
        const copyId = sel.getAttribute('data-copy-id');
        await updateCopyStatus(schoolId, copyId, sel.value);
        toast.success('Status atualizado!');
        loadTable(searchInput.value);
      });
    });

    document.querySelectorAll('.select-copy-cond').forEach(sel => {
      sel.addEventListener('change', async () => {
        const copyId = sel.getAttribute('data-copy-id');
        await updateCopy(schoolId, copyId, { condition: sel.value });
        toast.success('Estado de conservação atualizado!');
      });
    });

    // Edit Tombo code button
    document.querySelectorAll('.btn-edit-tombo').forEach(btn => {
      btn.addEventListener('click', async () => {
        const copyId = btn.getAttribute('data-id');
        const currentCode = btn.getAttribute('data-code');
        const newCode = prompt(`Informe o novo código/tombo para o exemplar atual (${currentCode}):`, currentCode);
        if (newCode && newCode.trim() && newCode.trim().toUpperCase() !== currentCode.toUpperCase()) {
          try {
            await updateCopy(schoolId, copyId, { code: newCode.trim() });
            toast.success(`Tombo alterado para "${newCode.trim()}"!`);
            openCopiesModal(bookId);
            loadTable(searchInput.value);
          } catch (err) {
            toast.error(err.message);
          }
        }
      });
    });

    // Delete copy button
    document.querySelectorAll('.btn-delete-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const copyId = btn.getAttribute('data-id');
        const code = btn.getAttribute('data-code');
        const status = btn.getAttribute('data-status');
        if (status === 'loaned') {
          toast.warning('Não é possível excluir um exemplar atualmente emprestado!');
          return;
        }
        if (confirm(`Deseja realmente excluir o exemplar com tombo "${code}"?`)) {
          try {
            await deleteCopy(schoolId, copyId);
            toast.success(`Exemplar "${code}" excluído!`);
            openCopiesModal(bookId);
            loadTable(searchInput.value);
          } catch (err) {
            toast.error(err.message);
          }
        }
      });
    });

    // Add manual copy modal
    document.getElementById('btn-add-manual-copy')?.addEventListener('click', () => {
      const codeStr = prompt('Digite o código ou tombo da escola para este novo exemplar (ou vários separados por vírgula):');
      if (codeStr && codeStr.trim()) {
        const codes = codeStr.split(/[\n,;]+/).map(c => c.trim()).filter(Boolean);
        addManualCopies(schoolId, bookId, codes.map(c => ({ code: c, condition: 'Bom' })))
          .then((created) => {
            toast.success(`${created.length} exemplar(es) cadastrado(s) com sucesso!`);
            openCopiesModal(bookId);
            loadTable(searchInput.value);
          })
          .catch(err => toast.error(err.message));
      }
    });

    // Add auto copies
    document.getElementById('btn-add-more-copies')?.addEventListener('click', async () => {
      const qtyStr = prompt('Quantos novos exemplares sequenciais deseja gerar?', '1');
      const qty = parseInt(qtyStr);
      if (qty && qty > 0) {
        await generateCopies(schoolId, bookId, qty);
        toast.success(`${qty} exemplar(es) gerado(s)!`);
        openCopiesModal(bookId);
        loadTable(searchInput.value);
      }
    });

    // Print labels
    document.getElementById('btn-print-labels')?.addEventListener('click', () => {
      const labelsHtml = copies.map(c => `
        <div class="label-card">
          <div class="label-school">BIBLIOTECA ESCOLAR</div>
          <div class="label-title">${book.title}</div>
          <svg class="barcode-target" data-code="${c.code}"></svg>
          <div class="label-code">${c.code}</div>
        </div>
      `).join('');

      printElement(labelsHtml, `Etiquetas - ${book.title}`);
    });
  }

  // Initial load
  await loadTable();
}

/**
 * Reports and Statistics Page Controller
 */
import { listLoans } from '../db/loans.js';
import { listBooks } from '../db/books.js';
import { getCurrentProfile } from '../auth.js';
import { exportToXLSX } from '../utils/xlsx.js';
import { formatDate, isOverdue, daysBetween } from '../utils/dates.js';
import { printElement } from '../utils/barcode.js';

export async function renderReportsPage(container) {
  const profile = getCurrentProfile();
  const schoolId = profile?.schoolId || 'escola-modelo-01';

  let currentTab = 'overdue';

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
        Relatórios & Estatísticas
      </h2>
      <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
        Exportação de dados em Excel (.xlsx), relatórios de inadimplência e circulação do acervo.
      </p>
    </div>

    <!-- Navigation Tabs -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 0.75rem 1rem;">
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button id="rep-tab-overdue" class="btn btn-sm btn-primary">⚠️ Empréstimos Atrasados</button>
        <button id="rep-tab-ranking" class="btn btn-sm btn-secondary">🏆 Livros Mais Emprestados</button>
        <button id="rep-tab-categories" class="btn btn-sm btn-secondary">📊 Acervo por Categoria</button>
        <button id="rep-tab-all" class="btn btn-sm btn-secondary">📜 Histórico Geral</button>
      </div>
    </div>

    <!-- Report Content Outlet -->
    <div id="report-content"></div>
  `;

  const reportArea = container.querySelector('#report-content');

  async function loadActiveReport() {
    if (currentTab === 'overdue') await renderOverdueReport();
    else if (currentTab === 'ranking') await renderRankingReport();
    else if (currentTab === 'categories') await renderCategoriesReport();
    else if (currentTab === 'all') await renderAllLoansReport();
  }

  // 1. Overdue Report
  async function renderOverdueReport() {
    const loans = await listLoans(schoolId, { status: 'open' });
    const overdueLoans = loans.filter(l => isOverdue(l.dueAt));

    reportArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Relatório de Empréstimos em Atraso</h3>
            <div style="font-size:0.85rem; color:var(--slate-500);">${overdueLoans.length} empréstimo(s) fora do prazo de devolução</div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button id="btn-export-overdue" class="btn btn-sm btn-secondary">
              📥 Exportar Excel (.xlsx)
            </button>
            <button id="btn-print-overdue" class="btn btn-sm btn-secondary">
              🖨️ Imprimir
            </button>
          </div>
        </div>

        <div class="table-container" style="border:none;">
          <table class="table" id="overdue-table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Série</th>
                <th>Livro</th>
                <th>Tombo</th>
                <th>Data Retirada</th>
                <th>Vencimento</th>
                <th>Dias de Atraso</th>
              </tr>
            </thead>
            <tbody>
              ${overdueLoans.length === 0 ? `
                <tr><td colspan="7" style="text-align:center; padding:2.5rem; color:var(--slate-500);">🎉 Não há empréstimos em atraso no momento!</td></tr>
              ` : overdueLoans.map(l => {
                const days = daysBetween(new Date(), new Date(l.dueAt));
                return `
                  <tr>
                    <td><strong>${l.snapshot?.studentName}</strong></td>
                    <td>${l.snapshot?.grade || '-'}</td>
                    <td>${l.snapshot?.bookTitle}</td>
                    <td class="mono">${l.snapshot?.copyCode}</td>
                    <td>${formatDate(l.loanedAt)}</td>
                    <td style="color:var(--danger-main); font-weight:700;">${formatDate(l.dueAt)}</td>
                    <td><span class="badge badge-danger">${days} dias</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    reportArea.querySelector('#btn-export-overdue')?.addEventListener('click', () => {
      const exportData = overdueLoans.map(l => ({
        'Nome do Aluno': l.snapshot?.studentName,
        'Série': l.snapshot?.grade,
        'Título do Livro': l.snapshot?.bookTitle,
        'Código da Cópia': l.snapshot?.copyCode,
        'Data Retirada': formatDate(l.loanedAt),
        'Data Vencimento': formatDate(l.dueAt),
        'Dias de Atraso': daysBetween(new Date(), new Date(l.dueAt))
      }));
      exportToXLSX(exportData, `atrasos_biblioteca_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Atrasados');
    });

    reportArea.querySelector('#btn-print-overdue')?.addEventListener('click', () => {
      const html = reportArea.querySelector('#overdue-table').outerHTML;
      printElement(html, 'Relatório de Atrasos');
    });
  }

  // 2. Ranking Report
  async function renderRankingReport() {
    const loans = await listLoans(schoolId);
    const countMap = {};

    loans.forEach(l => {
      const title = l.snapshot?.bookTitle || 'Desconhecido';
      countMap[title] = (countMap[title] || 0) + 1;
    });

    const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]);

    reportArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Livros Mais Retirados para Empréstimo</h3>
        </div>
        <div class="table-container" style="border:none;">
          <table class="table">
            <thead>
              <tr>
                <th>Posição</th>
                <th>Título da Obra</th>
                <th>Total de Empréstimos Registrados</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(([title, count], idx) => `
                <tr>
                  <td><strong>#${idx + 1}</strong></td>
                  <td>${title}</td>
                  <td><span class="badge badge-info">${count} vezes</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 3. Categories Report
  async function renderCategoriesReport() {
    const books = await listBooks(schoolId);
    const catMap = {};

    books.forEach(b => {
      const cat = b.category || 'Geral';
      catMap[cat] = (catMap[cat] || 0) + (b.totalCopies || 1);
    });

    reportArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Distribuição do Acervo por Categoria</h3>
        </div>
        <div class="table-container" style="border:none;">
          <table class="table">
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Quantidade Total de Exemplares Físicos</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(catMap).map(([cat, qty]) => `
                <tr>
                  <td><strong>${cat}</strong></td>
                  <td>${qty} exemplares</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // 4. All Loans Report
  async function renderAllLoansReport() {
    const loans = await listLoans(schoolId);

    reportArea.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Histórico Geral de Empréstimos</h3>
            <div style="font-size:0.85rem; color:var(--slate-500);">${loans.length} registros no histórico</div>
          </div>
          <button id="btn-export-all" class="btn btn-sm btn-secondary">
            📥 Exportar Todos (.xlsx)
          </button>
        </div>
        <div class="table-container" style="border:none; max-height:450px; overflow-y:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Aluno</th>
                <th>Livro</th>
                <th>Retirada</th>
                <th>Devolução</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${loans.map(l => `
                <tr>
                  <td>${l.snapshot?.studentName}</td>
                  <td>${l.snapshot?.bookTitle}</td>
                  <td>${formatDate(l.loanedAt)}</td>
                  <td>${l.returnedAt ? formatDate(l.returnedAt) : `Prazo: ${formatDate(l.dueAt)}`}</td>
                  <td>
                    <span class="badge ${l.status === 'returned' ? 'badge-success' : (isOverdue(l.dueAt) ? 'badge-danger' : 'badge-warning')}">
                      ${l.status === 'returned' ? 'Devolvido' : (isOverdue(l.dueAt) ? 'Atrasado' : 'Aberto')}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    reportArea.querySelector('#btn-export-all')?.addEventListener('click', () => {
      const data = loans.map(l => ({
        'Aluno': l.snapshot?.studentName,
        'Livro': l.snapshot?.bookTitle,
        'Tombo': l.snapshot?.copyCode,
        'Data Retirada': formatDate(l.loanedAt),
        'Data Devolução': l.returnedAt ? formatDate(l.returnedAt) : '-',
        'Status': l.status
      }));
      exportToXLSX(data, 'historico_completo_biblioteca.xlsx', 'Histórico');
    });
  }

  // Tab bindings
  const tabs = [
    { id: 'rep-tab-overdue', key: 'overdue' },
    { id: 'rep-tab-ranking', key: 'ranking' },
    { id: 'rep-tab-categories', key: 'categories' },
    { id: 'rep-tab-all', key: 'all' }
  ];

  tabs.forEach(t => {
    container.querySelector(`#${t.id}`).addEventListener('click', () => {
      currentTab = t.key;
      tabs.forEach(o => {
        container.querySelector(`#${o.id}`).className = `btn btn-sm ${o.key === currentTab ? 'btn-primary' : 'btn-secondary'}`;
      });
      loadActiveReport();
    });
  });

  await loadActiveReport();
}

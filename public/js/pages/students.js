/**
 * Students Management Page Controller
 */
import { listStudents, getStudent, saveStudent } from '../db/students.js';
import { listLoans } from '../db/loans.js';
import { getCurrentProfile } from '../auth.js';
import { toast } from '../ui/toast.js';
import { modal } from '../ui/modal.js';
import { formatDate } from '../utils/dates.js';

export async function renderStudentsPage(container) {
  const profile = getCurrentProfile();
  const schoolId = profile?.schoolId || 'escola-modelo-01';

  container.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
        <div>
          <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
            Cadastro de Alunos
          </h2>
          <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
            Consulte matrículas, histórico de leituras e cadastre novos estudantes.
          </p>
        </div>

        <div style="display:flex; gap:0.75rem;">
          <a href="#/importar" class="btn btn-secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Importar Planilha SED</span>
          </a>
          <button id="btn-new-student" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Novo Aluno</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="card" style="margin-bottom: 1.5rem; padding: 1rem 1.25rem;">
      <div style="display:flex; gap:1rem; flex-wrap:wrap; align-items:center;">
        <div class="input-with-icon" style="flex:1; min-width:260px;">
          <span class="input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <input type="text" id="students-search-input" class="form-control" placeholder="Buscar por nome do aluno ou número do RA..." />
        </div>

        <select id="students-grade-filter" class="form-control" style="width:auto; min-width:160px;">
          <option value="">Todas as Séries</option>
          <option value="6º ano">6º ano</option>
          <option value="7º ano">7º ano</option>
          <option value="8º ano">8º ano</option>
          <option value="9º ano">9º ano</option>
          <option value="1º EM">1º ano EM</option>
          <option value="2º EM">2º ano EM</option>
          <option value="3º EM">3º ano EM</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="card">
      <div class="table-container" style="border:none;">
        <table class="table">
          <thead>
            <tr>
              <th>Aluno</th>
              <th>RA Completo</th>
              <th>Série / Turma</th>
              <th>Turno</th>
              <th>Status</th>
              <th style="text-align:right;">Ações</th>
            </tr>
          </thead>
          <tbody id="students-tbody">
            <tr><td colspan="6" style="text-align:center; padding:2rem;"><span class="spinner"></span> Carregando alunos...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  async function loadTable(search = '', grade = '') {
    const tbody = container.querySelector('#students-tbody');
    const students = await listStudents(schoolId, search, grade);

    if (students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:3rem 1rem;">
            <div class="empty-state" style="padding:0;">
              <div class="empty-state-icon">🎓</div>
              <div class="empty-state-title">Nenhum aluno encontrado</div>
              <div class="empty-state-text">Cadastre um estudante ou faça a importação da planilha da SED.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = students.map(s => `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--slate-900); font-size:0.95rem;">${s.name}</div>
          <div style="font-size:0.775rem; color:var(--slate-400);">Origem: ${s.source === 'import' ? 'Planilha SED' : 'Manual'}</div>
        </td>
        <td>
          <span class="mono" style="font-weight:700; color:var(--primary-700);">${s.ra}-${s.raDigit || '0'}</span>
        </td>
        <td>${s.grade || '-'} ${s.classroom ? `(${s.classroom})` : ''}</td>
        <td>${s.shift || 'Integral'}</td>
        <td>
          <span class="badge ${s.active ? 'badge-success' : 'badge-danger'}">
            <span class="badge-dot"></span> ${s.active ? 'Ativo' : 'Inativo'}
          </span>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex; gap:0.4rem;">
            <button class="btn btn-sm btn-secondary btn-history-student" data-id="${s.id}" title="Ver histórico de empréstimos">
              📜 Histórico
            </button>
            <button class="btn btn-sm btn-ghost btn-edit-student" data-id="${s.id}" title="Editar aluno">
              ✏️ Editar
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-history-student').forEach(btn => {
      btn.addEventListener('click', () => openHistoryModal(btn.getAttribute('data-id')));
    });

    tbody.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', () => openStudentModal(btn.getAttribute('data-id')));
    });
  }

  // Filters
  const searchInput = container.querySelector('#students-search-input');
  const gradeFilter = container.querySelector('#students-grade-filter');
  
  const triggerFilter = () => loadTable(searchInput.value, gradeFilter.value);
  searchInput.addEventListener('input', triggerFilter);
  gradeFilter.addEventListener('change', triggerFilter);

  container.querySelector('#btn-new-student').addEventListener('click', () => openStudentModal());

  // Edit / Create Modal
  async function openStudentModal(studentId = null) {
    let student = null;
    if (studentId) {
      student = await getStudent(schoolId, studentId);
    }

    modal.open({
      title: student ? 'Editar Aluno' : 'Cadastrar Aluno',
      maxWidth: '560px',
      body: `
        <form id="student-form">
          <div class="form-group">
            <label class="form-label" for="student-name">Nome Completo <span class="required">*</span></label>
            <input type="text" id="student-name" class="form-control" value="${student?.name || ''}" required />
          </div>

          <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="student-ra">Número do RA <span class="required">*</span></label>
              <input type="text" id="student-ra" class="form-control mono" placeholder="ex: 12345678" value="${student?.ra || ''}" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="student-ra-digit">Dígito</label>
              <input type="text" id="student-ra-digit" class="form-control mono" maxlength="2" placeholder="ex: X" value="${student?.raDigit || ''}" />
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:1rem;">
            <div class="form-group">
              <label class="form-label" for="student-grade">Série / Ano</label>
              <input type="text" id="student-grade" class="form-control" placeholder="ex: 8º ano" value="${student?.grade || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="student-class">Turma</label>
              <input type="text" id="student-class" class="form-control" placeholder="ex: Turma A" value="${student?.classroom || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="student-shift">Turno</label>
              <select id="student-shift" class="form-control">
                <option value="Manhã" ${student?.shift === 'Manhã' ? 'selected' : ''}>Manhã</option>
                <option value="Tarde" ${student?.shift === 'Tarde' ? 'selected' : ''}>Tarde</option>
                <option value="Noite" ${student?.shift === 'Noite' ? 'selected' : ''}>Noite</option>
                <option value="Integral" ${student?.shift === 'Integral' ? 'selected' : ''}>Integral</option>
              </select>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-secondary" id="modal-cancel-student">Cancelar</button>
        <button class="btn btn-primary" id="modal-save-student">${student ? 'Salvar Alterações' : 'Cadastrar Aluno'}</button>
      `
    });

    document.getElementById('modal-cancel-student')?.addEventListener('click', () => modal.close());
    document.getElementById('modal-save-student')?.addEventListener('click', async () => {
      const name = document.getElementById('student-name')?.value.trim();
      const ra = document.getElementById('student-ra')?.value.trim();
      if (!name || !ra) {
        toast.warning('Nome e RA são campos obrigatórios.');
        return;
      }

      await saveStudent(schoolId, {
        name,
        ra,
        raDigit: document.getElementById('student-ra-digit')?.value.trim(),
        grade: document.getElementById('student-grade')?.value.trim() || 'Geral',
        classroom: document.getElementById('student-class')?.value.trim() || '',
        shift: document.getElementById('student-shift')?.value || 'Manhã',
        active: true
      }, studentId);

      toast.success(`Aluno "${name}" salvo com sucesso!`);
      modal.close();
      triggerFilter();
    });
  }

  // Reading History Modal
  async function openHistoryModal(studentId) {
    const student = await getStudent(schoolId, studentId);
    if (!student) return;

    const loans = await listLoans(schoolId, { studentId });

    modal.open({
      title: `Histórico de Leitura: ${student.name}`,
      maxWidth: '650px',
      body: `
        <div style="margin-bottom:1rem; padding:0.75rem 1rem; background:var(--slate-50); border-radius:var(--radius-md); font-size:0.875rem;">
          RA: <strong class="mono">${student.ra}-${student.raDigit || '0'}</strong> • Série: <strong>${student.grade}</strong> • Total de Empréstimos: <strong>${loans.length}</strong>
        </div>

        ${loans.length === 0 ? `
          <div class="empty-state" style="padding:2rem 0;">
            <div class="empty-state-title">Nenhum empréstimo registrado</div>
            <div class="empty-state-text">Este estudante ainda não realizou empréstimos no sistema.</div>
          </div>
        ` : `
          <div class="table-container" style="max-height:300px; overflow-y:auto;">
            <table class="table">
              <thead>
                <tr>
                  <th>Obra</th>
                  <th>Data Retirada</th>
                  <th>Previsão / Devolução</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${loans.map(l => `
                  <tr>
                    <td>
                      <div style="font-weight:600;">${l.snapshot?.bookTitle}</div>
                      <div class="mono" style="font-size:0.75rem; color:var(--slate-400);">${l.snapshot?.copyCode}</div>
                    </td>
                    <td>${formatDate(l.loanedAt)}</td>
                    <td>${l.returnedAt ? formatDate(l.returnedAt) : formatDate(l.dueAt)}</td>
                    <td>
                      <span class="badge ${l.status === 'returned' ? 'badge-success' : 'badge-warning'}">
                        ${l.status === 'returned' ? 'Devolvido' : 'Em Aberto'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      `,
      footer: `<button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('open')">Fechar</button>`
    });
  }

  await loadTable();
}

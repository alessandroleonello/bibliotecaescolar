/**
 * SED Spreadsheet Import Wizard Controller (4-step flow)
 */
import { parseSpreadsheet, exportToXLSX } from '../utils/xlsx.js';
import { importStudentsBatch } from '../db/students.js';
import { getCurrentProfile } from '../auth.js';
import { toast } from '../ui/toast.js';
import { router } from '../router.js';

export function renderImportPage(container) {
  const profile = getCurrentProfile();
  const schoolId = profile?.schoolId || 'escola-modelo-01';

  let currentStep = 1;
  let rawHeaders = [];
  let rawRows = [];
  let columnMapping = {
    name: '',
    ra: '',
    raDigit: '',
    grade: '',
    classroom: '',
    shift: ''
  };
  let processedData = [];
  let errorRows = [];

  function renderWizard() {
    container.innerHTML = `
      <div style="margin-bottom: 2rem;">
        <h2 style="font-size:1.6rem; font-weight:800; color:var(--slate-900); letter-spacing:-0.02em;">
          Assistente de Importação de Alunos (SED)
        </h2>
        <p style="color:var(--slate-500); font-size:0.95rem; margin-top:0.25rem;">
          Importe e atualize as matrículas dos alunos em lote a partir da planilha oficial da Secretaria Escolar Digital.
        </p>
      </div>

      <!-- Steps Indicator -->
      <div style="display:flex; justify-content:space-between; margin-bottom:2rem; position:relative;">
        <div style="position:absolute; top:18px; left:5%; right:5%; height:2px; background:var(--slate-200); z-index:1;"></div>
        
        <div style="display:flex; flex-direction:column; align-items:center; position:relative; z-index:2;">
          <div style="width:36px; height:36px; border-radius:50%; background:${currentStep >= 1 ? 'var(--primary-600)' : 'var(--slate-200)'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold;">1</div>
          <span style="font-size:0.8rem; font-weight:600; margin-top:0.35rem; color:${currentStep === 1 ? 'var(--primary-700)' : 'var(--slate-500)'};">Upload do Arquivo</span>
        </div>

        <div style="display:flex; flex-direction:column; align-items:center; position:relative; z-index:2;">
          <div style="width:36px; height:36px; border-radius:50%; background:${currentStep >= 2 ? 'var(--primary-600)' : 'var(--slate-200)'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold;">2</div>
          <span style="font-size:0.8rem; font-weight:600; margin-top:0.35rem; color:${currentStep === 2 ? 'var(--primary-700)' : 'var(--slate-500)'};">Mapear Colunas</span>
        </div>

        <div style="display:flex; flex-direction:column; align-items:center; position:relative; z-index:2;">
          <div style="width:36px; height:36px; border-radius:50%; background:${currentStep >= 3 ? 'var(--primary-600)' : 'var(--slate-200)'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold;">3</div>
          <span style="font-size:0.8rem; font-weight:600; margin-top:0.35rem; color:${currentStep === 3 ? 'var(--primary-700)' : 'var(--slate-500)'};">Pré-visualização</span>
        </div>

        <div style="display:flex; flex-direction:column; align-items:center; position:relative; z-index:2;">
          <div style="width:36px; height:36px; border-radius:50%; background:${currentStep >= 4 ? 'var(--primary-600)' : 'var(--slate-200)'}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold;">4</div>
          <span style="font-size:0.8rem; font-weight:600; margin-top:0.35rem; color:${currentStep === 4 ? 'var(--primary-700)' : 'var(--slate-500)'};">Conclusão</span>
        </div>
      </div>

      <!-- Step Content Area -->
      <div id="step-content"></div>
    `;

    const stepArea = container.querySelector('#step-content');

    if (currentStep === 1) renderStep1(stepArea);
    else if (currentStep === 2) renderStep2(stepArea);
    else if (currentStep === 3) renderStep3(stepArea);
    else if (currentStep === 4) renderStep4(stepArea);
  }

  // STEP 1: Upload
  function renderStep1(el) {
    el.innerHTML = `
      <div class="card" style="padding: 2.5rem; text-align:center;">
        <div style="border: 2px dashed var(--primary-300); background: var(--primary-50); border-radius:var(--radius-lg); padding:3rem 1.5rem; cursor:pointer;" id="drop-zone">
          <div style="font-size:3rem; margin-bottom:1rem;">📂</div>
          <h3 style="font-size:1.2rem; font-weight:700; color:var(--primary-900); margin-bottom:0.5rem;">
            Selecione ou arraste a planilha da SED
          </h3>
          <p style="font-size:0.9rem; color:var(--primary-700); max-width:420px; margin:0 auto 1.5rem;">
            Formatos suportados: <strong>.xlsx, .xls, .csv</strong> exportados do sistema da SED.
          </p>
          <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none;" />
          <button type="button" class="btn btn-primary" onclick="document.getElementById('file-input').click()">
            Procurar Arquivo no Computador
          </button>
        </div>

        <div style="margin-top:2rem; text-align:left; background:var(--slate-50); padding:1rem 1.25rem; border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
          <div style="font-weight:700; font-size:0.85rem; color:var(--slate-800); margin-bottom:0.35rem;">💡 Dica sobre o processo:</div>
          <ul style="font-size:0.8rem; color:var(--slate-600); line-height:1.6; list-style:disc; margin-left:1.25rem;">
            <li>O sistema realiza <strong>upsert por RA</strong>: alunos que já existem têm seus dados e turma atualizados, e novos alunos são inseridos automaticamente.</li>
            <li>O histórico anterior de empréstimos do aluno é preservado intacto.</li>
          </ul>
        </div>
      </div>
    `;

    const dropZone = el.querySelector('#drop-zone');
    const fileInput = el.querySelector('#file-input');

    const handleFile = async (file) => {
      if (!file) return;
      try {
        toast.info('Processando planilha...');
        const result = await parseSpreadsheet(file);
        rawHeaders = result.headers;
        rawRows = result.rows;
        toast.success(`${rawRows.length} linhas carregadas!`);
        currentStep = 2;
        renderWizard();
      } catch (err) {
        toast.error(err.message);
      }
    };

    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary-600)'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--primary-300)'; });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      handleFile(e.dataTransfer.files[0]);
    });
  }

  // STEP 2: Column Mapping
  function renderStep2(el) {
    // Intelligent auto-detection of column names
    const matchHeader = (keywords) => {
      for (const h of rawHeaders) {
        const lower = h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (keywords.some(k => lower.includes(k))) return h;
      }
      return '';
    };

    if (!columnMapping.name) columnMapping.name = matchHeader(['nome', 'aluno', 'estudante']);
    if (!columnMapping.ra) columnMapping.ra = matchHeader(['ra', 'matricula', 'registro']);
    if (!columnMapping.raDigit) columnMapping.raDigit = matchHeader(['digito', 'dig', 'dg']);
    if (!columnMapping.grade) columnMapping.grade = matchHeader(['serie', 'ano', 'etapa', 'ciclo']);
    if (!columnMapping.classroom) columnMapping.classroom = matchHeader(['turma', 'classe']);
    if (!columnMapping.shift) columnMapping.shift = matchHeader(['turno', 'periodo']);

    const selectOptions = (currentVal) => `
      <option value="">-- Não mapear --</option>
      ${rawHeaders.map(h => `<option value="${h}" ${h === currentVal ? 'selected' : ''}>${h}</option>`).join('')}
    `;

    el.innerHTML = `
      <div class="card" style="padding: 2rem;">
        <h3 style="font-size:1.15rem; font-weight:700; color:var(--slate-900); margin-bottom:0.5rem;">
          Mapeamento das Colunas da Planilha
        </h3>
        <p style="font-size:0.875rem; color:var(--slate-500); margin-bottom:1.5rem;">
          O sistema sugeriu automaticamente as colunas identificadas. Confirme ou ajuste a correspondência abaixo:
        </p>

        <form id="mapping-form" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
          <div class="form-group">
            <label class="form-label">Nome do Aluno <span class="required">*</span></label>
            <select class="form-control" id="map-name">${selectOptions(columnMapping.name)}</select>
          </div>

          <div class="form-group">
            <label class="form-label">Número do RA <span class="required">*</span></label>
            <select class="form-control" id="map-ra">${selectOptions(columnMapping.ra)}</select>
          </div>

          <div class="form-group">
            <label class="form-label">Dígito do RA</label>
            <select class="form-control" id="map-digit">${selectOptions(columnMapping.raDigit)}</select>
          </div>

          <div class="form-group">
            <label class="form-label">Série / Ano Escolar</label>
            <select class="form-control" id="map-grade">${selectOptions(columnMapping.grade)}</select>
          </div>

          <div class="form-group">
            <label class="form-label">Turma / Letra</label>
            <select class="form-control" id="map-classroom">${selectOptions(columnMapping.classroom)}</select>
          </div>

          <div class="form-group">
            <label class="form-label">Turno (Manhã/Tarde/Noite)</label>
            <select class="form-control" id="map-shift">${selectOptions(columnMapping.shift)}</select>
          </div>
        </form>

        <div style="display:flex; justify-content:space-between; margin-top:2rem; pt:1rem; border-top:1px solid var(--border-subtle);">
          <button class="btn btn-secondary" id="btn-back-1">Voltar</button>
          <button class="btn btn-primary" id="btn-next-2">Validar e Pré-visualizar ➜</button>
        </div>
      </div>
    `;

    el.querySelector('#btn-back-1').addEventListener('click', () => {
      currentStep = 1;
      renderWizard();
    });

    el.querySelector('#btn-next-2').addEventListener('click', () => {
      columnMapping.name = el.querySelector('#map-name').value;
      columnMapping.ra = el.querySelector('#map-ra').value;
      columnMapping.raDigit = el.querySelector('#map-digit').value;
      columnMapping.grade = el.querySelector('#map-grade').value;
      columnMapping.classroom = el.querySelector('#map-classroom').value;
      columnMapping.shift = el.querySelector('#map-shift').value;

      if (!columnMapping.name || !columnMapping.ra) {
        toast.warning('As colunas de Nome e RA são obrigatórias!');
        return;
      }

      // Process and validate rows
      processedData = [];
      errorRows = [];

      rawRows.forEach((r, idx) => {
        const nameVal = r[columnMapping.name];
        const raVal = r[columnMapping.ra];

        if (!nameVal || !raVal) {
          errorRows.push({ row: idx + 2, reason: 'Nome ou RA em branco', raw: r });
          return;
        }

        processedData.push({
          name: nameVal,
          ra: raVal,
          raDigit: columnMapping.raDigit ? r[columnMapping.raDigit] : '',
          grade: columnMapping.grade ? r[columnMapping.grade] : 'Não informada',
          classroom: columnMapping.classroom ? r[columnMapping.classroom] : '',
          shift: columnMapping.shift ? r[columnMapping.shift] : 'Integral'
        });
      });

      currentStep = 3;
      renderWizard();
    });
  }

  // STEP 3: Preview & Validation
  function renderStep3(el) {
    el.innerHTML = `
      <div class="card" style="padding: 2rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; margin-bottom:1.5rem;">
          <div>
            <h3 style="font-size:1.15rem; font-weight:700; color:var(--slate-900);">
              Pré-visualização dos Dados
            </h3>
            <p style="font-size:0.875rem; color:var(--slate-500);">
              Verifique os primeiros registros antes de confirmar a importação para o banco de dados.
            </p>
          </div>

          <div style="display:flex; gap:0.75rem;">
            <span class="badge badge-success" style="font-size:0.85rem; padding:0.4rem 0.8rem;">
              ✅ ${processedData.length} Válidas
            </span>
            ${errorRows.length > 0 ? `
              <span class="badge badge-danger" style="font-size:0.85rem; padding:0.4rem 0.8rem;">
                ⚠️ ${errorRows.length} Linhas com Erro
              </span>
            ` : ''}
          </div>
        </div>

        <div class="table-container" style="max-height:380px; overflow-y:auto; margin-bottom:1.5rem;">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nome do Aluno</th>
                <th>RA</th>
                <th>Dígito</th>
                <th>Série / Ano</th>
                <th>Turma</th>
                <th>Turno</th>
              </tr>
            </thead>
            <tbody>
              ${processedData.slice(0, 15).map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${p.name}</strong></td>
                  <td class="mono">${p.ra}</td>
                  <td class="mono">${p.raDigit || '-'}</td>
                  <td>${p.grade}</td>
                  <td>${p.classroom || '-'}</td>
                  <td>${p.shift}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${processedData.length > 15 ? `<div style="font-size:0.8rem; color:var(--slate-500); text-align:center; margin-bottom:1rem;">Exibindo 15 de ${processedData.length} registros...</div>` : ''}

        <div style="display:flex; justify-content:space-between; pt:1rem; border-top:1px solid var(--border-subtle);">
          <button class="btn btn-secondary" id="btn-back-2">Voltar</button>
          <button class="btn btn-primary" id="btn-confirm-import">
            Confirmar e Sincronizar Alunos (${processedData.length})
          </button>
        </div>
      </div>
    `;

    el.querySelector('#btn-back-2').addEventListener('click', () => {
      currentStep = 2;
      renderWizard();
    });

    el.querySelector('#btn-confirm-import').addEventListener('click', async () => {
      const btn = el.querySelector('#btn-confirm-import');
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Gravando registros...`;

      try {
        await importStudentsBatch(schoolId, processedData);
        toast.success('Importação finalizada com sucesso!');
        currentStep = 4;
        renderWizard();
      } catch (err) {
        toast.error('Erro ao importar: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = `Confirmar e Sincronizar`;
      }
    });
  }

  // STEP 4: Conclusion
  function renderStep4(el) {
    el.innerHTML = `
      <div class="card" style="padding: 3rem 2rem; text-align:center;">
        <div style="width:64px; height:64px; border-radius:50%; background:var(--success-bg); color:var(--success-main); display:inline-flex; align-items:center; justify-content:center; font-size:2rem; margin-bottom:1.25rem;">
          ✓
        </div>
        <h3 style="font-size:1.4rem; font-weight:800; color:var(--slate-900); margin-bottom:0.5rem;">
          Importação Concluída com Sucesso!
        </h3>
        <p style="font-size:0.95rem; color:var(--slate-600); max-width:480px; margin:0 auto 1.5rem;">
          Foram processados e sincronizados <strong>${processedData.length} alunos</strong> na base da sua escola.
        </p>

        ${errorRows.length > 0 ? `
          <div style="margin-bottom:1.5rem;">
            <button class="btn btn-secondary btn-sm" id="btn-download-errors">
              📥 Baixar Relatório de Erros (${errorRows.length} linhas descartadas)
            </button>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:center; gap:1rem;">
          <button class="btn btn-secondary" id="btn-new-import">Importar Outro Arquivo</button>
          <a href="#/alunos" class="btn btn-primary">Ver Lista de Alunos</a>
        </div>
      </div>
    `;

    el.querySelector('#btn-new-import').addEventListener('click', () => {
      currentStep = 1;
      rawHeaders = [];
      rawRows = [];
      processedData = [];
      errorRows = [];
      renderWizard();
    });

    el.querySelector('#btn-download-errors')?.addEventListener('click', () => {
      exportToXLSX(errorRows, 'erros_importacao_sed.xlsx', 'Erros');
    });
  }

  renderWizard();
}

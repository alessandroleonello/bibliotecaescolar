/**
 * Excel and CSV processing via SheetJS (xlsx) CDN
 */
import { loadScript } from './barcode.js';

const SHEETJS_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

export async function ensureSheetJS() {
  if (window.XLSX) return;
  await loadScript(SHEETJS_CDN);
}

/**
 * Reads a spreadsheet file and returns an array of row objects
 */
export async function parseSpreadsheet(file) {
  await ensureSheetJS();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        if (!json || json.length < 2) {
          throw new Error('A planilha está vazia ou não possui cabeçalho.');
        }

        const headers = json[0].map(h => String(h).trim());
        const rows = [];

        for (let i = 1; i < json.length; i++) {
          const rowData = json[i];
          // Skip completely empty rows
          if (rowData.every(cell => cell === '' || cell === null || cell === undefined)) continue;

          const rowObj = {};
          headers.forEach((header, colIdx) => {
            rowObj[header] = rowData[colIdx] !== undefined ? String(rowData[colIdx]).trim() : '';
          });
          rows.push({ _index: i + 1, ...rowObj });
        }

        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo da planilha.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exports data array to .xlsx and downloads it
 */
export async function exportToXLSX(data, filename = 'relatorio.xlsx', sheetName = 'Dados') {
  await ensureSheetJS();
  const worksheet = window.XLSX.utils.json_to_sheet(data);
  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  window.XLSX.writeFile(workbook, filename);
}

/**
 * Date and Time utilities for pt-BR (America/Sao_Paulo)
 */

export function formatDate(dateInput) {
  if (!dateInput) return '-';
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function formatDateTime(dateInput) {
  if (!dateInput) return '-';
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  if (isNaN(d.getTime())) return '-';
  
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function addDays(dateInput, days) {
  const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export function isOverdue(dueDateInput) {
  if (!dueDateInput) return false;
  const due = dueDateInput.toDate ? dueDateInput.toDate() : new Date(dueDateInput);
  const now = new Date();
  // Zera hora para comparar apenas a data do vencimento
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < now;
}

export function daysBetween(date1, date2) {
  const d1 = date1.toDate ? date1.toDate() : new Date(date1);
  const d2 = date2.toDate ? date2.toDate() : new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

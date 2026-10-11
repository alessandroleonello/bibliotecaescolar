/**
 * Supabase Service: Students Management & SED Spreadsheet Import
 */
import { supabase, isConfigured, pingHeartbeat } from '../supabase.js';
import { normalizeText } from '../utils/search.js';

const STORAGE_KEY = 'biblio_local_students_';

function getLocalStudents(schoolId) {
  const data = localStorage.getItem(STORAGE_KEY + schoolId);
  return data ? JSON.parse(data) : [];
}

function saveLocalStudents(schoolId, students) {
  localStorage.setItem(STORAGE_KEY + schoolId, JSON.stringify(students));
}

function mapFromDb(row) {
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    ra: row.ra,
    raDigit: row.ra_digit || '',
    grade: row.grade,
    classroom: row.classroom,
    shift: row.shift,
    active: row.active,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Lists students with optional search and grade filter
 */
export async function listStudents(schoolId, search = '', grade = '') {
  let list = [];
  if (isConfigured && supabase) {
    try {
      let q = supabase.from('students').select('*').eq('school_id', schoolId);
      if (grade) q = q.eq('grade', grade);
      const { data, error } = await q.order('name');
      if (data && !error && data.length > 0) {
        list = data.map(mapFromDb);
      }
    } catch (e) {
      console.warn('Fallback local students:', e.message);
    }
  }

  if (list.length === 0) {
    list = getLocalStudents(schoolId);
    if (grade) {
      list = list.filter(s => s.grade === grade);
    }
  }

  if (search) {
    const norm = normalizeText(search);
    list = list.filter(s => {
      const fullRa = `${s.ra}-${s.raDigit}`;
      return normalizeText(s.name).includes(norm) ||
        s.ra.includes(norm) ||
        fullRa.includes(norm);
    });
  }

  return list;
}

/**
 * Gets a student by ID
 */
export async function getStudent(schoolId, studentId) {
  const all = await listStudents(schoolId);
  return all.find(s => s.id === studentId) || null;
}

/**
 * Saves a student (create or update)
 */
export async function saveStudent(schoolId, studentData, studentId = null) {
  const isNew = !studentId;
  const id = studentId || 'aluno-' + Date.now();
  const payload = {
    ...studentData,
    id,
    ra: String(studentData.ra || '').trim(),
    raDigit: String(studentData.raDigit || '').trim().toUpperCase(),
    active: studentData.active !== false,
    updatedAt: new Date().toISOString()
  };

  if (isNew) {
    payload.createdAt = new Date().toISOString();
    payload.source = studentData.source || 'manual';
  }

  if (isConfigured && supabase) {
    try {
      await supabase.from('students').upsert({
        id,
        school_id: schoolId,
        name: payload.name,
        ra: payload.ra,
        ra_digit: payload.raDigit,
        grade: payload.grade || '',
        classroom: payload.classroom || '',
        shift: payload.shift || 'Manhã',
        active: payload.active,
        source: payload.source || 'manual'
      });
      pingHeartbeat();
    } catch (e) {
      console.warn(e);
    }
  }

  const locals = getLocalStudents(schoolId);
  const idx = locals.findIndex(s => s.id === id);
  if (idx >= 0) {
    locals[idx] = { ...locals[idx], ...payload };
  } else {
    locals.unshift({ id, ...payload });
  }
  saveLocalStudents(schoolId, locals);

  return { id, ...payload };
}

/**
 * Bulk import students with upsert by RA
 */
export async function importStudentsBatch(schoolId, mappedRows, onProgress = null) {
  const locals = getLocalStudents(schoolId);
  const raMap = new Map();
  locals.forEach((s, idx) => {
    if (s.ra) raMap.set(s.ra.trim(), idx);
  });

  const batchId = 'batch-' + Date.now();
  let createdCount = 0;
  let updatedCount = 0;
  const total = mappedRows.length;
  const dbRows = [];

  for (let i = 0; i < total; i++) {
    const row = mappedRows[i];
    const cleanRa = String(row.ra || '').trim();
    const cleanDigit = String(row.raDigit || '').trim().toUpperCase();

    const studentObj = {
      name: row.name,
      ra: cleanRa,
      raDigit: cleanDigit,
      grade: row.grade || 'Não informada',
      classroom: row.classroom || '',
      shift: row.shift || 'Integral',
      active: true,
      source: 'import',
      importBatchId: batchId,
      updatedAt: new Date().toISOString()
    };

    if (raMap.has(cleanRa)) {
      const existingIdx = raMap.get(cleanRa);
      locals[existingIdx] = { ...locals[existingIdx], ...studentObj };
      studentObj.id = locals[existingIdx].id;
      updatedCount++;
    } else {
      const newId = 'aluno-imp-' + Date.now() + '-' + i;
      studentObj.id = newId;
      studentObj.createdAt = new Date().toISOString();
      locals.push(studentObj);
      raMap.set(cleanRa, locals.length - 1);
      createdCount++;
    }

    dbRows.push({
      id: studentObj.id,
      school_id: schoolId,
      name: studentObj.name,
      ra: studentObj.ra,
      ra_digit: studentObj.raDigit,
      grade: studentObj.grade,
      classroom: studentObj.classroom,
      shift: studentObj.shift,
      active: true,
      source: 'import',
      import_batch_id: batchId
    });

    if (onProgress && i % 10 === 0) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  saveLocalStudents(schoolId, locals);

  if (isConfigured && supabase) {
    try {
      const chunkSize = 200;
      for (let i = 0; i < dbRows.length; i += chunkSize) {
        const chunk = dbRows.slice(i, i + chunkSize);
        await supabase.from('students').upsert(chunk, { onConflict: 'school_id, ra' });
      }
      pingHeartbeat();
    } catch (err) {
      console.warn('Erro na sincronização Supabase da importação:', err.message);
    }
  }

  if (onProgress) onProgress(100);

  return {
    batchId,
    totalProcessed: total,
    createdCount,
    updatedCount
  };
}

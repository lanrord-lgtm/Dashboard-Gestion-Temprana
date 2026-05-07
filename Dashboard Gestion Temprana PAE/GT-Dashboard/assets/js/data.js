/* ============================================================
   data.js — Parseo de Excel con SheetJS + persistencia robusta
   Persistencia: IndexedDB (primario) + localStorage (espejo)
   Expone: window.GTData
   ============================================================ */
(function () {
  'use strict';

  const KEYS = {
    PROYECTOS:  'gtd_proyectos',
    TASKS:      'gtd_tasks',
    OVERRIDES:  'gtd_overrides',
    LAST_UPDATE:'gtd_last_update',
    FS_HANDLE:  'gtd_fs_handle'   // FileSystemFileHandle del gtd-cache.json (Chromium)
  };
  const DB_NAME = 'gtd_db';
  const DB_STORE = 'kv';

  const state = {
    proyectos: [],
    tasks: [],
    lastUpdate: null,
    persistError: null,
    persistInfo: { idb: null, ls: null, motivo: '' }
  };

  // ===== Helpers =====
  function limpiarUG(v) {
    return (v == null ? '' : String(v)).replace(/\n/g, '').trim();
  }
  function parsearAsignados(v) {
    if (!v) return [];
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
  }
  function aFecha(v) {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v)) return v;
    const d = new Date(v);
    return isNaN(d) ? null : d;
  }
  function toNum(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  function serializar(arr) {
    return JSON.stringify(arr, (k, v) => {
      if (v instanceof Date) return { __date: v.toISOString() };
      return v;
    });
  }
  function deserializar(json) {
    if (!json) return [];
    return JSON.parse(json, (k, v) => {
      if (v && typeof v === 'object' && v.__date) return new Date(v.__date);
      return v;
    });
  }

  // ===== IndexedDB =====
  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
  async function idbSet(key, value) {
    try {
      const db = await idbOpen();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('idbSet error', key, e);
      return false;
    }
  }
  async function idbGet(key) {
    try {
      const db = await idbOpen();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      });
    } catch (e) {
      console.warn('idbGet error', key, e);
      return null;
    }
  }

  // ===== Mapeo =====
  // Listas de Z y tipos de monto, en el orden canónico requerido por el negocio.
  const Z_LIST    = ['ZI', 'ZA', 'Z6', 'Z3', 'Z1'];
  const TIPO_LIST = ['ROT', 'AIEC'];

  // Normaliza nombre de proyecto para matching case-insensitive trim contra Folder de tareas.
  function normNombre(s) {
    return (s == null ? '' : String(s)).trim().toLowerCase();
  }

  function mapearProyecto(row) {
    const proy = {
      Anio:                row['Año'] ?? row['Año (*)'] ?? null,
      UG:                  limpiarUG(row['01.UG (*)']),
      GenPro:              row['GenPro'] || '',
      Nombre:              row['Nombre'] || '',
      NombreNorm:          normNombre(row['Nombre']),
      Estado:              row['Estado'] || '',
      AvanceTarea:         toNum(row['Avance de tarea']),
      AvanceObra:          toNum(row['Avance de obra']),
      FechaLE:             aFecha(row['Fecha LE (PEM prevista)']),
      Asignado:            String(row['Asignado'] || ''),
      AsignadoArr:         parsearAsignados(row['Asignado']),
      IDProyecto:          row['ID Proyecto'] || '',
      Ingeniero:           row['Ingeniero de Proyecto'] || '',
      FechaFin:            aFecha(row['Fecha de finalización']),
      Criticidad:          row['Criticidad'] || '',
      Limitacion:          row['Limitación de avance'] || '',
      RequiereGR:          (row['Requiere GR'] || '').toString().toUpperCase(),
      Equipos:             toNum(row['Cant Alta de Equipos SAP']),
      PlanesConTareas:     toNum(row['Alta de Planes mtto con tareas SAP']),
      PlanesSinTareas:     toNum(row['Alta de Planes mtto sin tareas SAP']),
    };
    proy.PlanesTotal = (proy.PlanesConTareas || 0) + (proy.PlanesSinTareas || 0);

    // Desglose montos: MontoROT y MontoAIEC como objetos { ZI, ZA, Z6, Z3, Z1 }.
    proy.MontoROT  = {};
    proy.MontoAIEC = {};
    let totalROT = 0, totalAIEC = 0;
    for (const z of Z_LIST) {
      const r = toNum(row[`Monto GR ROT ${z}`])  || 0;
      const a = toNum(row[`Monto GR AIEC ${z}`]) || 0;
      proy.MontoROT[z]  = r;
      proy.MontoAIEC[z] = a;
      totalROT  += r;
      totalAIEC += a;
    }
    proy.MontoTotalROT  = totalROT;
    proy.MontoTotalAIEC = totalAIEC;
    proy.MontoTotal     = totalROT + totalAIEC;
    return proy;
  }

  function mapearTask(row) {
    return {
      Key:          row['Key'] || '',
      Folder:       row['Folder'] || '',
      ParentTask:   row['Parent task'] || '',
      Title:        row['Title'] || '',
      Status:       row['Status'] || '',
      CustomStatus: row['Custom status'] || '',
      AssignedTo:   String(row['Assigned To'] || ''),
      AvancePct:    toNum(row['% Avance']),
      UG:           limpiarUG(row['01.UG (*)']),
      AvanceTarea:  toNum(row['Avance de tarea']),
      Anio:         row['Año'] ?? null,
      Criticidad:   row['Criticidad'] || '',
      FechaLE:      aFecha(row['Fecha LE (PEM prevista)']),
      FechaFin:     aFecha(row['Fecha de finalización']),
      GenPro:       row['GenPro'] || '',
      IDProyecto:   row['ID Proyecto'] || '',
      Ingeniero:    row['Ingeniero de Proyecto'] || '',
      Limitacion:   row['Limitación de avance'] || '',
      RequiereGR:   (row['Requiere GR'] || '').toString().toUpperCase(),
    };
  }

  // ===== Lectura Excel =====
  async function leerExcel(file) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { cellDates: true, dateNF: 'yyyy-mm-dd' });
    const hojas = wb.SheetNames;
    let tipo = null, hoja = null;
    if (hojas.includes('Tasks')) { tipo = 'tasks'; hoja = 'Tasks'; }
    else if (hojas.some(h => /Gesti.n Temprana/i.test(h))) {
      tipo = 'proyectos';
      hoja = hojas.find(h => /Gesti.n Temprana/i.test(h));
    } else {
      hoja = hojas[0];
      const sheet = wb.Sheets[hoja];
      const head = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
      tipo = head.length > 30 ? 'tasks' : 'proyectos';
    }
    const sheet = wb.Sheets[hoja];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    return { tipo, hoja, filas: rows };
  }

  async function cargarArchivos(fileList) {
    const archivos = Array.from(fileList);
    const resultado = { proyectos: 0, tasks: 0, errores: [] };
    for (const file of archivos) {
      try {
        const { tipo, filas } = await leerExcel(file);
        if (tipo === 'proyectos') {
          state.proyectos = filas.map(mapearProyecto).filter(p => p.Nombre);
          resultado.proyectos = state.proyectos.length;
        } else if (tipo === 'tasks') {
          state.tasks = filas.map(mapearTask);
          resultado.tasks = state.tasks.length;
        }
      } catch (e) {
        console.error('Error leyendo', file.name, e);
        resultado.errores.push(file.name);
      }
    }
    state.lastUpdate = new Date().toISOString();
    await persistir();
    return resultado;
  }

  // ===== Persistencia: IDB primario + LS espejo =====
  async function persistir() {
    state.persistError = null;
    let idbOk = false;
    try {
      const r1 = await idbSet(KEYS.PROYECTOS,   state.proyectos);
      const r2 = await idbSet(KEYS.TASKS,       state.tasks);
      const r3 = await idbSet(KEYS.LAST_UPDATE, state.lastUpdate);
      idbOk = !!(r1 && r2 && r3);
    } catch (e) {
      state.persistError = 'IDB: ' + (e && e.message || e);
      console.warn('persistir IDB', e);
    }

    // Espejo localStorage para arranque rápido (puede fallar por cuota)
    let lsOk = false;
    try {
      localStorage.setItem(KEYS.PROYECTOS,  serializar(state.proyectos));
      localStorage.setItem(KEYS.LAST_UPDATE, state.lastUpdate);
      try { localStorage.setItem(KEYS.TASKS, serializar(state.tasks)); lsOk = true; }
      catch (_) { localStorage.removeItem(KEYS.TASKS); lsOk = true; /* parcial vale */ }
    } catch (e) {
      state.persistError = (state.persistError ? state.persistError + ' · ' : '') + 'LS: ' + (e && e.message || e);
      console.warn('localStorage espejo falló', e);
    }
    state.persistInfo = { idb: idbOk, ls: lsOk, motivo: state.persistError || '' };
  }

  async function cargarCache() {
    // 1) intentar IndexedDB (más completo)
    try {
      const [p, t, u] = await Promise.all([
        idbGet(KEYS.PROYECTOS), idbGet(KEYS.TASKS), idbGet(KEYS.LAST_UPDATE)
      ]);
      if (Array.isArray(p) && p.length) state.proyectos = revivirFechas(p, ['FechaLE', 'FechaFin']);
      if (Array.isArray(t) && t.length) state.tasks     = revivirFechas(t, ['FechaLE', 'FechaFin']);
      if (u) state.lastUpdate = u;
    } catch (e) { console.warn('IDB cargar', e); }

    // 2) si IDB vacío, fallback a localStorage
    if (state.proyectos.length === 0) {
      try {
        const p = localStorage.getItem(KEYS.PROYECTOS);
        if (p) state.proyectos = deserializar(p);
        const t = localStorage.getItem(KEYS.TASKS);
        if (t) state.tasks = deserializar(t);
        const u = localStorage.getItem(KEYS.LAST_UPDATE);
        if (u) state.lastUpdate = u;
      } catch (e) { console.warn('LS cargar', e); }
    }
    return state.proyectos.length > 0 || state.tasks.length > 0;
  }

  // Re-hidratar fechas que IDB guarda como Date u objetos serializados
  function revivirFechas(arr, campos) {
    return arr.map(o => {
      campos.forEach(c => {
        if (o[c] && !(o[c] instanceof Date)) {
          const d = new Date(o[c].__date || o[c]);
          o[c] = isNaN(d) ? null : d;
        }
      });
      return o;
    });
  }

  // ===== Diagnóstico de persistencia =====
  async function diagnosticarPersistencia() {
    const info = { idb: false, ls: false, motivo: '' };
    // IDB
    try {
      const ok = await idbSet('__gtd_test__', Date.now());
      const v = await idbGet('__gtd_test__');
      info.idb = !!ok && v != null;
    } catch (e) { info.idb = false; info.motivo = 'IDB: ' + (e && e.message || e); }
    // LS
    try {
      localStorage.setItem('__gtd_test__', '1');
      info.ls = localStorage.getItem('__gtd_test__') === '1';
      localStorage.removeItem('__gtd_test__');
    } catch (e) { info.ls = false; info.motivo = (info.motivo ? info.motivo + ' · ' : '') + 'LS: ' + (e && e.message || e); }
    if (!info.idb && !info.ls) {
      info.motivo = info.motivo || 'Almacenamiento del navegador deshabilitado (file:// o modo privado).';
    }
    state.persistInfo = info;
    return info;
  }

  // ===== Exportar caché a archivo JSON (portable) =====
  function exportarCacheJSON({ auto = false } = {}) {
    const payload = {
      _meta: { app: 'GTD', version: 1, exportedAt: new Date().toISOString() },
      proyectos: state.proyectos,
      tasks: state.tasks,
      lastUpdate: state.lastUpdate
    };
    const blob = new Blob([serializar([payload])], { type: 'application/json' });
    // Usamos serializar() para preservar fechas; envolvemos en array para reciclar el revivir
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gtd-cache.json';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    return true;
  }

  async function importarCacheJSON(file) {
    if (!file) throw new Error('Archivo vacío');
    const txt = await file.text();
    let payload = null;
    try {
      const arr = deserializar(txt);
      payload = Array.isArray(arr) ? arr[0] : arr;
    } catch (e) {
      throw new Error('JSON inválido: ' + e.message);
    }
    if (!payload || (!payload.proyectos && !payload.tasks)) {
      throw new Error('JSON sin datos esperados (proyectos/tasks)');
    }
    state.proyectos = revivirFechas(payload.proyectos || [], ['FechaLE', 'FechaFin']);
    state.tasks     = revivirFechas(payload.tasks || [],     ['FechaLE', 'FechaFin']);
    state.lastUpdate = payload.lastUpdate || new Date().toISOString();
    await persistir();
    return { proyectos: state.proyectos.length, tasks: state.tasks.length };
  }

  // ===== File System Access API: handle persistente al gtd-cache.json (Chromium) =====
  function fsApiDisponible() {
    return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
  }

  async function elegirArchivoCache() {
    if (!fsApiDisponible()) throw new Error('Navegador sin File System Access API');
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'GTD cache', accept: { 'application/json': ['.json'] } }],
      excludeAcceptAllOption: false, multiple: false
    });
    await idbSet(KEYS.FS_HANDLE, handle);
    const file = await handle.getFile();
    return await importarCacheJSON(file);
  }

  async function intentarAutoCargarFsHandle() {
    if (!fsApiDisponible()) return false;
    try {
      const handle = await idbGet(KEYS.FS_HANDLE);
      if (!handle || typeof handle.getFile !== 'function') return false;
      // Pedir permiso de lectura (silencioso si ya fue concedido en el origen)
      const opts = { mode: 'read' };
      let perm = 'granted';
      if (handle.queryPermission) perm = await handle.queryPermission(opts);
      if (perm !== 'granted' && handle.requestPermission) perm = await handle.requestPermission(opts);
      if (perm !== 'granted') return false;
      const file = await handle.getFile();
      await importarCacheJSON(file);
      return true;
    } catch (e) {
      console.warn('intentarAutoCargarFsHandle falló', e);
      return false;
    }
  }

  async function limpiarTodo() {
    state.proyectos = []; state.tasks = []; state.lastUpdate = null;
    [KEYS.PROYECTOS, KEYS.TASKS, KEYS.LAST_UPDATE].forEach(k => localStorage.removeItem(k));
    await idbSet(KEYS.PROYECTOS, null);
    await idbSet(KEYS.TASKS, null);
    await idbSet(KEYS.LAST_UPDATE, null);
  }

  // ===== Vistas =====
  function esWellpad(p) { return /wellpad/i.test(p.Nombre || ''); }
  function proyectosPorVista(vista) {
    if (vista === 'wellpads') return state.proyectos.filter(esWellpad);
    return state.proyectos.filter(p => !esWellpad(p));
  }

  window.GTData = {
    state, KEYS, Z_LIST, TIPO_LIST,
    cargarArchivos, cargarCache, persistir, limpiarTodo,
    proyectosPorVista, esWellpad, normNombre,
    diagnosticarPersistencia, exportarCacheJSON, importarCacheJSON,
    fsApiDisponible, elegirArchivoCache, intentarAutoCargarFsHandle,
  };
})();

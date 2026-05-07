/* ============================================================
   app.js — Orquestador del dashboard
   ============================================================ */
(function () {
  'use strict';

  const APP = {
    vista: 'generales',
    grTipo: 'TODOS',       // Toggle ROT / AIEC / TODOS del gráfico Monto total GR (default: TODOS)
    lateralUG: 'TODOS'     // UG seleccionada en la tarjeta lateral "MONTO TOTAL POR Z" (default: TODOS)
  };

  // ===== Toast =====
  let toastTimer = null;
  function toast(mensaje, tipo = 'success') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = mensaje;
    el.className = 'toast show' + (tipo === 'error' ? ' error' : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 4000);
  }

  function mostrarApp(mostrar) {
    document.getElementById('welcome').classList.toggle('hidden', mostrar);
    document.getElementById('app').classList.toggle('hidden', !mostrar);
  }

  // ===== Pipeline =====
  function refrescarTodo(pulse = false) {
    const D = window.GTData;
    const T = window.GTTransforms;
    const F = window.GTFilters;
    const C = window.GTCharts;
    const K = window.GTKPIs;

    const proyectosVista = D.proyectosPorVista(APP.vista);
    const filtrados = F.aplicar(proyectosVista);

    const kpis = T.calcularKPIs(filtrados);
    const ugMap = T.porUGCriticidad(filtrados);
    K.renderKPIStrip(kpis, ugMap, pulse);

    // Charts
    const cs = T.curvaS(filtrados);
    C.curvaS('chartCurvaTodos', cs);
    C.donutUG('chartDonutUG', T.porUG(filtrados));
    C.barrasCriticidad('chartCriticidadBarras', T.criticidadGlobal(filtrados));
    C.barrasGR(
      'chartBarrasGR',
      T.montoGRDesglosadoPorUG(filtrados, APP.grTipo === 'TODOS' ? 'ROT' : APP.grTipo, ''),
      { tipo: APP.grTipo }
    );
    C.equiposUG('chartEquiposUG', T.equiposPorUG(filtrados));
    C.planesUGAgrupado('chartPlanesUG', T.planesDesglosadosPorUG(filtrados));
    renderLateralMontoZ(filtrados);

    window.GTTable.render(filtrados, { resetPage: false });
    actualizarHeaderMeta(D.state.lastUpdate, filtrados.length);
  }

  function refrescarTabla(refrescarKPIs = false) {
    if (refrescarKPIs) refrescarTodo(true);
    else {
      const D = window.GTData;
      const F = window.GTFilters;
      const filtrados = F.aplicar(D.proyectosPorVista(APP.vista));
      window.GTTable.render(filtrados);
    }
  }

  function renderLateralMontoZ(proyectos) {
    const T = window.GTTransforms;
    const C = window.GTCharts;
    if (!T || !T.montoTotalPorZ) return;
    const map = T.montoTotalPorZ(proyectos, APP.lateralUG, APP.grTipo);
    const fmt = (C && C.fmtMoneyShort) ? C.fmtMoneyShort : (v) => '$' + Math.round(v || 0);
    ['ZI', 'ZA', 'Z6', 'Z3', 'Z1'].forEach(z => {
      const el = document.getElementById('lat' + z);
      if (el) el.textContent = fmt(map[z] || 0);
    });
  }

  function actualizarVistaTag() {
    const g = document.getElementById('vistaTagGenerales');
    const w = document.getElementById('vistaTagWellpads');
    if (!g || !w) return;
    const esWp = APP.vista === 'wellpads';
    g.classList.toggle('hidden', esWp);
    w.classList.toggle('hidden', !esWp);
  }

  function actualizarHeaderMeta(lastUpdate, count) {
    const meta = document.getElementById('headerMeta');
    if (!meta) return;
    if (!lastUpdate) { meta.textContent = '— sin datos —'; return; }
    const dt = new Date(lastUpdate);
    const txt = dt.toLocaleDateString('es-AR') + ' ' + dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    meta.textContent = `${count} en vista · Caché: ${txt}`;
  }

  function tituloVista() {
    return APP.vista === 'wellpads' ? 'Gestión Wellpads' : 'Proyectos Generales';
  }

  // ===== Carga de archivos =====
  async function cargarArchivos(fileList) {
    if (!fileList || fileList.length === 0) return;
    try {
      const r = await window.GTData.cargarArchivos(fileList);
      window.GTFilters.poblarSelects(window.GTData.state.proyectos);
      mostrarApp(true);
      refrescarTodo();
      const partes = [];
      if (r.proyectos) partes.push(`${r.proyectos} proyectos`);
      if (r.tasks)     partes.push(`${r.tasks} tareas`);
      const msg = '✅ ' + partes.join(' · ') + ' · ' + new Date().toLocaleTimeString('es-AR');
      toast(msg);
      console.log(`✅ GTD - ${window.GTData.proyectosPorVista('generales').length} generales, ${window.GTData.proyectosPorVista('wellpads').length} wellpads, ${window.GTData.state.tasks.length} tareas`);
      if (r.errores.length) toast('Algunos archivos no se pudieron leer: ' + r.errores.join(', '), 'error');

      // Auto-export del caché para portabilidad (sólo si la persistencia local es dudosa o el usuario lo prefirió)
      try {
        const info = window.GTData.state.persistInfo || {};
        if (!info.idb || !info.ls) {
          window.GTData.exportarCacheJSON({ auto: true });
          toast('💾 Caché exportada como gtd-cache.json (guardala junto a index.html)', 'success');
        }
      } catch (_) {}
    } catch (e) {
      console.error(e);
      toast('Error al leer Excel: ' + e.message, 'error');
    }
  }

  async function importarCacheArchivo(file) {
    if (!file) return;
    try {
      const r = await window.GTData.importarCacheJSON(file);
      window.GTFilters.poblarSelects(window.GTData.state.proyectos);
      mostrarApp(true);
      refrescarTodo();
      toast(`✅ Caché restaurada: ${r.proyectos} proyectos · ${r.tasks} tareas`);
    } catch (e) {
      console.error(e);
      toast('No se pudo importar caché: ' + e.message, 'error');
    }
  }

  // ===== Listeners =====
  function bindWelcome() {
    const dz = document.getElementById('dropzone');
    const inp = document.getElementById('fileInputWelcome');
    if (dz && inp) {
      dz.addEventListener('click', () => inp.click());
      inp.addEventListener('change', (ev) => cargarArchivos(ev.target.files));
      ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('dragover'); }));
      ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('dragover'); }));
      dz.addEventListener('drop', (ev) => cargarArchivos(ev.dataTransfer.files));
    }

    // Botón "Importar caché" en welcome
    const btnImpW  = document.getElementById('btnImportCacheWelcome');
    const fileImpW = document.getElementById('fileInputCacheWelcome');
    if (btnImpW && fileImpW) {
      btnImpW.addEventListener('click', () => fileImpW.click());
      fileImpW.addEventListener('change', (ev) => { importarCacheArchivo(ev.target.files[0]); ev.target.value = ''; });
    }
    // Botón "Vincular caché" (FS Access API) en welcome
    const btnFsW = document.getElementById('btnLinkCacheWelcome');
    if (btnFsW) {
      if (!window.GTData.fsApiDisponible()) btnFsW.style.display = 'none';
      else btnFsW.addEventListener('click', async () => {
        try {
          const r = await window.GTData.elegirArchivoCache();
          window.GTFilters.poblarSelects(window.GTData.state.proyectos);
          mostrarApp(true);
          refrescarTodo();
          toast(`🔗 Caché vinculada: ${r.proyectos} proyectos · ${r.tasks} tareas`);
        } catch (e) {
          if (e && e.name !== 'AbortError') toast('No se pudo vincular: ' + e.message, 'error');
        }
      });
    }
  }

  function bindHeader() {
    const btn = document.getElementById('btnUpdate');
    const inp = document.getElementById('fileInputHeader');
    if (btn && inp) {
      btn.addEventListener('click', () => inp.click());
      inp.addEventListener('change', (ev) => { cargarArchivos(ev.target.files); ev.target.value = ''; });
    }
    const btnPdf = document.getElementById('btnExportPDF');
    if (btnPdf) btnPdf.addEventListener('click', async () => {
      try {
        if (!window.GTPdfReport) { toast('Módulo PDF no cargado', 'error'); return; }
        const D = window.GTData;
        if (!D.state.proyectos.length) { toast('No hay datos para exportar', 'error'); return; }
        btnPdf.disabled = true;
        await window.GTPdfReport.generar();
      } catch (e) {
        console.error(e);
        toast('Error generando PDF: ' + e.message, 'error');
      } finally {
        btnPdf.disabled = false;
      }
    });

    const btnExp = document.getElementById('btnExportOverrides');
    if (btnExp) btnExp.addEventListener('click', () => { window.GTOverrides.exportar(); toast('JSON descargado'); });

    // Exportar/Importar caché (gtd-cache.json) desde el header
    const btnExpCache = document.getElementById('btnExportCache');
    if (btnExpCache) btnExpCache.addEventListener('click', () => {
      try { window.GTData.exportarCacheJSON(); toast('💾 gtd-cache.json descargado'); }
      catch (e) { toast('Error exportando caché: ' + e.message, 'error'); }
    });
    const btnImpCache = document.getElementById('btnImportCacheHeader');
    const inpImpCache = document.getElementById('fileInputCacheHeader');
    if (btnImpCache && inpImpCache) {
      btnImpCache.addEventListener('click', () => inpImpCache.click());
      inpImpCache.addEventListener('change', (ev) => { importarCacheArchivo(ev.target.files[0]); ev.target.value = ''; });
    }

    const btnImp = document.getElementById('btnImportOverrides');
    const inpImp = document.getElementById('fileInputOverrides');
    if (btnImp && inpImp) {
      btnImp.addEventListener('click', () => inpImp.click());
      inpImp.addEventListener('change', async (ev) => {
        try {
          const n = await window.GTOverrides.importar(ev.target.files[0]);
          toast(`✅ Importados ${n} overrides`);
          refrescarTodo(true);
        } catch (e) {
          toast('Error importando: ' + e.message, 'error');
        }
        ev.target.value = '';
      });
    }
  }

  function bindSidebar() {
    document.querySelectorAll('.nav-item').forEach(it => {
      it.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        it.classList.add('active');
        APP.vista = it.dataset.view;
        actualizarVistaTag();
        refrescarTodo(true);
      });
    });
    const btn = document.getElementById('btnSidebarToggle');
    if (btn) btn.addEventListener('click', () => {
      document.getElementById('app').classList.toggle('sidebar-collapsed');
    });
  }

  function bindFilters() {
    const SELECT_MAP = { fltUG: 'UG', fltEstado: 'Estado', fltAnio: 'Anio' };
    Object.keys(SELECT_MAP).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        window.GTFilters.setFiltro(SELECT_MAP[id], el.value);
        refrescarTodo(true);
      });
    });

    // Autocomplete por Nombre del Proyecto (debounce 200ms)
    const fltNombre = document.getElementById('fltNombre');
    if (fltNombre) {
      let dTimer = null;
      fltNombre.addEventListener('input', (ev) => {
        clearTimeout(dTimer);
        dTimer = setTimeout(() => {
          window.GTFilters.setFiltro('nombre', ev.target.value);
          refrescarTodo(false);
        }, 200);
      });
    }

    const btnClr = document.getElementById('btnClearFilters');
    if (btnClr) btnClr.addEventListener('click', () => {
      window.GTFilters.reset();
      Object.keys(SELECT_MAP).forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
      const fn = document.getElementById('fltNombre'); if (fn) fn.value = '';
      document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active'));
      const s = document.getElementById('tblSearch'); if (s) s.value = '';
      refrescarTodo(true);
    });

    const search = document.getElementById('tblSearch');
    if (search) search.addEventListener('input', (ev) => {
      window.GTFilters.setFiltro('busqueda', ev.target.value);
      refrescarTodo(false);
    });

    // Toggle ROT / AIEC / TODOS del gráfico Monto total GR (afecta también al lateral)
    document.querySelectorAll('.gr-toggle-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.gr-toggle-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const t = b.dataset.tipo;
        APP.grTipo = ['ROT', 'AIEC', 'TODOS'].includes(t) ? t : 'ROT';
        refrescarTodo(false);
      });
    });

    // Selector de UG en la tarjeta lateral "MONTO TOTAL POR Z"
    document.querySelectorAll('#ugToggleLateral .ug-toggle-btn').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('#ugToggleLateral .ug-toggle-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        APP.lateralUG = b.dataset.ug || 'NQN';
        refrescarTodo(false);
      });
    });
  }

  function bindTabla() {
    window.GTTable.setOnRowClick((genpro) => window.GTModal.abrir(genpro));
    window.GTTable.setOnChange(() => refrescarTodo(true));
  }

  // ===== Init =====
  async function init() {
    window.GTOverrides.cargar();
    window.GTTheme.init();

    // Capa 1: caché en IDB / localStorage
    let tieneCache = await window.GTData.cargarCache();

    // Capa 2: si IDB/LS vacíos, intentar handle persistente del gtd-cache.json (Chromium)
    if (!tieneCache) {
      const ok = await window.GTData.intentarAutoCargarFsHandle();
      if (ok) tieneCache = true;
    }

    // Capa 0: diagnóstico para mostrar motivo si todo falla
    await window.GTData.diagnosticarPersistencia();

    bindWelcome();
    bindHeader();
    bindSidebar();
    bindFilters();
    bindTabla();
    actualizarVistaTag();

    if (tieneCache) {
      window.GTFilters.poblarSelects(window.GTData.state.proyectos);
      mostrarApp(true);
      refrescarTodo();
      console.log(`✅ GTD - ${window.GTData.proyectosPorVista('generales').length} generales, ${window.GTData.proyectosPorVista('wellpads').length} wellpads, ${window.GTData.state.tasks.length} tareas`);
    } else {
      mostrarApp(false);
      const info = window.GTData.state.persistInfo;
      if (info && !info.idb && !info.ls) {
        toast('⚠ Almacenamiento del navegador no disponible. Usá "Importar caché" para restaurar.', 'error');
      }
    }
  }

  window.GTApp = {
    refrescarTodo, refrescarTabla, toast,
    get vista() { return APP.vista; }
  };

  document.addEventListener('DOMContentLoaded', init);
})();

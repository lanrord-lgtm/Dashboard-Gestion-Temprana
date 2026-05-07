/* ============================================================
   filters.js — Estado y aplicación de filtros
   Expone: window.GTFilters
   ============================================================ */
(function () {
  'use strict';

  const state = {
    UG: '',
    Estado: '',
    Anio: '',
    nombre: '',     // filtro autocomplete por Nombre del Proyecto
    quickChip: '',  // 'backlog' | 'pendientes' | 'cumplidos' | ''
    busqueda: '',   // búsqueda libre desde la tabla
  };

  function setFiltro(campo, valor) { state[campo] = valor; }
  function getFiltros() { return { ...state }; }

  function reset() {
    state.UG = ''; state.Estado = ''; state.Anio = '';
    state.nombre = ''; state.quickChip = ''; state.busqueda = '';
  }

  function aplicar(proyectos) {
    let out = proyectos;
    if (state.UG)         out = out.filter(p => p.UG === state.UG);
    if (state.Estado)     out = out.filter(p => p.Estado === state.Estado);
    if (state.Anio)       out = out.filter(p => String(p.Anio) === String(state.Anio));
    if (state.nombre) {
      const q = state.nombre.trim().toLowerCase();
      out = out.filter(p => (p.Nombre || '').toLowerCase().includes(q));
    }
    if (state.quickChip)  out = window.GTTransforms.aplicaQuickChip(out, state.quickChip);
    if (state.busqueda) {
      const q = state.busqueda.toLowerCase();
      out = out.filter(p =>
        (p.Nombre || '').toLowerCase().includes(q) ||
        (p.GenPro || '').toLowerCase().includes(q) ||
        (p.Ingeniero || '').toLowerCase().includes(q)
      );
    }
    return out;
  }

  // Poblar selects + datalist de autocomplete desde los datos
  function poblarSelects(proyectos) {
    const ugs    = [...new Set(proyectos.map(p => p.UG).filter(Boolean))].sort();
    const estados= [...new Set(proyectos.map(p => p.Estado).filter(Boolean))].sort();
    const anios  = [...new Set(proyectos.map(p => p.Anio).filter(v => v != null))].sort();
    const nombres= [...new Set(proyectos.map(p => p.Nombre).filter(Boolean))].sort();

    fillSelect('fltUG', ugs);
    fillSelect('fltEstado', estados);
    fillSelect('fltAnio', anios);
    fillDatalist('nombresProyectos', nombres);
  }

  function fillDatalist(id, opciones) {
    const dl = document.getElementById(id);
    if (!dl) return;
    dl.innerHTML = opciones.map(o => `<option value="${escapeHtml(o)}"></option>`).join('');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function fillSelect(id, opciones) {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">Todos</option>' +
      opciones.map(o => `<option value="${o}">${o}</option>`).join('');
    if (opciones.includes(cur)) sel.value = cur;
  }

  window.GTFilters = { state, setFiltro, getFiltros, reset, aplicar, poblarSelects };
})();

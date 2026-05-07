/* ============================================================
   table.js — Tabla compacta: UG · GenPro · Nombre · Estado ·
              Criticidad · Avance · Fecha LE · Limitación ·
              Requiere GR · Monto GR (editable)
   Expone: window.GTTable
   ============================================================ */
(function () {
  'use strict';

  const PAGE_SIZE = 20;
  const tstate = {
    sort: { key: 'Nombre', dir: 'asc' },
    page: 1,
    rows: [],
    onRowClick: null,
    onChange: null
  };

  const COLS = [
    { key: 'UG',           label: 'UG',           sort: true  },
    { key: 'GenPro',       label: 'GenPro',       sort: true  },
    { key: 'Nombre',       label: 'Nombre',       sort: true  },
    { key: 'Estado',       label: 'Estado',       sort: true  },
    { key: 'Criticidad',   label: 'Criticidad',   sort: true  },
    { key: 'AvanceTarea',  label: 'Avance',       sort: true  },
    { key: 'FechaLE',      label: 'Fecha LE',     sort: true  },
    { key: 'Limitacion',   label: 'Limitación',   sort: false },
    { key: 'RequiereGR',   label: 'Requiere GR',  sort: true  },
    { key: 'MontoTotal',   label: 'Monto Total GR', sort: true },
    { key: 'Equipos',         label: 'Cant. Equipos SAP', sort: true },
    { key: 'PlanesConTareas', label: 'Planes c/ Tareas',  sort: true },
    { key: 'PlanesSinTareas', label: 'Planes s/ Tareas',  sort: true },
  ];

  const fmtFecha = (d) => {
    if (!d) return '—';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const fmtMoney = (n) => (n == null || n === '') ? '—' : '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
  const fmtInt = (n) => (n == null || n === '' || isNaN(+n)) ? '—' : Number(n).toLocaleString('es-AR');
  const fmt = (v) => (v == null || v === '') ? '—' : v;

  function progressHTML(pct) {
    if (pct == null) return '—';
    const v = Math.max(0, Math.min(100, pct));
    let cls = 'progress-low';
    if (v > 75) cls = 'progress-high';
    else if (v >= 25) cls = 'progress-mid';
    return `<span class="progress ${cls}"><span style="width:${v}%"></span></span> <span style="font-size:11px">${Math.round(v)}%</span>`;
  }

  function ugBadge(ug) {
    const c = ['NQN','GSJ','ACA'].includes(ug) ? `ug-${ug}` : 'ug-DEF';
    return `<span class="badge ${c}">${ug || 'S/UG'}</span>`;
  }
  function estadoBadge(estado) {
    const map = { 'Cumplida':'estado-Cumplida', 'En Proceso':'estado-EnProceso', 'Sin Avance':'estado-SinAvance' };
    return `<span class="badge ${map[estado] || ''}">${estado || '—'}</span>`;
  }
  function critBadge(cri) {
    if (!cri) return '—';
    return cri === 'Crítico'
      ? `<span class="badge crit-yes">Crítico</span>`
      : `<span class="badge crit-no">No crítico</span>`;
  }
  function grBadge(req) {
    if (!req) return '—';
    return req === 'SI'
      ? `<span class="badge gr-yes">SI</span>`
      : `<span class="badge gr-no">NO</span>`;
  }

  function celdaEditable(p, campoInterno) {
    const O = window.GTOverrides;
    const valor = O.getEffectiveValue(p, campoInterno);
    const isOver = O.isOverridden(p, campoInterno);
    const original = p[campoInterno];
    let display;
    if (campoInterno === 'MontoGR')        display = fmtMoney(valor);
    else if (campoInterno === 'PeriodosGR') display = valor || '—';
    else                                    display = valor == null ? '—' : valor;

    const tooltip = isOver ? `Editado · Original: ${campoInterno === 'MontoGR' ? fmtMoney(original) : (original ?? '—')}` : 'Click para editar';

    return `<span class="cell-editable ${isOver ? 'cell-overridden' : ''}"
                  data-genpro="${p.GenPro || ''}"
                  data-field="${campoInterno}"
                  title="${tooltip}">
              <span class="cell-text">${display}</span>
              <span class="pencil">✏</span>
            </span>`;
  }

  function renderHeader() {
    return '<thead><tr>' + COLS.map(c => {
      let arrow = '';
      if (c.sort && tstate.sort.key === c.key) arrow = tstate.sort.dir === 'asc' ? ' ▲' : ' ▼';
      return `<th data-key="${c.key}" data-sortable="${c.sort}">${c.label}${arrow}</th>`;
    }).join('') + '</tr></thead>';
  }

  function renderBody(rows) {
    if (rows.length === 0) {
      return `<tbody><tr><td colspan="${COLS.length}" style="text-align:center;padding:24px;color:var(--text-secondary)">Sin proyectos para mostrar</td></tr></tbody>`;
    }
    return '<tbody>' + rows.map(p => {
      const cri = p.Criticidad === 'Crítico' ? ' class="critico"' : '';
      return `<tr${cri} data-genpro="${p.GenPro || ''}">
        <td>${ugBadge(p.UG)}</td>
        <td class="mono small">${fmt(p.GenPro)}</td>
        <td class="col-name" title="${p.Nombre}">${fmt(p.Nombre)}</td>
        <td>${estadoBadge(p.Estado)}</td>
        <td>${critBadge(p.Criticidad)}</td>
        <td>${progressHTML(p.AvanceTarea)}</td>
        <td>${fmtFecha(p.FechaLE)}</td>
        <td title="${p.Limitacion || ''}">${(p.Limitacion || '').slice(0, 38) || '—'}</td>
        <td>${grBadge(p.RequiereGR)}</td>
        <td class="mono">${fmtMoney(p.MontoTotal)}</td>
        <td class="mono">${fmtInt(window.GTOverrides.getEffectiveValue(p, 'Equipos'))}</td>
        <td class="mono">${fmtInt(window.GTOverrides.getEffectiveValue(p, 'PlanesConTareas'))}</td>
        <td class="mono">${fmtInt(window.GTOverrides.getEffectiveValue(p, 'PlanesSinTareas'))}</td>
      </tr>`;
    }).join('') + '</tbody>';
  }

  function aplicarSort(rows) {
    const { key, dir } = tstate.sort;
    const sign = dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let va = a[key], vb = b[key];
      if (va instanceof Date) va = va.getTime();
      if (vb instanceof Date) vb = vb.getTime();
      if (va == null && vb == null) return 0;
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign;
      return String(va).localeCompare(String(vb), 'es') * sign;
    });
  }

  function render(rows, opts = {}) {
    if (rows) tstate.rows = rows;
    if (opts.resetPage) tstate.page = 1;
    const sorted = aplicarSort(tstate.rows);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    if (tstate.page > totalPages) tstate.page = totalPages;
    const startIndex = (tstate.page - 1) * PAGE_SIZE;
    const slice = sorted.slice(startIndex, startIndex + PAGE_SIZE);

    const tbl = document.getElementById('proyectosTable');
    if (tbl) tbl.innerHTML = renderHeader() + renderBody(slice);
    const cnt = document.getElementById('tblCount');
    if (cnt) cnt.textContent = `${sorted.length} proyecto${sorted.length === 1 ? '' : 's'}`;
    renderPagination(totalPages);
    bindRowEvents();
  }

  function renderPagination(totalPages) {
    const cont = document.getElementById('tblPagination');
    if (!cont) return;
    if (totalPages <= 1) { cont.innerHTML = ''; return; }
    let html = '';
    html += `<button class="page-btn" ${tstate.page === 1 ? 'disabled' : ''} data-page="prev">‹</button>`;
    const start = Math.max(1, tstate.page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
      html += `<button class="page-btn ${i === tstate.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    html += `<button class="page-btn" ${tstate.page === totalPages ? 'disabled' : ''} data-page="next">›</button>`;
    html += `<span class="page-info">Pág ${tstate.page} de ${totalPages}</span>`;
    cont.innerHTML = html;
    cont.querySelectorAll('.page-btn').forEach(b => {
      b.addEventListener('click', () => {
        const p = b.dataset.page;
        if (p === 'prev') tstate.page = Math.max(1, tstate.page - 1);
        else if (p === 'next') tstate.page = Math.min(totalPages, tstate.page + 1);
        else tstate.page = +p;
        render();
      });
    });
  }

  function bindRowEvents() {
    const tbl = document.getElementById('proyectosTable');
    if (!tbl) return;

    tbl.querySelectorAll('th[data-sortable="true"]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (tstate.sort.key === key) tstate.sort.dir = tstate.sort.dir === 'asc' ? 'desc' : 'asc';
        else { tstate.sort.key = key; tstate.sort.dir = 'asc'; }
        render();
      });
    });

    tbl.querySelectorAll('tbody tr').forEach(tr => {
      tr.addEventListener('click', (ev) => {
        if (ev.target.closest('.cell-editable')) return;
        const genpro = tr.dataset.genpro;
        if (tstate.onRowClick) tstate.onRowClick(genpro);
      });
    });

    tbl.querySelectorAll('.cell-editable').forEach(span => {
      span.addEventListener('click', (ev) => { ev.stopPropagation(); iniciarEdicion(span); });
    });
  }

  function iniciarEdicion(span) {
    const genpro = span.dataset.genpro;
    const field = span.dataset.field;
    if (!genpro) {
      window.GTApp && window.GTApp.toast('No se puede editar: proyecto sin GenPro', 'error');
      return;
    }
    const proyecto = window.GTData.state.proyectos.find(p => p.GenPro === genpro);
    if (!proyecto) return;
    const valActual = window.GTOverrides.getEffectiveValue(proyecto, field);
    const inicial = valActual == null ? '' : String(valActual);
    const tipo = field === 'PeriodosGR' ? 'text' : 'number';
    span.innerHTML = `<input class="cell-input" type="${tipo}" value="${inicial}" />`;
    const inp = span.querySelector('input');
    inp.focus(); inp.select();

    let cancelado = false;
    function guardar() {
      if (cancelado) return;
      const valor = inp.value.trim();
      if (valor === '') {
        window.GTOverrides.resetOverride(genpro, field);
      } else if (!window.GTOverrides.VALIDATORS[field](valor)) {
        inp.classList.add('invalid');
        return;
      } else {
        window.GTOverrides.setOverride(genpro, field, valor);
      }
      cancelado = true;
      render();
      if (tstate.onChange) tstate.onChange();
      const nueva = document.querySelector(`.cell-editable[data-genpro="${genpro}"][data-field="${field}"]`);
      if (nueva) {
        nueva.classList.add('cell-flash');
        setTimeout(() => nueva.classList.remove('cell-flash'), 500);
      }
    }
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); guardar(); }
      else if (ev.key === 'Escape') { cancelado = true; render(); }
    });
    inp.addEventListener('blur', guardar);
  }

  function setOnRowClick(fn) { tstate.onRowClick = fn; }
  function setOnChange(fn)   { tstate.onChange = fn; }

  window.GTTable = { render, setOnRowClick, setOnChange, PAGE_SIZE };
})();

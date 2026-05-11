/* ============================================================
   modal.js — Modal de detalle de proyecto (secciones A-E)
   Expone: window.GTModal
   ============================================================ */
(function () {
  'use strict';

  const overlay = () => document.getElementById('modalOverlay');
  const modal   = () => document.getElementById('modal');

  function fmtFecha(d) {
    if (!d) return '—';
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  function fmtMoney(n) { return n == null ? '—' : '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }
  function diffDias(a, b) {
    if (!a || !b) return null;
    return Math.round((a - b) / 86400000);
  }

  function avatarColor(name) {
    const colors = ['#4f8ef7','#38c9b0','#a78bfa','#f472b6','#fb923c','#22c55e','#ef4444'];
    let h = 0; for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
    return colors[h % colors.length];
  }
  function iniciales(n) { return n.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase(); }

  function abrir(genpro) {
    const proyecto = window.GTData.state.proyectos.find(p => p.GenPro === genpro);
    if (!proyecto) return;
    render(proyecto);
    overlay().classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function cerrar() {
    window.GTCharts && window.GTCharts.destroy('chartAvanceModal');
    overlay().classList.add('hidden');
    document.body.style.overflow = '';
  }

  function render(p) {
    const O = window.GTOverrides;
    const desv = diffDias(p.FechaFin, p.FechaLE);
    let desvHTML = '—';
    if (desv != null) {
      if (desv > 0) desvHTML = `<span style="color:var(--state-backlog)">+${desv} días fuera</span>`;
      else if (desv < 0) desvHTML = `<span style="color:var(--state-done)">${desv} días adelanto</span>`;
      else desvHTML = `<span style="color:var(--state-done)">A término</span>`;
    }

    const estadoCls = p.Estado === 'Cumplida' ? 'estado-Cumplida' :
                      p.Estado === 'En Proceso' ? 'estado-EnProceso' :
                      p.Estado === 'Sin Avance' ? 'estado-SinAvance' : '';

    const datoEditable = (label, campo, formatter) => {
      const valor = O.getEffectiveValue(p, campo);
      const isOver = O.isOverridden(p, campo);
      const display = formatter ? formatter(valor) : (valor == null || valor === '' ? '—' : valor);
      return `
        <div class="dato-card editable ${isOver ? 'cell-overridden' : ''}" data-edit="${campo}">
          <span class="pencil-perm" title="Editable">✏</span>
          <div class="dato-label">${label}${isOver ? ' • editado' : ''}</div>
          <div class="dato-value">${display}</div>
        </div>`;
    };

    const datoSimple = (label, valor) => `
      <div class="dato-card">
        <div class="dato-label">${label}</div>
        <div class="dato-value">${valor}</div>
      </div>`;

    const ugClass = ['NQN','GSJ','ACA'].includes(p.UG) ? `ug-${p.UG}` : 'ug-DEF';

    modal().innerHTML = `
      <button class="modal-close" aria-label="Cerrar" id="btnModalClose">×</button>

      <div class="modal-header ${estadoCls}">
        <h2 class="modal-title">${p.Nombre || '—'}</h2>
        <div class="modal-badges">
          <span class="badge ${ugClass}">${p.UG || 'S/UG'}</span>
          ${p.Criticidad ? `<span class="badge ${p.Criticidad === 'Crítico' ? 'crit-yes' : 'crit-no'}">${p.Criticidad}</span>` : ''}
          <span class="badge ${estadoCls}">${p.Estado || '—'}</span>
        </div>
        <div class="modal-meta">
          ${p.GenPro || '—'} · ${p.IDProyecto || '—'} · Ing.: ${p.Ingeniero || '—'} · Año ${p.Anio || '—'}
        </div>
      </div>

      <div class="modal-body">

        <h3 class="modal-section-title">A · Datos clave</h3>
        <div class="datos-grid">
          ${datoSimple('Fecha LE (PEM prevista)', fmtFecha(p.FechaLE))}
          ${datoSimple('Fecha de finalización',   fmtFecha(p.FechaFin))}
          ${datoSimple('Desviación',              desvHTML)}
          ${datoSimple('Avance de tarea',         p.AvanceTarea == null ? '—' : Math.round(p.AvanceTarea) + '%')}
          ${datoSimple('Requiere GR',             p.RequiereGR ? `<span class="badge ${p.RequiereGR === 'SI' ? 'crit-yes' : 'crit-no'}">${p.RequiereGR}</span>` : '—')}
          ${datoSimple('Monto Total GR',          fmtMoney(p.MontoTotal))}
          ${datoEditable('Cant Alta Equipos SAP', 'Equipos')}
          ${datoEditable('Planes Mtto (con tareas)', 'PlanesConTareas')}
          ${datoEditable('Planes Mtto (sin tareas)', 'PlanesSinTareas')}
        </div>

        <h3 class="modal-section-title">B · Avance del Proyecto</h3>
        <div id="chartAvanceModal" style="min-height:280px;"></div>

        <h3 class="modal-section-title">C · Avance de tareas principales</h3>
        ${renderTareas(p)}

        <h3 class="modal-section-title">D · Equipo asignado</h3>
        ${renderEquipo(p)}
      </div>
    `;

    // Render gráfico avance
    setTimeout(() => {
      window.GTCharts.avanceRadial('chartAvanceModal', p.AvanceTarea || 0, p.AvanceObra || 0);
    }, 50);

    // Eventos
    document.getElementById('btnModalClose').addEventListener('click', cerrar);
    overlay().addEventListener('click', (ev) => { if (ev.target === overlay()) cerrar(); });

    // Edición inline en modal
    modal().querySelectorAll('.dato-card.editable').forEach(card => {
      card.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (card.querySelector('input')) return;
        editarCardModal(card, p);
      });
    });
  }

  function renderTimeline(p) {
    const HOY = window.GTTransforms.HOY;
    const fechas = [p.FechaLE, p.FechaFin, HOY].filter(Boolean);
    if (fechas.length < 2) {
      return '<div class="timeline"><p style="color:#64748b;font-size:12px">Datos insuficientes para timeline.</p></div>';
    }
    const min = new Date(Math.min(...fechas) - 7 * 86400000);
    const max = new Date(Math.max(...fechas) + 7 * 86400000);
    const total = max - min;
    const pct = (d) => ((d - min) / total) * 100;

    const pHoy = pct(HOY);
    const pLE  = p.FechaLE ? pct(p.FechaLE) : null;
    const pFin = p.FechaFin ? pct(p.FechaFin) : null;

    let fillHTML = '';
    if (p.FechaFin && p.FechaLE) {
      if (p.FechaFin <= p.FechaLE) {
        fillHTML = `<div class="timeline-fill green" style="left:0;width:${pFin}%"></div>`;
      } else {
        fillHTML = `<div class="timeline-fill green" style="left:0;width:${pLE}%"></div>
                    <div class="timeline-fill red"   style="left:${pLE}%;width:${pFin - pLE}%"></div>`;
      }
    } else if (!p.FechaFin) {
      const tope = Math.min(pHoy, pLE || 100);
      fillHTML = `<div class="timeline-fill blue" style="left:0;width:${tope}%"></div>`;
    }

    const marker = (pos, cls, lbl, fch) =>
      `<div class="timeline-marker ${cls}" style="left:${pos}%">
         <span class="dot" style="background:currentColor"></span>
         <span class="label">${lbl}<br>${fmtFecha(fch)}</span>
       </div>`;

    return `<div class="timeline">
              <div class="timeline-bar">${fillHTML}</div>
              ${marker(pHoy, 'tm-hoy', 'HOY', HOY)}
              ${pLE != null ? marker(pLE, 'tm-le', 'Fecha LE', p.FechaLE) : ''}
              ${pFin != null ? marker(pFin, 'tm-fin', 'Fin Real', p.FechaFin) : ''}
            </div>`;
  }

  function renderTareas(p) {
    const T = window.GTTransforms;
    const tasks = window.GTData.state.tasks || [];
    if (tasks.length === 0) return '<p class="modal-empty">Cargá el archivo de Tasks para ver las tareas.</p>';

    // Match estricto: regex /\/([^\/]+)\// sobre Folder, contra Nombre del proyecto.
    const propias = T.tareasDeProyecto(tasks, p.Nombre);
    if (propias.length === 0) return '<p class="modal-empty">Sin tareas asociadas a este proyecto.</p>';

    // Tareas principales: Parent vacío + Title `^\d+\.\s` (excluye subtareas y la fila raíz).
    const principales = T.filtrarTareasPrincipales(propias);
    if (principales.length === 0) {
      return `<p class="modal-empty">El proyecto tiene ${propias.length} tareas, ninguna identificada como principal (formato "01. ...").</p>`;
    }

    const csColor = (s) => ({
      'Cumplida': '#22c55e', 'En Proceso': '#4f8ef7', 'Sin Avance': '#fb923c',
      'En Revisión': '#a78bfa', 'Cancelada': '#94a3b8'
    }[s] || '#64748b');

    function barra(pct) {
      if (pct == null) return '<span class="task-prog-num task-prog-na">—</span>';
      const v = Math.max(0, Math.min(100, pct));
      let color = '#ef4444';
      if (v > 75) color = '#22c55e';
      else if (v >= 25) color = '#fb923c';
      return `<div class="task-prog"><div class="task-prog-fill" style="width:${v}%;background:${color}"></div></div>
              <span class="task-prog-num">${Math.round(v)}%</span>`;
    }

    return `<div class="tareas-cards">
      ${principales.map(t => {
        const av = T.parseAvanceTarea(t.AvanceTarea);
        return `
        <div class="task-card">
          <div class="task-card-head">
            <span class="task-title" title="${t.Title || ''}">${(t.Title || '').slice(0, 90)}</span>
            <span class="badge" style="background:${csColor(t.CustomStatus)}22;color:${csColor(t.CustomStatus)};border:1px solid ${csColor(t.CustomStatus)}33">${t.CustomStatus || t.Status || '—'}</span>
          </div>
          <div class="task-card-body">
            ${barra(av)}
          </div>
          <div class="task-card-foot">
            <span>👤 ${(t.AssignedTo || 'Sin asignar').slice(0, 28)}</span>
            <span>📅 ${fmtFecha(t.FechaLE)}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  function renderEquipo(p) {
    const arr = p.AsignadoArr || [];
    if (arr.length === 0) return '<p style="color:#64748b;font-size:12px">Sin asignados registrados.</p>';
    return '<div class="equipo-grid">' + arr.map(n => `
      <div class="equipo-item">
        <div class="avatar-lg" style="background:${avatarColor(n)}">${iniciales(n)}</div>
        <div class="equipo-name">${n}</div>
      </div>
    `).join('') + '</div>';
  }

  function editarCardModal(card, proyecto) {
    const O = window.GTOverrides;
    const campo = card.dataset.edit;
    const tipo = 'number';
    const valActual = O.getEffectiveValue(proyecto, campo);
    const valueAttr = valActual == null ? '' : valActual;
    const valueDiv = card.querySelector('.dato-value');
    const original = valueDiv.innerHTML;
    valueDiv.innerHTML = `<input class="cell-input" type="${tipo}" value="${valueAttr}" />`;
    const inp = valueDiv.querySelector('input');
    inp.focus(); inp.select();
    let cancelado = false;

    function guardar() {
      if (cancelado) return;
      const valor = inp.value.trim();
      if (valor === '') {
        O.resetOverride(proyecto.GenPro, campo);
      } else if (!O.VALIDATORS[campo](valor)) {
        inp.classList.add('invalid');
        return;
      } else {
        O.setOverride(proyecto.GenPro, campo, valor);
      }
      cancelado = true;
      // Re-render todo el modal (más simple y consistente)
      render(proyecto);
      // Refrescar tabla y KPIs
      window.GTApp && window.GTApp.refrescarTabla(true);
    }

    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); guardar(); }
      else if (ev.key === 'Escape') { cancelado = true; valueDiv.innerHTML = original; }
    });
    inp.addEventListener('blur', guardar);
  }

  // Cerrar con Escape
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !overlay().classList.contains('hidden')) cerrar();
  });

  window.GTModal = { abrir, cerrar };
})();

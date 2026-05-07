/* ============================================================
   kpis.js — Strip de 4 KPIs principales con animación odometer
   Expone: window.GTKPIs
   ============================================================ */
(function () {
  'use strict';

  function fmtMoney(n) {
    if (!n && n !== 0) return '$0';
    return '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('es-AR'); }
  function fmtPct(n) { return (Math.round(n * 10) / 10).toFixed(1) + '%'; }
  function fmtPctInt(n) { return Math.round(n) + '%'; }

  function animarNumero(el, valorFinal, duracion = 1200, formatter = fmtInt) {
    if (!el) return;
    const inicio = performance.now();
    function step(now) {
      const t = Math.min(1, (now - inicio) / duracion);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = valorFinal * eased;
      el.textContent = formatter(v);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = formatter(valorFinal);
    }
    requestAnimationFrame(step);
  }

  function gaugeSVG(pct) {
    const p = Math.max(0, Math.min(100, pct));
    const r = 50, cx = 70, cy = 60;
    const angSt = Math.PI;
    const angEn = Math.PI - (p / 100) * Math.PI;
    const x1 = cx + r * Math.cos(angSt), y1 = cy - r * Math.sin(angSt);
    const x2 = cx + r * Math.cos(angEn), y2 = cy - r * Math.sin(angEn);
    const largeArc = p > 50 ? 1 : 0;
    return `
      <svg viewBox="0 0 140 80" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gg" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%"  stop-color="#4f8ef7"/>
            <stop offset="100%" stop-color="#22c55e"/>
          </linearGradient>
        </defs>
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
              fill="none" stroke="var(--gauge-track)" stroke-width="10" stroke-linecap="round" />
        <path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}"
              fill="none" stroke="url(#gg)" stroke-width="10" stroke-linecap="round" />
        <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="gauge-text" style="font-size:18px;">${fmtPctInt(p)}</text>
      </svg>`;
  }

  function renderKPIStrip(kpis, ugMap, pulse = false) {
    const cont = document.getElementById('kpiStrip');
    if (!cont) return;

    const quickActivo = (window.GTFilters && window.GTFilters.state.quickChip) || '';
    const cls = (q) => 'kpi-card kpi-clickable' +
      (q === 'cumplidos' ? ' kpi-green' : q === 'pendientes' ? ' kpi-yellow' : ' kpi-pink') +
      (pulse ? ' pulse' : '') + (quickActivo === q ? ' active' : '');

    cont.innerHTML = `
      <div class="${cls('cumplidos')}" data-quick="cumplidos" role="button" tabindex="0" title="Click para filtrar por Cumplidos">
        <div class="kpi-icon">✓</div>
        <div class="kpi-value" id="kpiCumplidos">0</div>
        <div class="kpi-label">Cumplidos</div>
        <div class="kpi-sub">${kpis.total} proyectos totales</div>
      </div>

      <div class="${cls('pendientes')}" data-quick="pendientes" role="button" tabindex="0" title="Click para filtrar por Pendientes no vencidos">
        <div class="kpi-icon">⏱</div>
        <div class="kpi-value" id="kpiPendientes">0</div>
        <div class="kpi-label">Pendientes no vencidos</div>
        <div class="kpi-sub">Fecha LE futura</div>
      </div>

      <div class="${cls('backlog')}" data-quick="backlog" role="button" tabindex="0" title="Click para filtrar por Backlog">
        <div class="kpi-icon">⚠</div>
        <div class="kpi-value" id="kpiBacklog">0</div>
        <div class="kpi-label">Backlog</div>
        <div class="kpi-sub">Vencidos no cumplidos</div>
      </div>

      <div class="kpi-card kpi-purple kpi-gauge-card${pulse ? ' pulse' : ''}">
        <div class="kpi-gauge-info">
          <div class="kpi-label">% GT Entregada</div>
          <div class="kpi-sub">${kpis.cumplidos} de ${kpis.total}</div>
        </div>
        <div class="kpi-gauge-svg" id="kpiPctGTGauge">${gaugeSVG(kpis.pctEntregada)}</div>
        <span id="kpiPctGT" class="hidden">0%</span>
      </div>
    `;

    // Click-to-filter sobre las 3 tarjetas KPI principales
    cont.querySelectorAll('.kpi-clickable').forEach(card => {
      const handler = () => {
        const q = card.dataset.quick;
        const F = window.GTFilters;
        if (!F) return;
        if (F.state.quickChip === q) F.setFiltro('quickChip', '');
        else F.setFiltro('quickChip', q);
        if (window.GTApp && window.GTApp.refrescarTodo) window.GTApp.refrescarTodo(true);
      };
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); handler(); }
      });
    });

    animarNumero(document.getElementById('kpiCumplidos'),  kpis.cumplidos, 1100, fmtInt);
    animarNumero(document.getElementById('kpiPendientes'), kpis.pendientes,1100, fmtInt);
    animarNumero(document.getElementById('kpiBacklog'),    kpis.backlog,   1100, fmtInt);
    // Animar el odómetro de % GT redibujando el SVG
    const gaugeEl = document.getElementById('kpiPctGTGauge');
    if (gaugeEl) {
      const final = kpis.pctEntregada || 0;
      const t0 = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - t0) / 1100);
        const eased = 1 - Math.pow(1 - t, 3);
        gaugeEl.innerHTML = gaugeSVG(final * eased);
        if (t < 1) requestAnimationFrame(tick);
        else gaugeEl.innerHTML = gaugeSVG(final);
      }
      requestAnimationFrame(tick);
    }

    const setText = (id, val, fn = fmtInt) => { const e = document.getElementById(id); if (e) e.textContent = fn(val); };
    setText('miniEquipos', kpis.equipos);
    setText('miniPlanes',  kpis.planes);
    setText('miniMonto',   kpis.monto, fmtMoney);
  }

  window.GTKPIs = { renderKPIStrip, fmtMoney, fmtInt, fmtPct, fmtPctInt, animarNumero };
})();

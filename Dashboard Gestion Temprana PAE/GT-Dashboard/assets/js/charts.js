/* ============================================================
   charts.js — ApexCharts (G1 Curva S · G3 Donut UG ·
                          G4 Monto GR · G6 Planes Mtto)
   Expone: window.GTCharts
   ============================================================ */
(function () {
  'use strict';

  const charts = {};

  const COLOR = {
    NQN: '#4f8ef7', GSJ: '#38c9b0', ACA: '#fb923c', 'S/UG': '#94a3b8',
    plan: '#94a3b8', real: '#22c55e'
  };

  function destroy(id) {
    if (charts[id]) { try { charts[id].destroy(); } catch (e) {} delete charts[id]; }
  }
  function fmtMoney(n) { return '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 }); }

  // Construye agrupación por mes para xaxis.group de ApexCharts a partir
  // de etiquetas ISO tipo "YYYY-Www". Devuelve { groups: [{title, cols}, ...], style }.
  const MESES_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  function isoWeekToMonth(label) {
    const m = /^(\d{4})-W(\d{1,2})$/.exec(label || '');
    if (!m) return '';
    const y = +m[1], w = +m[2];
    // Jueves de la semana ISO (jueves siempre cae en el mes "oficial" de la semana)
    const simple = new Date(Date.UTC(y, 0, 1 + (w - 1) * 7));
    const dow = simple.getUTCDay() || 7;
    const thursday = new Date(simple);
    thursday.setUTCDate(simple.getUTCDate() + (4 - dow));
    return MESES_ABBR[thursday.getUTCMonth()] + ' ' + String(thursday.getUTCFullYear()).slice(-2);
  }
  function buildMonthGroups(semanas) {
    if (!semanas || !semanas.length) return undefined;
    const groups = [];
    let cur = null;
    semanas.forEach(s => {
      const mes = isoWeekToMonth(s);
      if (cur && cur.title === mes) cur.cols++;
      else { cur = { title: mes, cols: 1 }; groups.push(cur); }
    });
    return { style: { fontSize: '10px', fontWeight: 700, colors: ejeColor() }, groups };
  }

  // Detectar tema actual para colores adaptativos
  function tema() { return document.body.dataset.theme || 'light'; }
  function ejeColor() { return tema() === 'dark' ? '#cbd5e1' : tema() === 'medium' ? '#cbd5e1' : '#475569'; }
  function gridColor() { return tema() === 'dark' ? 'rgba(255,255,255,0.07)' : tema() === 'medium' ? 'rgba(255,255,255,0.08)' : '#e2e8f0'; }

  // ===== G1: Curva S "Todos Proyectos GT" =====
  // Plan violeta punteado + Real verde sólido, áreas con relleno suave.
  function curvaS(elId, data) {
    destroy(elId);
    const el = document.getElementById(elId);
    if (!el) return;

    const semanasArr = data.semanas || (data.plan || []).map(p => p.x);
    const monthFirst = {};
    let _prevMes = '';
    semanasArr.forEach(w => {
      const mes = isoWeekToMonth(w);
      if (mes && mes !== _prevMes) { monthFirst[w] = mes; _prevMes = mes; }
    });

    const annXaxis = [];
    // Marcadores sutiles al inicio de cada mes
    Object.keys(monthFirst).forEach(s => {
      annXaxis.push({
        x: s,
        borderColor: gridColor(),
        strokeDashArray: 0,
        opacity: 0.6
      });
    });
    if (data.semanaActual) {
      annXaxis.push({
        x: data.semanaActual,
        borderColor: tema() === 'light' ? '#94a3b8' : '#cbd5e1',
        strokeDashArray: 5,
        label: {
          borderColor: 'transparent',
          style: { color: '#fff', background: '#475569', fontSize: '10px', fontWeight: 700 },
          text: 'Hoy',
          position: 'top'
        }
      });
    }
    // Línea horizontal de Meta 100%
    const annYaxis = [{
      y: 100,
      borderColor: '#94a3b8',
      strokeDashArray: 6,
      label: {
        borderColor: 'transparent',
        style: { color: '#fff', background: '#475569', fontSize: '10px', fontWeight: 700 },
        text: 'Meta del Proyecto 2026 (100%)',
        position: 'right',
        offsetX: -8
      }
    }];

    const opts = {
      chart: {
        type: 'area', height: 260, toolbar: { show: false },
        animations: { enabled: true, speed: 700 },
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        background: 'transparent',
        zoom: { enabled: false }
      },
      theme: { mode: tema() === 'light' ? 'light' : 'dark' },
      series: [
        { name: 'Plan', data: data.plan },
        { name: 'Real', data: data.real }
      ],
      colors: ['#a78bfa', '#22c55e'],
      stroke: { curve: 'smooth', width: 2, dashArray: [6, 0] },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: [0.05, 0.5],
          opacityTo: 0,
          stops: [0, 95, 100]
        }
      },
      markers: { size: 0, strokeWidth: 0, hover: { size: 5 } },
      dataLabels: { enabled: false },
      annotations: { xaxis: annXaxis, yaxis: annYaxis },
      xaxis: {
        type: 'category',
        tickPlacement: 'on',
        group: buildMonthGroups(semanasArr),
        labels: {
          style: { fontSize: '9px', colors: ejeColor(), fontWeight: 600 },
          rotate: 0, hideOverlappingLabels: false, trim: false,
          formatter: (v) => {
            if (!v) return '';
            const m = /^(\d{4})-W(\d{1,2})$/.exec(String(v));
            if (!m) return String(v);
            return 'S' + parseInt(m[2], 10);
          }
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
        crosshairs: { stroke: { color: gridColor(), dashArray: 3 } }
      },
      yaxis: {
        min: 0,
        max: 100,
        tickAmount: 10,
        title: {
          text: 'Porcentaje de Avance',
          style: { fontSize: '11px', color: ejeColor(), fontWeight: 600 }
        },
        labels: {
          style: { fontSize: '10px', colors: ejeColor(), fontWeight: 400 },
          formatter: (v) => v == null ? '' : Math.round(v) + '%'
        }
      },
      tooltip: {
        theme: tema() === 'light' ? 'light' : 'dark',
        shared: true, intersect: false,
        custom: ({ dataPointIndex, w }) => {
          const semana = (data.semanas || [])[dataPointIndex] || '';
          const planY = w.globals.series[0] && w.globals.series[0][dataPointIndex];
          const realY = w.globals.series[1] && w.globals.series[1][dataPointIndex];
          const planAcum = (data.planCantAcum || [])[dataPointIndex];
          const realAcum = (data.realCantAcum || [])[dataPointIndex];
          const fmtPct = v => (v == null) ? '— (sin dato)' : Number(v).toFixed(1) + '%';
          const fmtN   = v => (v == null) ? '—' : Number(v).toLocaleString('es-AR');
          return `
            <div class="apex-tt-curva">
              <div class="apex-tt-title">${semana}</div>
              <div class="apex-tt-row"><span class="dot" style="background:#a78bfa"></span>% Plan: <b>${fmtPct(planY)}</b></div>
              <div class="apex-tt-row"><span class="dot" style="background:#22c55e"></span>% Real: <b>${fmtPct(realY)}</b></div>
              <div class="apex-tt-sep"></div>
              <div class="apex-tt-row">Planificados (acum.): <b>${fmtN(planAcum)}</b></div>
              <div class="apex-tt-row">Reales (acum.): <b>${fmtN(realAcum)}</b></div>
            </div>`;
        }
      },
      legend: {
        position: 'top', horizontalAlign: 'right',
        fontSize: '11px',
        labels: { colors: ejeColor() },
        markers: { width: 12, height: 12, radius: 4 },
        itemMargin: { horizontal: 5, vertical: 2 }
      },
      grid: {
        show: false,
        padding: { top: 8, right: 16, bottom: 0, left: 8 }
      },
      noData: { text: 'Sin datos suficientes para Curva S', style: { color: ejeColor(), fontSize: '13px' } }
    };

    charts[elId] = new ApexCharts(el, opts);
    charts[elId].render();
  }

  // ===== G3: Donut UG =====
  function donutUG(elId, ugMap) {
    destroy(elId);
    const el = document.getElementById(elId);
    if (!el) return;
    const labels = Object.keys(ugMap);
    const series = labels.map(k => ugMap[k]);
    const total = series.reduce((a, b) => a + b, 0);

    const opts = {
      chart: { type: 'donut', height: 220, fontFamily: 'Segoe UI, system-ui, sans-serif', background: 'transparent' },
      theme: { mode: tema() === 'light' ? 'light' : 'dark' },
      series, labels,
      colors: labels.map(l => COLOR[l] || '#94a3b8'),
      legend: { position: 'bottom', horizontalAlign: 'center', fontSize: '12px', labels: { colors: ejeColor() }, markers: { width: 12, height: 12, radius: 4 } },
      stroke: { width: 2, colors: [tema() === 'light' ? '#fff' : '#1e2a3a'] },
      dataLabels: {
        // Cantidad entera en cada tajada (no %)
        formatter: (val, opts) => {
          const s = opts.w && opts.w.config && opts.w.config.series;
          return s ? s[opts.seriesIndex] : Math.round(val);
        },
        style: { fontSize: '12px', fontWeight: 700, colors: ['#000000'] },
        dropShadow: { enabled: false }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '70%',
            labels: {
              show: true,
              name: { color: ejeColor() },
              value: { color: ejeColor(), fontSize: '24px', fontWeight: 700 },
              total: {
                show: true, label: 'Total', color: ejeColor(),
                formatter: () => total
              }
            }
          }
        }
      },
      tooltip: {
        theme: tema() === 'light' ? 'light' : 'dark',
        y: {
          formatter: (val) => {
            const t = total || 1;
            return `${val} (${(val / t * 100).toFixed(1)}%)`;
          }
        }
      },
      noData: { text: 'Sin datos', style: { color: ejeColor() } }
    };
    charts[elId] = new ApexCharts(el, opts);
    charts[elId].render();
  }

  // ===== G3-bis: Barras horizontales agrupadas Crítico vs No Crítico por UG =====
  function barrasCriticidad(elId, info) {
    destroy(elId);
    const el = document.getElementById(elId);
    if (!el) return;
    const cri = (info && info.Critico)   || { total: 0, porUG: {} };
    const noc = (info && info.NoCritico) || { total: 0, porUG: {} };

    // Unión ordenada de UGs (NQN → GSJ → ACA → resto)
    const orden = ['NQN', 'GSJ', 'ACA'];
    const setUG = new Set([...Object.keys(cri.porUG), ...Object.keys(noc.porUG)]);
    const ugs = [
      ...orden.filter(u => setUG.has(u)),
      ...[...setUG].filter(u => !orden.includes(u)).sort()
    ];
    if (ugs.length === 0) { el.innerHTML = ''; return; }

    const dataCri = ugs.map(u => +cri.porUG[u] || 0);
    const dataNoc = ugs.map(u => +noc.porUG[u] || 0);
    const maxV = Math.max(...dataCri, ...dataNoc, 1);

    const opts = {
      chart: {
        type: 'bar', height: 240, toolbar: { show: false },
        fontFamily: 'Segoe UI, system-ui, sans-serif', background: 'transparent',
        stacked: false, animations: { enabled: true, speed: 600 }
      },
      theme: { mode: tema() === 'light' ? 'light' : 'dark' },
      series: [
        { name: 'Crítico',    data: dataCri },
        { name: 'No Crítico', data: dataNoc }
      ],
      colors: ['#f59595', '#7eb3e8'],
      plotOptions: {
        bar: {
          horizontal: true, borderRadius: 6, borderRadiusApplication: 'end',
          barHeight: '70%',
          dataLabels: { position: 'top' }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (v) => v > 0 ? Number(v).toLocaleString('es-AR') : '',
        style: { fontSize: '11px', fontWeight: 700, colors: ['#1f2937'] },
        offsetX: 22
      },
      xaxis: {
        categories: ugs,
        max: Math.ceil(maxV * 1.15),
        labels: { show: false, style: { fontSize: '10px', colors: ejeColor() } },
        axisBorder: { show: false }, axisTicks: { show: false }
      },
      yaxis: {
        labels: { style: { fontSize: '12px', colors: ejeColor(), fontWeight: 700 } }
      },
      legend: {
        position: 'top', horizontalAlign: 'right', fontSize: '11px',
        labels: { colors: ejeColor() },
        markers: { width: 12, height: 12, radius: 4 }
      },
      tooltip: {
        theme: tema() === 'light' ? 'light' : 'dark',
        y: { formatter: (v) => Number(v).toLocaleString('es-AR') + ' proyectos' }
      },
      grid: { show: false, padding: { top: 8, right: 24, bottom: 0, left: 8 } },
      noData: { text: 'Sin datos', style: { color: ejeColor() } }
    };
    charts[elId] = new ApexCharts(el, opts);
    charts[elId].render();
  }

  // ===== G4: Monto total GR por UG (Toggle ROT / AIEC / TODOS, una sola serie) =====
  // info = { ugs, desglose: {ug:{ZI,ZA,Z6,Z3,Z1}}, totalGral: {ug:n}, zList: [...] }
  function fmtMoneyShort(v) {
    if (!v) return '$0';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
    return '$' + Math.round(v);
  }
  function barrasGR(elId, info, opcionesUI) {
    destroy(elId);
    const el = document.getElementById(elId);
    if (!el) return;
    const ugs = info.ugs || [];
    if (ugs.length === 0) { el.innerHTML = ''; return; }

    const t = (opcionesUI && opcionesUI.tipo) || 'ROT';
    const tipo = ['ROT', 'AIEC', 'TODOS'].includes(t) ? t : 'ROT';

    const data = ugs.map(ug => {
      if (tipo === 'TODOS') return Math.round(info.totalGral[ug] || 0);
      const d = info.desglose[ug] || {};
      return Math.round(['ZI','ZA','Z6','Z3','Z1'].reduce((s, z) => s + (d[z] || 0), 0));
    });

    const opts = {
      chart: {
        type: 'bar', height: 240, toolbar: { show: false },
        fontFamily: 'Segoe UI, system-ui, sans-serif', background: 'transparent',
        animations: { enabled: true, speed: 600 }
      },
      theme: { mode: tema() === 'light' ? 'light' : 'dark' },
      series: [{ name: tipo, data }],
      colors: ugs.map(u => COLOR[u] || '#94a3b8'),
      plotOptions: {
        bar: {
          horizontal: false, borderRadius: 6, borderRadiusApplication: 'end',
          columnWidth: '55%', distributed: true
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (v) => v ? fmtMoneyShort(v) : '',
        style: { fontSize: '11px', fontWeight: 700, colors: [ejeColor()] },
        offsetY: -18
      },
      xaxis: {
        categories: ugs,
        labels: { style: { fontSize: '12px', colors: ejeColor(), fontWeight: 700 } },
        axisBorder: { show: false }, axisTicks: { show: false }
      },
      yaxis: { show: false, labels: { show: false } },
      tooltip: { theme: tema() === 'light' ? 'light' : 'dark', y: { formatter: fmtMoney } },
      legend: { show: false },
      grid: { show: false, padding: { top: 18, right: 8, bottom: 0, left: 8 } }
    };
    charts[elId] = new ApexCharts(el, opts);
    charts[elId].render();
  }

  // ===== Alta de Equipos en SAP por UG (barras verticales, un color por UG) =====
  function equiposUG(elId, mapEquipos) {
    destroy(elId);
    const el = document.getElementById(elId);
    if (!el) return;
    const ugs = Object.keys(mapEquipos).filter(u => (mapEquipos[u] || 0) > 0);
    if (ugs.length === 0) { el.innerHTML = ''; return; }
    const totales = ugs.map(u => mapEquipos[u]);

    const opts = {
      chart: {
        type: 'bar', height: 220, toolbar: { show: false },
        fontFamily: 'Segoe UI, system-ui, sans-serif', background: 'transparent',
        animations: { enabled: true, speed: 700 }
      },
      theme: { mode: tema() === 'light' ? 'light' : 'dark' },
      series: [{ name: 'Equipos SAP', data: totales }],
      colors: ugs.map(u => COLOR[u] || '#94a3b8'),
      plotOptions: {
        bar: {
          horizontal: false, borderRadius: 6, borderRadiusApplication: 'end',
          columnWidth: '55%', distributed: true
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (v) => !v ? '' : Number(v).toLocaleString('es-AR'),
        style: { fontSize: '11px', colors: [ejeColor()], fontWeight: 700 },
        offsetY: -18
      },
      xaxis: {
        categories: ugs,
        labels: { style: { fontSize: '12px', colors: ejeColor(), fontWeight: 700 } },
        axisBorder: { show: false }, axisTicks: { show: false }
      },
      yaxis: { show: false, labels: { show: false } },
      tooltip: { theme: tema() === 'light' ? 'light' : 'dark', y: { formatter: (v) => Number(v).toLocaleString('es-AR') + ' equipos' } },
      legend: { show: false },
      grid: { show: false, padding: { top: 12, right: 8, bottom: 0, left: 8 } }
    };
    charts[elId] = new ApexCharts(el, opts);
    charts[elId].render();
  }

  // ===== Alta Planes Mtto SAP por UG — barras horizontales agrupadas =====
  // info = { ugs:[...], total:{ug:n}, conSinTareas:{ug:n}, conTareas:{ug:n}, sinTareas:{ug:n} }
  // Réplica estructural del gráfico "Críticos vs No Críticos" con paleta pastel propia.
  function planesUGAgrupado(elId, info) {
    destroy(elId);
    const el = document.getElementById(elId);
    if (!el) return;
    const ugs = (info && info.ugs) || [];
    if (ugs.length === 0) { el.innerHTML = ''; return; }

    const dataTotal = ugs.map(u => +info.total[u] || 0);
    const dataConT  = ugs.map(u => +info.conTareas[u] || 0);
    const dataSinT  = ugs.map(u => +info.sinTareas[u] || 0);
    const maxV = Math.max(...dataTotal, ...dataConT.map((v,i)=>v+dataSinT[i]), 1);

    const opts = {
      chart: {
        type: 'bar', height: 240, toolbar: { show: false },
        fontFamily: 'Segoe UI, system-ui, sans-serif', background: 'transparent',
        stacked: true, animations: { enabled: true, speed: 600 }
      },
      theme: { mode: tema() === 'light' ? 'light' : 'dark' },
      series: [
        { name: 'Total Planes', group: 'total',   data: dataTotal },
        { name: 'Con Tareas',   group: 'detalle', data: dataConT  },
        { name: 'Sin Tareas',   group: 'detalle', data: dataSinT  }
      ],
      // Paleta pastel viva definida por el usuario
      colors: ['#5AE0A1', '#EBA1FF', '#DA5A9A'],
      plotOptions: {
        bar: {
          horizontal: true, borderRadius: 6, borderRadiusApplication: 'end', borderRadiusWhenStacked: 'all',
          barHeight: '70%',
          dataLabels: { position: 'center', total: { enabled: false } }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (v) => v > 0 ? Number(v).toLocaleString('es-AR') : '',
        style: { fontSize: '11px', fontWeight: 700, colors: ['#1f2937'] }
      },
      xaxis: {
        categories: ugs,
        max: Math.ceil(maxV * 1.18),
        labels: { show: false, style: { fontSize: '10px', colors: ejeColor() } },
        axisBorder: { show: false }, axisTicks: { show: false }
      },
      yaxis: {
        labels: { style: { fontSize: '12px', colors: ejeColor(), fontWeight: 700 } }
      },
      legend: {
        position: 'top', horizontalAlign: 'right', fontSize: '11px',
        labels: { colors: ejeColor() },
        markers: { width: 12, height: 12, radius: 4 }
      },
      tooltip: {
        theme: tema() === 'light' ? 'light' : 'dark',
        y: { formatter: (v) => Number(v).toLocaleString('es-AR') + ' planes' }
      },
      grid: { show: false, padding: { top: 8, right: 24, bottom: 0, left: 8 } },
      noData: { text: 'Sin datos', style: { color: ejeColor() } }
    };
    charts[elId] = new ApexCharts(el, opts);
    charts[elId].render();
  }

  // ===== Alta Planes Mtto SAP por UG (barras horizontales) =====
  function planesUG(elId, mapPlanes) {
    destroy(elId);
    const el = document.getElementById(elId);
    if (!el) return;
    const ugs = Object.keys(mapPlanes);
    const series = ugs.map(u => mapPlanes[u] || 0);

    const opts = {
      chart: { type: 'bar', height: 220, toolbar: { show: false }, fontFamily: 'Segoe UI, system-ui, sans-serif', background: 'transparent' },
      theme: { mode: tema() === 'light' ? 'light' : 'dark' },
      series: [{ name: 'Planes Mtto', data: series }],
      colors: ugs.map(u => COLOR[u] || '#94a3b8'),
      plotOptions: {
        bar: {
          horizontal: true, borderRadius: 6, borderRadiusApplication: 'end',
          barHeight: '60%',
          distributed: true,
          dataLabels: { position: 'top' }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (v) => !v ? '' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : Number(v).toLocaleString('es-AR'),
        style: { fontSize: '11px', colors: [ejeColor()], fontWeight: 700 },
        offsetX: 28
      },
      xaxis: {
        categories: ugs,
        labels: { show: false, style: { fontSize: '11px', colors: ejeColor() } },
        axisBorder: { show: false }, axisTicks: { show: false }
      },
      yaxis: { labels: { style: { fontSize: '12px', colors: ejeColor(), fontWeight: 700 } } },
      tooltip: { theme: tema() === 'light' ? 'light' : 'dark', y: { formatter: (v) => Number(v).toLocaleString('es-AR') + ' planes' } },
      legend: { show: false },
      grid: { show: false, padding: { top: 8, right: 30, bottom: 0, left: 8 } }
    };
    charts[elId] = new ApexCharts(el, opts);
    charts[elId].render();
  }

  // ===== Modal: RadialBar avance =====
  function avanceRadial(elId, tarea, obra) {
    destroy(elId);
    const el = document.getElementById(elId);
    if (!el) return;
    const opts = {
      chart: { type: 'radialBar', height: 280, fontFamily: 'Segoe UI, system-ui, sans-serif', background: 'transparent' },
      theme: { mode: tema() === 'light' ? 'light' : 'dark' },
      series: [Math.round(tarea || 0), Math.round(obra || 0)],
      labels: ['Avance Tarea', 'Avance Obra'],
      colors: ['#4f8ef7', '#38c9b0'],
      plotOptions: {
        radialBar: {
          dataLabels: {
            name: { fontSize: '12px', color: ejeColor() },
            value: { fontSize: '14px', fontWeight: 600, color: ejeColor(), formatter: v => v + '%' },
            total: { show: true, label: 'Avance', color: ejeColor(), formatter: () => Math.round((tarea || 0)) + '%' }
          },
          hollow: { size: '50%' },
          track: { background: gridColor() }
        }
      },
      legend: { show: true, position: 'bottom', fontSize: '11px', labels: { colors: ejeColor() } }
    };
    charts[elId] = new ApexCharts(el, opts);
    charts[elId].render();
  }

  function destroyAll() { Object.keys(charts).forEach(destroy); }

  window.GTCharts = {
    curvaS, donutUG, barrasCriticidad, barrasGR, equiposUG, planesUG, planesUGAgrupado, avanceRadial,
    fmtMoneyShort,
    destroy, destroyAll
  };
})();

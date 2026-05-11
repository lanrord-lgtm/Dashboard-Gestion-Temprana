/* ============================================================
   pdfReport.js — Reporte Ejecutivo de Gestión Temprana en PDF
   Pan American Energy · Reliability & Maintenance
   Expone: window.GTPdfReport.generar()
   ============================================================ */
(function () {
  'use strict';

  // Paleta corporativa
  const COL = {
    primary:    [11, 35, 67],     // Azul oscuro PAE
    accent:     [0, 158, 134],    // Verde corporativo
    accentSoft: [168, 216, 201],  // Verde menta pastel
    lavanda:    [201, 184, 232],  // Lavanda pastel
    danger:     [194, 65, 65],    // Rojo alerta
    warn:       [222, 153, 47],
    text:       [40, 50, 65],
    muted:      [110, 120, 135],
    line:       [220, 226, 235],
    bg:         [248, 250, 253]
  };

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  function fmtMoney(n) {
    if (!n || isNaN(n)) return '$0';
    const v = Math.round(n);
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
    return '$' + v.toLocaleString('es-AR');
  }
  function fmtMoneyLargo(n) {
    return '$' + Math.round(n || 0).toLocaleString('es-AR');
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('es-AR'); }
  function fmtPct(n, dec=1) { return (Number(n || 0).toFixed(dec)) + '%'; }

  function tituloPeriodo() {
    const F = window.GTFilters && window.GTFilters.state;
    let mes, anio;
    if (F && F.Anio) {
      anio = F.Anio;
      const hoy = new Date();
      mes = MESES[hoy.getMonth()];
    } else {
      const ref = (window.GTTransforms && window.GTTransforms.HOY) || new Date();
      mes = MESES[ref.getMonth()];
      anio = ref.getFullYear();
    }
    return `${mes} ${anio}`;
  }

  function vistaActual() {
    return (window.GTApp && window.GTApp.vista) || 'generales';
  }
  function vistaLabel() {
    return vistaActual() === 'wellpads' ? 'Gestión Wellpads' : 'Proyectos Generales';
  }

  // Aplica los mismos filtros que el dashboard
  function proyectosFiltrados(vistaForzada) {
    const D = window.GTData, F = window.GTFilters;
    const vista = vistaForzada || vistaActual();
    return F.aplicar(D.proyectosPorVista(vista));
  }

  function filtrosActivosTexto() {
    const F = window.GTFilters && window.GTFilters.state;
    if (!F) return '';
    const partes = [];
    if (F.UG)     partes.push(`UG: ${F.UG}`);
    if (F.Estado) partes.push(`Estado: ${F.Estado}`);
    if (F.Anio)   partes.push(`Año: ${F.Anio}`);
    if (F.nombre) partes.push(`Nombre: "${F.nombre}"`);
    return partes.length ? partes.join(' · ') : 'Sin filtros aplicados';
  }

  // Captura un gráfico ApexCharts en canvas → dataURL. Devuelve null si vacío.
  async function capturarChart(elId) {
    const el = document.getElementById(elId);
    if (!el || !el.children.length) return null;
    // Detección de "sin datos": ApexCharts a veces deja el div pero sin SVG renderizado
    const svg = el.querySelector('svg');
    if (!svg) return null;
    try {
      const canvas = await window.html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      });
      return canvas.toDataURL('image/png');
    } catch (_) {
      return null;
    }
  }

  // ===== Helpers de pintura =====
  function setFill(doc, c) { doc.setFillColor(c[0], c[1], c[2]); }
  function setText(doc, c) { doc.setTextColor(c[0], c[1], c[2]); }
  function setDraw(doc, c) { doc.setDrawColor(c[0], c[1], c[2]); }

  // Cabecera de página + footer (se llama en cada página)
  function dibujarMarco(doc, pagNum, totalPagsRef) {
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Banda superior
    setFill(doc, COL.primary);
    doc.rect(0, 0, W, 14, 'F');
    setText(doc, [255, 255, 255]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('PAN AMERICAN ENERGY · Reliability & Maintenance', 10, 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Reporte Ejecutivo de Gestión Temprana', W - 10, 9, { align: 'right' });

    // Footer
    setText(doc, COL.muted);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    const ts = new Date().toLocaleString('es-AR');
    doc.text(`Generado: ${ts}`, 10, H - 6);
    doc.text(`Página ${pagNum}`, W - 10, H - 6, { align: 'right' });
    setDraw(doc, COL.line);
    doc.setLineWidth(0.2);
    doc.line(10, H - 10, W - 10, H - 10);
  }

  function tituloSeccion(doc, y, num, titulo) {
    setFill(doc, COL.accent);
    doc.rect(10, y - 4, 4, 6, 'F');
    setText(doc, COL.primary);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text(`${num}. ${titulo}`, 17, y + 1);
    setDraw(doc, COL.line); doc.setLineWidth(0.3);
    doc.line(10, y + 4, doc.internal.pageSize.getWidth() - 10, y + 4);
    return y + 10;
  }

  function viñeta(doc, x, y, texto, opts = {}) {
    setFill(doc, opts.color || COL.accent);
    doc.circle(x + 1.4, y - 1.2, 0.9, 'F');
    setText(doc, COL.text);
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setFontSize(opts.size || 9.5);
    doc.text(texto, x + 4.5, y, { maxWidth: opts.maxWidth || 175 });
  }

  // ===== Construcción del reporte =====
  async function generar() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      window.GTApp && window.GTApp.toast('jsPDF no cargado', 'error'); return;
    }
    if (!window.html2canvas) {
      window.GTApp && window.GTApp.toast('html2canvas no cargado', 'error'); return;
    }

    window.GTApp && window.GTApp.toast('Generando PDF…');

    const T = window.GTTransforms;
    const D = window.GTData;

    // Datos base
    const filtrados = proyectosFiltrados();
    const kpis = T.calcularKPIs(filtrados);
    const cs = T.curvaS(filtrados);

    // Snapshot Generales vs Wellpads (mismos filtros UG/Estado/Año aplicados)
    const generales = proyectosFiltrados('generales');
    const wellpads  = proyectosFiltrados('wellpads');
    const kpiGen = T.calcularKPIs(generales);
    const kpiWp  = T.calcularKPIs(wellpads);

    // Distribución GR por UG (tipo TODOS = ROT+AIEC)
    const grUG = T.montoGRDesglosadoPorUG(filtrados, 'ROT', '');
    const totalGR = (grUG.ugs || []).reduce((s, ug) => s + (grUG.totalGral[ug] || 0), 0);

    // Top 5 proyectos por Monto GR
    const top5 = [...filtrados]
      .filter(p => (p.MontoTotal || 0) > 0)
      .sort((a, b) => (b.MontoTotal || 0) - (a.MontoTotal || 0))
      .slice(0, 5);

    // Backlog detalle (proyectos vencidos no cumplidos)
    const HOY = T.HOY;
    const backlogProy = filtrados
      .filter(p => p.FechaLE && p.FechaLE < HOY && p.Estado !== 'Cumplida')
      .sort((a, b) => a.FechaLE - b.FechaLE)
      .slice(0, 5);

    // Capturar gráficos
    const imgs = {
      curvaS:    await capturarChart('chartCurvaTodos'),
      criticidad: await capturarChart('chartCriticidadBarras'),
      gr:         await capturarChart('chartBarrasGR'),
      planes:     await capturarChart('chartPlanesUG')
    };
    const notasFalta = [];
    if (!imgs.curvaS)    notasFalta.push('Curva S');
    if (!imgs.criticidad) notasFalta.push('Críticos vs No Críticos');
    if (!imgs.gr)         notasFalta.push('Monto GR por UG');
    if (!imgs.planes)     notasFalta.push('Alta Planes Mtto SAP');

    // Crear documento
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    let pag = 1;
    dibujarMarco(doc, pag);

    // ----- Portada -----
    let y = 28;
    setText(doc, COL.primary);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text(`Reporte Ejecutivo de Gestión Temprana — ${tituloPeriodo()}`, 10, y, { maxWidth: W - 20 });
    y += 9;
    setText(doc, COL.muted);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Vista: ${vistaLabel()}  ·  ${filtrosActivosTexto()}`, 10, y);
    y += 5;
    doc.text(`Total proyectos en vista: ${fmtInt(kpis.total)}  ·  Cumplidos: ${fmtInt(kpis.cumplidos)} (${fmtPct(kpis.pctEntregada)})  ·  Backlog: ${fmtInt(kpis.backlog)}`, 10, y);
    y += 9;

    // ----- 1. Snapshot de Portafolio -----
    y = tituloSeccion(doc, y, 1, 'Snapshot de Portafolio');
    const headerSnap = ['Portafolio', 'Proyectos', '% Entrega', '% A Término', 'Equipos SAP', 'Planes Mtto', 'Monto GR'];
    const filasSnap = [
      ['Proyectos Generales', fmtInt(kpiGen.total), fmtPct(kpiGen.pctEntregada), fmtPct(kpiGen.pctATermino), fmtInt(kpiGen.equipos), fmtInt(kpiGen.planes), fmtMoney(kpiGen.monto)],
      ['Gestión Wellpads',    fmtInt(kpiWp.total),  fmtPct(kpiWp.pctEntregada),  fmtPct(kpiWp.pctATermino),  fmtInt(kpiWp.equipos),  fmtInt(kpiWp.planes),  fmtMoney(kpiWp.monto)]
    ];
    y = dibujarTabla(doc, 10, y, [40, 22, 22, 24, 24, 24, 28], headerSnap, filasSnap);
    y += 4;

    // ----- 2. Análisis de Inversión y Distribución -----
    y = tituloSeccion(doc, y, 2, 'Análisis de Inversión y Distribución');
    setText(doc, COL.text);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Monto total GR (ROT + AIEC): `, 12, y);
    doc.setFont('helvetica', 'bold'); setText(doc, COL.accent);
    doc.text(fmtMoneyLargo(totalGR), 60, y);
    y += 6;

    // Concentración por UG
    const ugsRel = (grUG.ugs || []).filter(u => ['NQN', 'GSJ', 'ACA'].includes(u));
    const ugsOtros = (grUG.ugs || []).filter(u => !['NQN', 'GSJ', 'ACA'].includes(u));
    const ugsList = [...ugsRel, ...ugsOtros];
    const headerUG = ['Unidad de Gestión', 'Monto GR', '% del Total'];
    const filasUG = ugsList.map(ug => {
      const m = grUG.totalGral[ug] || 0;
      const pct = totalGR > 0 ? (m / totalGR) * 100 : 0;
      return [ug, fmtMoneyLargo(m), fmtPct(pct)];
    });
    if (filasUG.length === 0) filasUG.push(['—', '$0', '0%']);
    y = dibujarTabla(doc, 12, y, [60, 50, 40], headerUG, filasUG);
    y += 3;

    if (imgs.gr) {
      y = nuevaPaginaSiHaceFalta(doc, y, 65, () => { pag++; dibujarMarco(doc, pag); });
      doc.addImage(imgs.gr, 'PNG', 12, y, 90, 55);
      // Texto descriptivo a la derecha
      setText(doc, COL.text);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const ugTop = ugsList.reduce((a, ug) => (grUG.totalGral[ug] || 0) > (grUG.totalGral[a] || 0) ? ug : a, ugsList[0] || '—');
      const pctTop = totalGR > 0 ? ((grUG.totalGral[ugTop] || 0) / totalGR) * 100 : 0;
      const txt = [
        `• UG con mayor concentración: ${ugTop} (${fmtPct(pctTop)} del monto total).`,
        `• Distribución por UG visible en el gráfico adjunto.`,
        `• Tipo de monto en pantalla: ${(window.GTApp && window.GTApp.vista) ? 'según selector activo' : 'TODOS'}.`
      ];
      let ty = y + 6;
      txt.forEach(t => { doc.text(t, 108, ty, { maxWidth: 92 }); ty += 6; });
      y += 60;
    }

    // ----- 3. Top 5 proyectos por Monto GR -----
    y = nuevaPaginaSiHaceFalta(doc, y, 50, () => { pag++; dibujarMarco(doc, pag); });
    y = tituloSeccion(doc, y, 3, 'Top 5 Proyectos por Monto GR');
    if (top5.length === 0) {
      setText(doc, COL.muted); doc.setFont('helvetica', 'italic'); doc.setFontSize(9);
      doc.text('Sin proyectos con Monto GR cargado en la vista actual.', 12, y);
      y += 6;
    } else {
      const headerTop = ['UG', 'Nombre del Proyecto', 'Estado', 'Monto GR'];
      const filasTop = top5.map(p => [
        p.UG || 'S/UG',
        (p.Nombre || '—').slice(0, 60),
        p.Estado || '—',
        fmtMoneyLargo(p.MontoTotal)
      ]);
      y = dibujarTabla(doc, 12, y, [18, 100, 30, 38], headerTop, filasTop);
    }
    y += 4;

    // ----- 4. Estado de la Curva S -----
    y = nuevaPaginaSiHaceFalta(doc, y, 75, () => { pag++; dibujarMarco(doc, pag); });
    y = tituloSeccion(doc, y, 4, 'Estado de la Curva S — Plan vs Real');
    const planAcum = cs.kpis.planAcum || 0;
    const realAcum = cs.kpis.realAcum || 0;
    const delta = cs.kpis.delta || 0;
    const eficiencia = realAcum >= planAcum;
    const tag = eficiencia ? 'EFICIENCIA EN EJECUCIÓN' : 'DESVIACIÓN CRÍTICA DE CRONOGRAMA';
    const tagColor = eficiencia ? COL.accent : COL.danger;

    // Etiqueta de estado
    setFill(doc, tagColor);
    doc.roundedRect(12, y - 4, 80, 7, 1.5, 1.5, 'F');
    setText(doc, [255, 255, 255]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(tag, 52, y + 1, { align: 'center' });
    y += 9;

    setText(doc, COL.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    viñeta(doc, 12, y, `% Plan acumulado (línea gris): ${fmtPct(planAcum)}`); y += 5;
    viñeta(doc, 12, y, `% Real acumulado (línea verde): ${fmtPct(realAcum)}`); y += 5;
    viñeta(doc, 12, y, `Delta Real − Plan: ${(delta >= 0 ? '+' : '') + delta.toFixed(1)} pp en la semana ${cs.semanaActual}`); y += 5;
    viñeta(doc, 12, y, `Alcance 2026 (proyectos con Fecha LE en año): ${fmtInt(cs.alcance)}`); y += 6;

    if (imgs.curvaS) {
      y = nuevaPaginaSiHaceFalta(doc, y, 75, () => { pag++; dibujarMarco(doc, pag); });
      doc.addImage(imgs.curvaS, 'PNG', 12, y, W - 24, 65);
      y += 68;
    }

    // ----- 5. Riesgos y Mitigaciones (condicional) -----
    if (kpis.backlog > 0) {
      y = nuevaPaginaSiHaceFalta(doc, y, 60, () => { pag++; dibujarMarco(doc, pag); });
      y = tituloSeccion(doc, y, 5, '⚠ Riesgos y Mitigaciones');
      setFill(doc, [255, 240, 240]);
      doc.rect(10, y - 4, W - 20, 14, 'F');
      setText(doc, COL.danger); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text(`Backlog detectado: ${fmtInt(kpis.backlog)} proyecto${kpis.backlog === 1 ? '' : 's'} vencido${kpis.backlog === 1 ? '' : 's'}.`, 12, y + 2);
      setText(doc, COL.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text('Acción correctiva inmediata: revisión semanal del backlog en comité de proyectos y replanificación de Fecha LE con el responsable de cada UG.', 12, y + 7, { maxWidth: W - 24 });
      y += 16;

      if (backlogProy.length) {
        const headerBL = ['UG', 'Proyecto', 'Estado', 'Fecha LE', 'Días vencido'];
        const filasBL = backlogProy.map(p => {
          const dias = Math.floor((HOY - p.FechaLE) / (1000 * 60 * 60 * 24));
          return [
            p.UG || 'S/UG',
            (p.Nombre || '—').slice(0, 55),
            p.Estado || '—',
            p.FechaLE.toLocaleDateString('es-AR'),
            String(dias)
          ];
        });
        y = dibujarTabla(doc, 12, y, [18, 92, 28, 26, 22], headerBL, filasBL);
      }
      y += 4;
    }

    // ----- 6. Conclusión Estratégica -----
    const numConclusion = kpis.backlog > 0 ? 6 : 5;
    y = nuevaPaginaSiHaceFalta(doc, y, 30, () => { pag++; dibujarMarco(doc, pag); });
    y = tituloSeccion(doc, y, numConclusion, 'Conclusión Estratégica');
    const conclusion = construirConclusion(kpis, cs, totalGR);
    setFill(doc, COL.bg);
    doc.roundedRect(10, y - 4, W - 20, 18, 2, 2, 'F');
    setText(doc, COL.primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text(conclusion, 14, y + 2, { maxWidth: W - 28 });
    y += 22;

    // ----- Notas al pie -----
    if (notasFalta.length) {
      y = nuevaPaginaSiHaceFalta(doc, y, 16, () => { pag++; dibujarMarco(doc, pag); });
      setText(doc, COL.muted); doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
      const periodo = tituloPeriodo();
      const nota = `Nota: Información visual no disponible en sistema fuente para el periodo ${periodo}; se reportan únicamente valores numéricos de respaldo. Gráficos omitidos: ${notasFalta.join(', ')}.`;
      doc.text(nota, 10, y, { maxWidth: W - 20 });
    }

    // Guardar
    const nombreArchivo = `Reporte_Ejecutivo_GT_${vistaLabel().replace(/\s+/g, '_')}_${tituloPeriodo().replace(/\s+/g, '_')}.pdf`;
    doc.save(nombreArchivo);
    window.GTApp && window.GTApp.toast('✅ PDF generado: ' + nombreArchivo);
  }

  // Conclusión derivada (sin invenciones, solo combina KPIs)
  function construirConclusion(kpis, cs, totalGR) {
    const realAcum = cs.kpis.realAcum || 0;
    const planAcum = cs.kpis.planAcum || 0;
    const eficiencia = realAcum >= planAcum;
    const sinBacklog = kpis.backlog === 0;

    if (eficiencia && sinBacklog) {
      return `Portafolio en ejecución eficiente: avance real ${fmtPct(realAcum)} sobre plan ${fmtPct(planAcum)}, ${fmtInt(kpis.cumplidos)} proyectos cumplidos (${fmtPct(kpis.pctEntregada)}) y backlog en cero. Inversión gestionada: ${fmtMoneyLargo(totalGR)}.`;
    }
    if (eficiencia && !sinBacklog) {
      return `Avance acelerado (${fmtPct(realAcum)} real vs ${fmtPct(planAcum)} plan), pero ${fmtInt(kpis.backlog)} proyecto${kpis.backlog === 1 ? '' : 's'} en backlog requieren replanificación inmediata. Monto GR bajo gestión: ${fmtMoneyLargo(totalGR)}.`;
    }
    if (!eficiencia && sinBacklog) {
      return `Cronograma con desviación crítica (real ${fmtPct(realAcum)} vs plan ${fmtPct(planAcum)}). Sin backlog vencido, pero exige plan de recuperación para mantener compromiso anual. Inversión gestionada: ${fmtMoneyLargo(totalGR)}.`;
    }
    return `Salud del portafolio comprometida: desviación real ${fmtPct(realAcum)} vs plan ${fmtPct(planAcum)} y ${fmtInt(kpis.backlog)} proyecto${kpis.backlog === 1 ? '' : 's'} en backlog. Acción correctiva prioritaria sobre cronograma y recuperación de vencidos.`;
  }

  // ===== Tabla simple =====
  function dibujarTabla(doc, x, y, anchos, header, filas) {
    const filaH = 7;
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Header
    setFill(doc, COL.primary);
    doc.rect(x, y, anchos.reduce((a, b) => a + b, 0), filaH, 'F');
    setText(doc, [255, 255, 255]);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    let cx = x;
    header.forEach((h, i) => {
      doc.text(String(h), cx + 2, y + 5, { maxWidth: anchos[i] - 3 });
      cx += anchos[i];
    });
    y += filaH;

    // Filas
    setText(doc, COL.text);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    filas.forEach((fila, idx) => {
      // Salto de página si hace falta
      if (y + filaH > H - 14) {
        doc.addPage();
        // Re-cabecera mínima en nueva página: nada extra (el marco se dibuja desde fuera)
        y = 22;
        setFill(doc, COL.primary);
        doc.rect(x, y, anchos.reduce((a, b) => a + b, 0), filaH, 'F');
        setText(doc, [255, 255, 255]);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        let cx2 = x;
        header.forEach((h, i) => {
          doc.text(String(h), cx2 + 2, y + 5, { maxWidth: anchos[i] - 3 });
          cx2 += anchos[i];
        });
        y += filaH;
        setText(doc, COL.text); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      }
      if (idx % 2 === 1) {
        setFill(doc, COL.bg);
        doc.rect(x, y, anchos.reduce((a, b) => a + b, 0), filaH, 'F');
      }
      let cx2 = x;
      fila.forEach((c, i) => {
        doc.text(String(c), cx2 + 2, y + 5, { maxWidth: anchos[i] - 3 });
        cx2 += anchos[i];
      });
      y += filaH;
    });

    // Borde inferior
    setDraw(doc, COL.line); doc.setLineWidth(0.2);
    doc.line(x, y, x + anchos.reduce((a, b) => a + b, 0), y);
    return y;
  }

  function nuevaPaginaSiHaceFalta(doc, y, alturaNecesaria, onNueva) {
    const H = doc.internal.pageSize.getHeight();
    if (y + alturaNecesaria > H - 14) {
      doc.addPage();
      onNueva && onNueva();
      return 22;
    }
    return y;
  }

  window.GTPdfReport = { generar };
})();

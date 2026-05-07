/* ============================================================
   transforms.js — Cálculos de KPIs, agregaciones y curva S
   Expone: window.GTTransforms
   ============================================================ */
(function () {
  'use strict';

  // Fecha de referencia: 2 de mayo de 2026 (per spec del prompt)
  const HOY = new Date(2026, 4, 2);

  function getEff(p, campo) {
    return window.GTOverrides ? window.GTOverrides.getEffectiveValue(p, campo) : p[campo];
  }

  function getEffStr(p, campo) {
    const v = getEff(p, campo);
    return v == null ? '' : String(v);
  }

  // ===== Helpers de fecha =====
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { year: d.getUTCFullYear(), week: weekNo };
  }
  function isoLabel(d) {
    const w = isoWeek(d);
    return `${w.year}-W${String(w.week).padStart(2, '0')}`;
  }

  // ===== KPIs principales =====
  function calcularKPIs(proyectos) {
    const total = proyectos.length;
    let cumplidos = 0, pendientes = 0, backlog = 0, aTermino = 0;

    proyectos.forEach(p => {
      const estado = p.Estado;
      const le = p.FechaLE;
      const cumplidaEnTiempo = estado === 'Cumplida' && p.FechaFin && le && p.FechaFin <= le;

      if (estado === 'Cumplida') {
        cumplidos++;
        if (cumplidaEnTiempo) aTermino++;
      }
      if ((estado === 'Sin Avance' || estado === 'En Proceso') && le && le >= HOY) {
        pendientes++;
      }
      // Backlog = FechaLE vencida AND estado != 'Cumplida' (regla estricta)
      if (le && le < HOY && estado !== 'Cumplida') {
        backlog++;
      }
    });

    // Sumas SAP/GR (con overrides) — esquema nuevo: Equipos + PlanesTotal + monto total GR
    let equipos = 0, planes = 0, monto = 0;
    const conteoZ = { ZI: 0, ZA: 0, Z6: 0, Z3: 0, Z1: 0 };
    proyectos.forEach(p => {
      equipos += +getEff(p, 'Equipos') || 0;
      const pCT = +getEff(p, 'PlanesConTareas') || 0;
      const pST = +getEff(p, 'PlanesSinTareas') || 0;
      planes  += pCT + pST;
      monto   += (p.MontoTotal || 0);
      // Un proyecto cuenta para cada Z donde MontoROT[z]+MontoAIEC[z] > 0
      for (const z of ['ZI', 'ZA', 'Z6', 'Z3', 'Z1']) {
        const v = (p.MontoROT && p.MontoROT[z] || 0) + (p.MontoAIEC && p.MontoAIEC[z] || 0);
        if (v > 0) conteoZ[z]++;
      }
    });

    return {
      total, cumplidos, pendientes, backlog, aTermino,
      pctEntregada: total > 0 ? (cumplidos / total) * 100 : 0,
      pctATermino:  cumplidos > 0 ? (aTermino / cumplidos) * 100 : 0,
      equipos, planes, monto, conteoZ
    };
  }

  // ===== Agrupación por UG con criticidad =====
  function porUGCriticidad(proyectos) {
    const ugs = {};
    proyectos.forEach(p => {
      const ug = p.UG || 'S/UG';
      if (!ugs[ug]) ugs[ug] = { total: 0, criticos: 0, noCriticos: 0 };
      ugs[ug].total++;
      if (p.Criticidad === 'Crítico') ugs[ug].criticos++;
      else ugs[ug].noCriticos++;
    });
    return ugs;
  }

  // ===== G3: Donut UG =====
  function porUG(proyectos) {
    const m = {};
    proyectos.forEach(p => {
      const ug = p.UG || 'S/UG';
      m[ug] = (m[ug] || 0) + 1;
    });
    return m;
  }

  // ===== G2: Barras por responsable apiladas por estado =====
  function porResponsable(proyectos) {
    const m = {};
    proyectos.forEach(p => {
      const asignados = p.AsignadoArr && p.AsignadoArr.length ? p.AsignadoArr : ['Sin asignar'];
      asignados.forEach(nombre => {
        if (!m[nombre]) m[nombre] = { Cumplida: 0, 'En Proceso': 0, 'Sin Avance': 0 };
        if (m[nombre][p.Estado] !== undefined) m[nombre][p.Estado]++;
      });
    });
    // Ordenar por total desc
    const arr = Object.entries(m)
      .map(([k, v]) => ({ nombre: k, ...v, total: v.Cumplida + v['En Proceso'] + v['Sin Avance'] }))
      .sort((a, b) => b.total - a.total);
    return arr;
  }

  // ===== Alta de Equipos SAP por UG =====
  function equiposPorUG(proyectos) {
    const m = {};
    proyectos.forEach(p => {
      const ug = p.UG || 'S/UG';
      m[ug] = (m[ug] || 0) + (+getEff(p, 'Equipos') || 0);
    });
    return m;
  }

  // ===== Alta Planes Mtto SAP por UG (con tareas + sin tareas) =====
  function planesPorUG(proyectos) {
    const m = {};
    proyectos.forEach(p => {
      const ug = p.UG || 'S/UG';
      const v = (+getEff(p, 'PlanesConTareas') || 0) + (+getEff(p, 'PlanesSinTareas') || 0);
      m[ug] = (m[ug] || 0) + v;
    });
    return m;
  }

  // ===== Alta Planes Mtto SAP por UG — desglosado en 2 series =====
  // Devuelve estructura compatible con planesUGAgrupado (charts.js)
  // Serie 1 (Total Planes): suma total de planes Mtto por UG
  // Serie 2 (Con/Sin Tareas): misma suma representada como contraste visual
  function planesDesglosadosPorUG(proyectos) {
    const orden = ['NQN', 'GSJ', 'ACA'];
    const acum = {};
    proyectos.forEach(p => {
      const ug = p.UG || 'S/UG';
      const cT = +getEff(p, 'PlanesConTareas') || 0;
      const sT = +getEff(p, 'PlanesSinTareas') || 0;
      if (!acum[ug]) acum[ug] = { total: 0, conTareas: 0, sinTareas: 0 };
      acum[ug].conTareas += cT;
      acum[ug].sinTareas += sT;
      acum[ug].total     += cT + sT;
    });
    const setUG = new Set(Object.keys(acum));
    const ugs = [
      ...orden.filter(u => setUG.has(u)),
      ...[...setUG].filter(u => !orden.includes(u)).sort()
    ];
    return {
      ugs,
      total:        Object.fromEntries(ugs.map(u => [u, acum[u].total])),
      conTareas:    Object.fromEntries(ugs.map(u => [u, acum[u].conTareas])),
      sinTareas:    Object.fromEntries(ugs.map(u => [u, acum[u].sinTareas])),
      conSinTareas: Object.fromEntries(ugs.map(u => [u, acum[u].conTareas + acum[u].sinTareas]))
    };
  }

  // ===== Monto GR desglosado por UG con toggle ROT/AIEC y filtro Z =====
  // Retorna {
  //   ugs:        ['NQN','GSJ','ACA',...],
  //   desglose:   { ug: { ZI:n, ZA:n, Z6:n, Z3:n, Z1:n } }   // según tipo
  //   totalGral:  { ug: monto }                              // suma de las 10 cols (independiente del filtro)
  //   zList:      ['ZI','ZA','Z6','Z3','Z1'] o [zFilter]
  // }
  function montoGRDesglosadoPorUG(proyectos, tipo, zFilter) {
    tipo = (tipo === 'AIEC') ? 'AIEC' : 'ROT';
    const Z_ALL = ['ZI', 'ZA', 'Z6', 'Z3', 'Z1'];
    const zList = (zFilter && Z_ALL.includes(zFilter)) ? [zFilter] : Z_ALL;

    const desglose = {};
    const totalGral = {};
    const setUG = new Set();

    proyectos.forEach(p => {
      const ug = p.UG || 'S/UG';
      setUG.add(ug);
      const fuente = (tipo === 'AIEC') ? p.MontoAIEC : p.MontoROT;
      if (!desglose[ug]) {
        desglose[ug] = { ZI: 0, ZA: 0, Z6: 0, Z3: 0, Z1: 0 };
      }
      Z_ALL.forEach(z => {
        desglose[ug][z] += (fuente && fuente[z]) || 0;
      });
      totalGral[ug] = (totalGral[ug] || 0) + (p.MontoTotal || 0);
    });

    // Filtra UGs sin actividad (ningún monto en ningún sitio)
    const ugs = Array.from(setUG).filter(ug =>
      (totalGral[ug] || 0) > 0 || zList.some(z => (desglose[ug][z] || 0) > 0)
    );

    return { ugs, desglose, totalGral, zList };
  }

  // ===== Monto total por Z para una UG dada (lateral sidebar) =====
  // tipo: 'ROT' | 'AIEC' | 'TODOS'
  function montoTotalPorZ(proyectos, ug, tipo) {
    const out = { ZI: 0, ZA: 0, Z6: 0, Z3: 0, Z1: 0 };
    if (!ug) return out;
    proyectos.forEach(p => {
      if (ug !== 'TODOS' && (p.UG || 'S/UG') !== ug) return;
      for (const z of ['ZI', 'ZA', 'Z6', 'Z3', 'Z1']) {
        const rot  = (p.MontoROT  && p.MontoROT[z])  || 0;
        const aiec = (p.MontoAIEC && p.MontoAIEC[z]) || 0;
        out[z] += tipo === 'AIEC' ? aiec : tipo === 'ROT' ? rot : (rot + aiec);
      }
    });
    return out;
  }

  // ===== Conteo de proyectos por cada Z (ROT+AIEC) =====
  function conteoProyectosPorZ(proyectos) {
    const out = { ZI: 0, ZA: 0, Z6: 0, Z3: 0, Z1: 0 };
    proyectos.forEach(p => {
      for (const z of ['ZI', 'ZA', 'Z6', 'Z3', 'Z1']) {
        const v = (p.MontoROT && p.MontoROT[z] || 0) + (p.MontoAIEC && p.MontoAIEC[z] || 0);
        if (v > 0) out[z]++;
      }
    });
    return out;
  }

  // ===== Criticidad global con desglose por UG (para tooltip de la dona) =====
  function criticidadGlobal(proyectos) {
    const out = {
      Critico:   { total: 0, porUG: {} },
      NoCritico: { total: 0, porUG: {} }
    };
    proyectos.forEach(p => {
      const ug = p.UG || 'S/UG';
      // 'Crítico' / 'No Crítico' (con tilde y mayúsc.) según el Excel real
      const esCrit = (p.Criticidad || '').trim().toLowerCase() === 'crítico';
      const cat = esCrit ? 'Critico' : 'NoCritico';
      out[cat].total++;
      out[cat].porUG[ug] = (out[cat].porUG[ug] || 0) + 1;
    });
    return out;
  }

  // ===== Modal: matching proyecto ↔ tareas =====
  // Algoritmo: extrae el primer segmento de Folder ('/Nombre/') con regex y lo
  // compara case-insensitive trim contra el Nombre del proyecto.
  const REGEX_FOLDER = /\/([^\/]+)\//;
  function extraerNombreFolder(folder) {
    const m = (folder || '').match(REGEX_FOLDER);
    return m ? m[1].trim() : '';
  }
  function tareasDeProyecto(tasks, nombreProyecto) {
    const target = (nombreProyecto || '').trim().toLowerCase();
    if (!target || !Array.isArray(tasks)) return [];
    return tasks.filter(t => {
      const seg = extraerNombreFolder(t.Folder).toLowerCase();
      return seg && seg === target;
    });
  }

  // ===== Modal: filtrar SOLO tareas principales (Title `^\d+\.\s`) =====
  const REGEX_PRINCIPAL = /^(\d+)\.\s/;
  function filtrarTareasPrincipales(tareas) {
    return (tareas || [])
      .filter(t =>
        !(t.ParentTask || '').trim() && REGEX_PRINCIPAL.test(t.Title || '')
      )
      .sort((a, b) => {
        const na = parseInt((a.Title.match(REGEX_PRINCIPAL) || [])[1] || '0', 10);
        const nb = parseInt((b.Title.match(REGEX_PRINCIPAL) || [])[1] || '0', 10);
        return na - nb;
      });
  }

  // ===== Modal: parser de 'Avance de tarea' (col AA) =====
  // Acepta números o strings con números. Vacío/no-numérico → null.
  function parseAvanceTarea(v) {
    if (v === '' || v == null) return null;
    const n = Number(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  // ===== G1: Curva S Plan vs Real (% del alcance 2026) =====
  // - Eje X continuo: TODAS las semanas ISO de 2026 (S1..S53)
  // - Plan: curva sigmoide teórica suave 0% → 100%
  // - Real: % acumulado de finalizaciones del alcance 2026, cortado en HOY
  // - Alcance 2026 = nº de proyectos con FechaLE en 2026 (denominador único)
  function curvaS(proyectos) {
    const ANIO = 2026;

    // Alcance: proyectos cuya FechaLE cae en 2026
    const proyectos2026 = proyectos.filter(p => p.FechaLE && p.FechaLE.getFullYear() === ANIO);
    const alcance = proyectos2026.length;

    // Generar TODAS las semanas ISO del año 2026 (típicamente 53)
    const semanas = generarSemanasAnio(ANIO);
    const N = semanas.length;
    const semanaActual = isoLabel(HOY);

    // ---- Curva Plan: sigmoide logística normalizada 0..100 ----
    const k = 10;          // pendiente de la sigmoide
    const t0 = 0.5;        // punto de inflexión (mitad del año)
    const sig = (t) => 1 / (1 + Math.exp(-k * (t - t0)));
    const s0 = sig(0), s1 = sig(1);
    const plan = semanas.map((s, i) => {
      const t = N === 1 ? 1 : i / (N - 1);
      const pct = ((sig(t) - s0) / (s1 - s0)) * 100;
      return { x: s, y: Math.max(0, Math.min(100, pct)) };
    });

    // ---- Curva Real: % acumulado de finalizaciones del alcance ----
    // Sólo cuentan proyectos del alcance (FechaLE en 2026) cuya FechaFin también ∈ 2026
    const realMap = {};
    proyectos2026.forEach(p => {
      if (p.FechaFin && p.FechaFin.getFullYear() === ANIO) {
        const k = isoLabel(p.FechaFin);
        realMap[k] = (realMap[k] || 0) + 1;
      }
    });

    const real = [];
    const realCantAcum = [];   // conteo acumulado real por semana (nº proyectos cumplidos)
    let accR = 0;
    let ultimaSemanaReal = null;
    semanas.forEach(s => {
      accR += realMap[s] || 0;
      realCantAcum.push(accR);
      if (s <= semanaActual) {
        const pct = alcance > 0 ? (accR / alcance) * 100 : 0;
        real.push({ x: s, y: Math.max(0, Math.min(100, pct)) });
        if (realMap[s]) ultimaSemanaReal = s;
      } else {
        real.push({ x: s, y: null });
      }
    });

    // Plan: cantidad de proyectos planificados acumulada por semana
    // (basado en distribución real de FechaLE en 2026, no la sigmoide)
    const planMap = {};
    proyectos2026.forEach(p => {
      const k = isoLabel(p.FechaLE);
      planMap[k] = (planMap[k] || 0) + 1;
    });
    const planCantAcum = [];
    let accP = 0;
    semanas.forEach(s => {
      accP += planMap[s] || 0;
      planCantAcum.push(accP);
    });

    // KPIs al corte de la semana actual (en %)
    const planAhoraObj = plan.find(p => p.x === semanaActual);
    const planAhora = planAhoraObj ? planAhoraObj.y : 0;
    const realAhora = (() => {
      let v = 0;
      for (const r of real) {
        if (r.x > semanaActual) break;
        if (r.y != null) v = r.y;
      }
      return v;
    })();
    const variacionPct = planAhora > 0 ? ((realAhora - planAhora) / planAhora) * 100 : 0;
    const delta = realAhora - planAhora;

    return {
      semanas, plan, real, planCantAcum, realCantAcum,
      semanaActual, alcance,
      kpis: {
        planAcum: planAhora,
        realAcum: realAhora,
        variacionPct,
        delta,
        ultimaSemanaReal: ultimaSemanaReal || semanaActual
      }
    };
  }

  // Devuelve la lista de etiquetas ISO ('YYYY-Www') de todas las semanas del año.
  // Se itera por lunes ISO desde el lunes de la semana 1 hasta cubrir el año.
  function generarSemanasAnio(anio) {
    // Lunes de la semana ISO 1: el lunes de la semana que contiene al 4-Ene
    const ene4 = new Date(anio, 0, 4);
    const dow = ene4.getDay() || 7;
    const lunesW1 = new Date(anio, 0, 4 - (dow - 1));

    const semanas = [];
    const cur = new Date(lunesW1);
    while (true) {
      const lbl = isoLabel(cur);
      // Cortar cuando la semana ya pertenezca al año siguiente
      if (parseInt(lbl.slice(0, 4), 10) > anio) break;
      semanas.push(lbl);
      cur.setDate(cur.getDate() + 7);
      // Salvaguarda: máximo 53 semanas
      if (semanas.length >= 53) break;
    }
    return semanas;
  }

  // ===== G5: Lista de bloqueos =====
  function bloqueos(proyectos, tasks) {
    const out = [];
    proyectos.forEach(p => {
      let lim = (p.Limitacion || '').toString().trim();

      // Fallback: buscar limitación en tareas del mismo proyecto (Folder ~ Nombre)
      if (!lim && tasks && tasks.length) {
        const t = tasksDe(tasks, p.Nombre).find(t => t.Limitacion && t.Limitacion.trim());
        if (t) lim = t.Limitacion;
      }

      if (lim) {
        const vencido = p.FechaLE && p.FechaLE < HOY && p.Estado !== 'Cumplida';
        out.push({
          nombre: p.Nombre, ug: p.UG, genpro: p.GenPro,
          limitacion: lim, vencido, estado: p.Estado
        });
      }
    });
    return out;
  }
  // Helper interno (alias) para no exponer dos veces lo mismo
  function tasksDe(tasks, nombre) { return tareasDeProyecto(tasks, nombre); }

  // ===== Filtrado por estado/quick chips =====
  function aplicaQuickChip(proyectos, chip) {
    if (!chip) return proyectos;
    if (chip === 'cumplidos')  return proyectos.filter(p => p.Estado === 'Cumplida');
    if (chip === 'backlog')    return proyectos.filter(p =>
      p.FechaLE && p.FechaLE < HOY && p.Estado !== 'Cumplida'
    );
    if (chip === 'pendientes') return proyectos.filter(p =>
      (p.Estado === 'Sin Avance' || p.Estado === 'En Proceso') && p.FechaLE && p.FechaLE >= HOY
    );
    return proyectos;
  }

  window.GTTransforms = {
    HOY, isoWeek, isoLabel, getEff, getEffStr,
    calcularKPIs, porUGCriticidad, porUG, porResponsable,
    equiposPorUG, planesPorUG, planesDesglosadosPorUG,
    montoGRDesglosadoPorUG, montoTotalPorZ, conteoProyectosPorZ, criticidadGlobal,
    extraerNombreFolder, tareasDeProyecto, filtrarTareasPrincipales, parseAvanceTarea,
    curvaS, bloqueos, aplicaQuickChip
  };
})();

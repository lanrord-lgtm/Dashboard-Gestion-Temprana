/* ============================================================
   overrides.js — Edición inline persistente por GenPro
   Expone: window.GTOverrides
   ============================================================ */
(function () {
  'use strict';

  const KEY = 'gtd_overrides';

  // Mapeo: nombre interno del proyecto -> columna del Excel (formato nuevo)
  const FIELD_MAP = {
    Equipos:         'Cant Alta de Equipos SAP',
    PlanesConTareas: 'Alta de Planes mtto con tareas SAP',
    PlanesSinTareas: 'Alta de Planes mtto sin tareas SAP',
  };

  const VALIDATORS = {
    Equipos:         v => Number.isInteger(+v) && +v >= 0 && +v <= 999999,
    PlanesConTareas: v => Number.isInteger(+v) && +v >= 0 && +v <= 999999,
    PlanesSinTareas: v => Number.isInteger(+v) && +v >= 0 && +v <= 999999,
  };

  // Estructura: { GenPro: { campoExcel: valor } }
  let overrides = {};

  function cargar() {
    try {
      const raw = localStorage.getItem(KEY);
      overrides = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('overrides cargar', e);
      overrides = {};
    }
    return overrides;
  }

  function persistir() {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  }

  // Devuelve el valor efectivo (override si existe, sino el original)
  function getEffectiveValue(proyecto, campoInterno) {
    const genpro = proyecto?.GenPro;
    const colExcel = FIELD_MAP[campoInterno];
    if (genpro && overrides[genpro] && overrides[genpro][colExcel] !== undefined) {
      return overrides[genpro][colExcel];
    }
    return proyecto?.[campoInterno] ?? null;
  }

  function isOverridden(proyecto, campoInterno) {
    const genpro = proyecto?.GenPro;
    const colExcel = FIELD_MAP[campoInterno];
    return Boolean(genpro && overrides[genpro] && overrides[genpro][colExcel] !== undefined);
  }

  function setOverride(genpro, campoInterno, valor) {
    if (!genpro) return false;
    const validator = VALIDATORS[campoInterno];
    if (validator && !validator(valor)) return false;

    const valFinal = +valor;

    if (!overrides[genpro]) overrides[genpro] = {};
    overrides[genpro][FIELD_MAP[campoInterno]] = valFinal;
    persistir();
    return true;
  }

  function resetOverride(genpro, campoInterno) {
    const colExcel = FIELD_MAP[campoInterno];
    if (overrides[genpro] && overrides[genpro][colExcel] !== undefined) {
      delete overrides[genpro][colExcel];
      if (Object.keys(overrides[genpro]).length === 0) delete overrides[genpro];
      persistir();
      return true;
    }
    return false;
  }

  function exportar() {
    const payload = {
      exportado: new Date().toISOString(),
      overrides: overrides
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gtd_overrides_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function importar(file) {
    const txt = await file.text();
    const data = JSON.parse(txt);
    const incoming = data.overrides || data; // tolerante
    if (typeof incoming !== 'object') throw new Error('JSON inválido');
    // merge
    Object.keys(incoming).forEach(genpro => {
      if (!overrides[genpro]) overrides[genpro] = {};
      Object.assign(overrides[genpro], incoming[genpro]);
    });
    persistir();
    return Object.keys(incoming).length;
  }

  function todos() { return overrides; }

  window.GTOverrides = {
    cargar, getEffectiveValue, isOverridden,
    setOverride, resetOverride,
    exportar, importar, todos,
    FIELD_MAP, VALIDATORS,
  };

})();

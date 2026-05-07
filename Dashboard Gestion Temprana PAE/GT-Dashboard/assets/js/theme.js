/* ============================================================
   theme.js — Switch de tema (light, medium, dark) persistente
   Expone: window.GTTheme
   ============================================================ */
(function () {
  'use strict';
  const KEY = 'gtd_theme';
  const TEMAS = ['light', 'medium', 'dark'];

  function aplicar(t) {
    if (!TEMAS.includes(t)) t = 'light';
    document.body.dataset.theme = t;
    localStorage.setItem(KEY, t);
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.theme === t);
    });
    // Re-render charts para que tomen colores nuevos
    if (window.GTApp && window.GTApp.refrescarTodo) {
      // pequeño delay para que el DOM aplique las CSS variables
      setTimeout(() => window.GTApp.refrescarTodo(false), 30);
    }
  }

  function init() {
    const guardado = localStorage.getItem(KEY) || 'light';
    aplicar(guardado);
    document.querySelectorAll('.theme-btn').forEach(b => {
      b.addEventListener('click', () => aplicar(b.dataset.theme));
    });
  }

  window.GTTheme = { init, aplicar, get current() { return document.body.dataset.theme; } };
})();

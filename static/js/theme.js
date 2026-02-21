/**
 * theme.js — Loads saved theme from localStorage
 * Applies it as a background image on dashboard and timer pages
 */

const THEME_IMAGES = {
  'theme-lofi':    '/static/images/theme-lofi.jpg',
  'theme-porsche': '/static/images/theme-porsche.jpg',
  'theme-f1':      '/static/images/theme-f1.jpg',
  'theme-nyc':     '/static/images/theme-nyc.jpg',
  'theme-liquid':  '/static/images/theme-liquid.jpg',
  'theme-dunes':   '/static/images/dunes.jpg',
};

const DEFAULT_THEME = 'theme-lofi';

function getSavedTheme() {
  return localStorage.getItem('fb-theme') || DEFAULT_THEME;
}

function applyThemeToElement(el, theme) {
  if (!el) return;
  const img = THEME_IMAGES[theme] || THEME_IMAGES[DEFAULT_THEME];
  el.style.backgroundImage = `url('${img}')`;
}

// Apply to dashboard background
const dashBg = document.getElementById('dash-bg');
if (dashBg) applyThemeToElement(dashBg, getSavedTheme());

// Apply to timer background
const timerBg = document.getElementById('timer-bg');
if (timerBg) applyThemeToElement(timerBg, getSavedTheme());

// Mark active thumb on dashboard
const thumbs = document.querySelectorAll('.thumb');
if (thumbs.length) {
  const saved = getSavedTheme();
  thumbs.forEach(t => {
    t.classList.toggle('active', t.dataset.theme === saved);
  });
}

/**
 * dashboard.js — Duration picker + theme preview
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Duration Pills ──────────────────────────────────────────────
  const pills   = document.querySelectorAll('.dur-pill');
  const startBtn = document.getElementById('start-btn');
  let selectedMin = 25;

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedMin = parseInt(pill.dataset.min);
      startBtn.href = `/timer?duration=${selectedMin}`;
    });
  });

  // ── Theme Thumbnails (preview only, save on settings page) ──────
  const thumbs = document.querySelectorAll('.thumb');
  const dashBg = document.getElementById('dash-bg');
  const THEME_IMAGES = {
    'theme-lofi':    '/static/images/theme-lofi.jpg',
    'theme-porsche': '/static/images/theme-porsche.jpg',
    'theme-f1':      '/static/images/theme-f1.jpg',
    'theme-nyc':     '/static/images/theme-nyc.jpg',
    'theme-liquid':  '/static/images/theme-liquid.jpg',
    'theme-dunes':   '/static/images/dunes.jpg',
  };

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');

      const theme = thumb.dataset.theme;
      localStorage.setItem('fb-theme', theme);

      // Live-preview on dashboard
      if (dashBg) {
        dashBg.style.backgroundImage = `url('${THEME_IMAGES[theme]}')`;
      }

      // Save to server
      fetch('/api/theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme })
      });
    });
  });

});

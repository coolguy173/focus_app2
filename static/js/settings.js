/**
 * settings.js — Theme picker page logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const cards    = document.querySelectorAll('.theme-card');
  const saveBtn  = document.getElementById('save-theme-btn');
  const saveMsg  = document.getElementById('save-msg');
  const settingsBg = document.getElementById('settings-bg');

  const THEME_IMAGES = {
    'theme-lofi':    '/static/images/theme-lofi.jpg',
    'theme-porsche': '/static/images/theme-porsche.jpg',
    'theme-f1':      '/static/images/theme-f1.jpg',
    'theme-nyc':     '/static/images/theme-nyc.jpg',
    'theme-liquid':  '/static/images/theme-liquid.jpg',
    'theme-dunes':   '/static/images/dunes.jpg',
  };

  // Load saved theme and mark active card
  const saved = localStorage.getItem('fb-theme') || 'theme-lofi';
  let selected = saved;

  cards.forEach(card => {
    card.classList.toggle('active', card.dataset.theme === saved);
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selected = card.dataset.theme;
    });
  });

  saveBtn.addEventListener('click', async () => {
    localStorage.setItem('fb-theme', selected);

    // Save to server
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: selected })
    });

    saveMsg.classList.remove('hidden');
    setTimeout(() => saveMsg.classList.add('hidden'), 2000);
  });
});

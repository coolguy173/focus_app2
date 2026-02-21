/**
 * timer.js — Focus Battle Timer v2
 * Features: SVG ring progress, ambient rain sound (Web Audio API),
 * win/loss API, break timer, beforeunload detection
 */

// ── Constants ───────────────────────────────────────────────────────
const TOTAL_SECONDS  = DURATION_MINUTES * 60;
const RING_RADIUS    = 130;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ~817
const DANGER_SECS    = 60;
const BREAK_SECONDS  = 5 * 60;

// ── State ────────────────────────────────────────────────────────────
let secondsLeft   = TOTAL_SECONDS;
let intervalId    = null;
let timerState    = 'idle';   // idle | running | break | done
let sessionLocked = false;
let soundOn       = false;
let audioCtx      = null;
let rainNode      = null;
let gainNode      = null;

// ── DOM ──────────────────────────────────────────────────────────────
const digits      = document.getElementById('timer-digits');
const stateEl     = document.getElementById('timer-state');
const ringEl      = document.getElementById('ring-progress');
const btnStart    = document.getElementById('ctrl-start');
const btnAbandon  = document.getElementById('ctrl-abandon');
const backLink    = document.getElementById('back-link');
const soundToggle = document.getElementById('sound-toggle');
const soundIcon   = document.getElementById('sound-icon');
const soundLabel  = document.getElementById('sound-label');
const overlay     = document.getElementById('result-overlay');
const resultBox   = document.getElementById('result-box');
const breakOffer  = document.getElementById('break-offer');
const retryOffer  = document.getElementById('retry-offer');

// ── Utility ──────────────────────────────────────────────────────────
function fmt(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

function setRing(secs, total) {
  const pct    = secs / total;
  const offset = RING_CIRCUMFERENCE * (1 - pct);
  ringEl.style.strokeDasharray  = RING_CIRCUMFERENCE;
  ringEl.style.strokeDashoffset = offset;
}

// ── Ambient Rain (Web Audio API — no file needed) ───────────────────
function createRain() {
  audioCtx  = new (window.AudioContext || window.webkitAudioContext)();
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer  = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data    = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  rainNode  = audioCtx.createBufferSource();
  rainNode.buffer = buffer;
  rainNode.loop   = true;

  // Low-pass filter to make it sound like rain (not static)
  const filter = audioCtx.createBiquadFilter();
  filter.type      = 'lowpass';
  filter.frequency.value = 800;

  gainNode  = audioCtx.createGain();
  gainNode.gain.value = 0.15;

  rainNode.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  rainNode.start();
}

function startRain() {
  try {
    if (!audioCtx) createRain();
    else if (audioCtx.state === 'suspended') audioCtx.resume();
    gainNode.gain.setTargetAtTime(0.15, audioCtx.currentTime, 0.5);
    soundOn = true;
    soundToggle.classList.add('active');
    soundIcon.textContent = '♪';
    soundLabel.textContent = 'RAIN ON';
  } catch(e) { console.warn('Audio not supported', e); }
}

function stopRain() {
  if (gainNode && audioCtx) {
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.3);
    setTimeout(() => { if (audioCtx) audioCtx.suspend(); }, 500);
  }
  soundOn = false;
  soundToggle.classList.remove('active');
  soundIcon.textContent = '♪';
  soundLabel.textContent = 'RAIN';
}

soundToggle.addEventListener('click', () => {
  soundOn ? stopRain() : startRain();
});

// ── API Calls ─────────────────────────────────────────────────────────
async function reportWin() {
  try {
    const r = await fetch('/api/session/win', { method: 'POST' });
    return await r.json();
  } catch(e) { return null; }
}

async function reportLoss(keepalive = false) {
  try {
    const r = await fetch('/api/session/loss', { method: 'POST', keepalive });
    return await r.json();
  } catch(e) { return null; }
}

// ── Result UI ─────────────────────────────────────────────────────────
function showWin(stats) {
  document.getElementById('result-glyph').textContent   = '◆';
  document.getElementById('result-heading').textContent  = 'Victory.';
  document.getElementById('result-sub').textContent      = 'You stayed locked in. Respect.';
  resultBox.classList.remove('loss');
  if (stats) {
    document.getElementById('r-wins').textContent   = stats.wins;
    document.getElementById('r-streak').textContent = stats.streak;
    document.getElementById('r-losses').textContent = stats.losses;
  }
  breakOffer.classList.remove('hidden');
  retryOffer.classList.add('hidden');
  overlay.classList.remove('hidden');
}

function showLoss(stats) {
  document.getElementById('result-glyph').textContent   = '✕';
  document.getElementById('result-heading').textContent  = 'Defeated.';
  document.getElementById('result-sub').textContent      = 'You left early. Streak reset.';
  resultBox.classList.add('loss');
  if (stats) {
    document.getElementById('r-wins').textContent   = stats.wins;
    document.getElementById('r-streak').textContent = stats.streak;
    document.getElementById('r-losses').textContent = stats.losses;
  }
  breakOffer.classList.add('hidden');
  retryOffer.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

// ── Timer Core ────────────────────────────────────────────────────────
function tick() {
  secondsLeft--;
  digits.textContent = fmt(secondsLeft);
  setRing(secondsLeft, TOTAL_SECONDS);

  if (secondsLeft <= DANGER_SECS) {
    digits.classList.add('danger');
    digits.classList.remove('running');
    stateEl.textContent = '⚠ HOLD THE LINE';
    stateEl.className   = 'timer-state danger';
    ringEl.classList.add('danger');
  }

  if (secondsLeft <= 0) {
    clearInterval(intervalId);
    sessionLocked = true;
    timerState    = 'done';
    window.removeEventListener('beforeunload', onUnload);
    stopRain();
    reportWin().then(showWin);
  }
}

function startTimer(secs) {
  secondsLeft   = secs || TOTAL_SECONDS;
  sessionLocked = false;
  timerState    = 'running';

  digits.textContent = fmt(secondsLeft);
  digits.className   = 'timer-digits running';
  stateEl.textContent = 'IN BATTLE';
  stateEl.className   = 'timer-state running';
  ringEl.classList.remove('danger');
  setRing(secondsLeft, secs || TOTAL_SECONDS);

  btnStart.classList.add('hidden');
  btnAbandon.classList.remove('hidden');

  intervalId = setInterval(tick, 1000);
  window.addEventListener('beforeunload', onUnload);
}

function resetTimer() {
  clearInterval(intervalId);
  secondsLeft   = TOTAL_SECONDS;
  timerState    = 'idle';
  sessionLocked = false;

  digits.textContent  = fmt(TOTAL_SECONDS);
  digits.className    = 'timer-digits';
  stateEl.textContent = 'READY';
  stateEl.className   = 'timer-state';
  ringEl.style.strokeDashoffset = 0;
  ringEl.classList.remove('danger');

  btnStart.classList.remove('hidden');
  btnAbandon.classList.add('hidden');
  overlay.classList.add('hidden');

  window.removeEventListener('beforeunload', onUnload);
}

// ── Break Timer ───────────────────────────────────────────────────────
function startBreak() {
  overlay.classList.add('hidden');
  timerState = 'break';
  sessionLocked = true;

  let breakLeft = BREAK_SECONDS;
  digits.textContent  = fmt(breakLeft);
  digits.className    = 'timer-digits';
  stateEl.textContent = 'BREAK TIME';
  stateEl.className   = 'timer-state running';
  btnStart.classList.add('hidden');
  btnAbandon.classList.add('hidden');
  setRing(breakLeft, BREAK_SECONDS);

  const breakInterval = setInterval(() => {
    breakLeft--;
    digits.textContent = fmt(breakLeft);
    setRing(breakLeft, BREAK_SECONDS);
    if (breakLeft <= 0) {
      clearInterval(breakInterval);
      stateEl.textContent = 'BREAK OVER';
      digits.textContent  = '00:00';
      setTimeout(() => resetTimer(), 1500);
    }
  }, 1000);
}

// ── Early exit ────────────────────────────────────────────────────────
function onUnload(e) {
  if (sessionLocked || timerState !== 'running') return;
  fetch('/api/session/loss', { method: 'POST', keepalive: true });
  e.preventDefault();
  e.returnValue = '';
}

// ── Back link warning ─────────────────────────────────────────────────
backLink.addEventListener('click', async (e) => {
  if (timerState === 'running') {
    e.preventDefault();
    if (confirm('Leaving counts as a loss. Are you sure?')) {
      clearInterval(intervalId);
      sessionLocked = true;
      window.removeEventListener('beforeunload', onUnload);
      stopRain();
      await reportLoss(false);
      window.location.href = '/dashboard';
    }
  }
});

// ── Button listeners ──────────────────────────────────────────────────
btnStart.addEventListener('click', () => startTimer());

btnAbandon.addEventListener('click', async () => {
  if (timerState !== 'running') return;
  clearInterval(intervalId);
  sessionLocked = true;
  timerState    = 'done';
  window.removeEventListener('beforeunload', onUnload);
  stopRain();
  const stats = await reportLoss(false);
  showLoss(stats);
});

document.getElementById('break-yes').addEventListener('click', startBreak);
document.getElementById('break-no').addEventListener('click', () => {
  window.location.href = '/dashboard';
});

document.getElementById('retry-btn').addEventListener('click', () => {
  resetTimer();
});

// ── Init ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  digits.textContent = fmt(TOTAL_SECONDS);
  setRing(TOTAL_SECONDS, TOTAL_SECONDS);
});

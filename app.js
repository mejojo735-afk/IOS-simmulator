'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const screen = $('#screen');
const lock = $('#lock');
const home = $('#home');
const appLayer = $('#appLayer');
const cc = $('#cc');
const statusBar = $('#statusBar');
const homeIndicator = $('#homeIndicator');

const state = { locked: true, openApp: null, dark: false };

/* ---------- Fit phone to viewport ---------- */
function fit() {
  const s = Math.min(1, (innerHeight - 24) / 876, (innerWidth - 24) / 417);
  $('#phone').style.setProperty('--scale', s.toFixed(3));
}
addEventListener('resize', fit);
fit();

/* ---------- Clock ---------- */
function tick() {
  const now = new Date();
  const hm = now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
  $('#sbTime').textContent = hm;
  $('#lockTime').textContent = hm;
  $('#lockDate').textContent = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
}
setInterval(tick, 1000);
tick();

/* ---------- Apps ---------- */
const APPS = [
  { id: 'chrome', name: 'Chrome', logo: 'chrome-logo', render: renderChrome },
  { id: 'settings', name: 'Settings', glyph: '⚙️', bg: 'linear-gradient(#b8bcc4,#7d828c)', render: renderSettings },
  { id: 'calculator', name: 'Calculator', glyph: '🧮', bg: 'linear-gradient(#ffb340,#ff7a00)', render: renderCalculator, dark: true },
  { id: 'clock', name: 'Clock', glyph: '⏰', bg: 'linear-gradient(#3a3a3c,#111)', render: renderClock },
  { id: 'photos', name: 'Photos', glyph: '🌸', bg: 'linear-gradient(#fff,#e9e9ee)' },
  { id: 'camera', name: 'Camera', glyph: '📷', bg: 'linear-gradient(#d1d1d6,#8e8e93)' },
  { id: 'maps', name: 'Maps', glyph: '🗺️', bg: 'linear-gradient(#7fe08a,#2fb3ff)' },
  { id: 'weather', name: 'Weather', glyph: '⛅', bg: 'linear-gradient(#4fb3ff,#1c5fd6)' },
  { id: 'notes', name: 'Notes', glyph: '📝', bg: 'linear-gradient(#fff6c8,#ffd84d)' },
  { id: 'music', name: 'Music', glyph: '🎵', bg: 'linear-gradient(#ff6b81,#fa2d48)' },
  { id: 'mail', name: 'Mail', glyph: '✉️', bg: 'linear-gradient(#5ac8fa,#007aff)' },
  { id: 'calendar', name: 'Calendar', glyph: '📅', bg: 'linear-gradient(#fff,#f2f2f7)' },
];
const DOCK = ['phone', 'messages', 'chrome', 'music'];
const DOCK_EXTRA = {
  phone: { id: 'phone', name: 'Phone', glyph: '📞', bg: 'linear-gradient(#6fe27b,#28c840)' },
  messages: { id: 'messages', name: 'Messages', glyph: '💬', bg: 'linear-gradient(#6fe27b,#28c840)' },
};
const appById = id => APPS.find(a => a.id === id) || DOCK_EXTRA[id];

function iconEl(app) {
  const btn = document.createElement('button');
  btn.className = 'app-icon';
  btn.innerHTML = `<div class="tile ${app.logo || ''}" style="--bg:${app.bg || '#fff'}">${app.glyph || ''}</div><span>${app.name}</span>`;
  btn.addEventListener('click', () => openApp(app, btn.firstElementChild));
  return btn;
}
APPS.forEach(a => $('#grid').append(iconEl(a)));
DOCK.forEach(id => $('#dock').append(iconEl(appById(id))));

/* ---------- Open / close with zoom-from-icon animation ---------- */
function iconTransform(tile) {
  const s = screen.getBoundingClientRect();
  const r = tile.getBoundingClientRect();
  const scale = r.width / s.width;
  const dx = (r.left + r.width / 2) - (s.left + s.width / 2);
  const dy = (r.top + r.height / 2) - (s.top + s.height / 2);
  // translate in screen-space px, corrected for the phone's own CSS scale
  const k = s.width / screen.offsetWidth;
  return `translate(${dx / k}px, ${dy / k}px) scale(${scale}, ${r.height / s.height})`;
}

function openApp(app, tile) {
  if (state.openApp) return;
  const win = document.createElement('div');
  win.className = `app-window ${app.id}`;
  (app.render || renderPlaceholder)(win, app);
  appLayer.append(win);
  state.openApp = { app, win, tile };
  home.classList.add('behind');
  updateChromeColors();
  win.animate(
    [{ transform: iconTransform(tile), borderRadius: '60px', opacity: .4 }, { transform: 'none', borderRadius: '46px', opacity: 1 }],
    { duration: 520, easing: 'cubic-bezier(.32,.72,0,1)' }
  );
}

function closeApp() {
  const cur = state.openApp;
  if (!cur) return;
  state.openApp = null;
  home.classList.remove('behind');
  updateChromeColors();
  cur.win.cleanup?.();
  const anim = cur.win.animate(
    [{ transform: 'none', borderRadius: '46px', opacity: 1 }, { transform: iconTransform(cur.tile), borderRadius: '60px', opacity: 0 }],
    { duration: 420, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' }
  );
  anim.onfinish = () => cur.win.remove();
}

function updateChromeColors() {
  const app = state.openApp?.app;
  const lightUI = app && !app.dark && !state.dark;
  statusBar.classList.toggle('on-light', !!lightUI);
  homeIndicator.classList.toggle('dark', !!lightUI);
}

/* ---------- Lock / unlock ---------- */
function unlock() {
  if (!state.locked) return;
  state.locked = false;
  lock.classList.add('unlocked');
  home.classList.add('show');
  pulseIsland();
}

function pulseIsland() {
  const i = $('#island');
  i.classList.add('pulse');
  setTimeout(() => i.classList.remove('pulse'), 700);
}

// swipe up gesture helper: calls fn when dragged up far enough, or on a simple tap
function swipeUp(el, fn, { tap = true } = {}) {
  let startY = null;
  el.addEventListener('pointerdown', e => { startY = e.clientY; });
  el.addEventListener('pointerup', e => {
    if (startY === null) return;
    const dy = startY - e.clientY;
    startY = null;
    if (dy > 40 || (tap && Math.abs(dy) < 6)) fn();
  });
}
swipeUp(lock, unlock);
swipeUp(homeIndicator, () => (state.locked ? unlock() : closeApp()));
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (cc.classList.contains('open')) cc.classList.remove('open');
  else if (state.locked) unlock();
  else closeApp();
});

/* ---------- Control Center ---------- */
$('#ccHandle').addEventListener('click', () => cc.classList.toggle('open'));
cc.addEventListener('click', e => { if (e.target === cc) cc.classList.remove('open'); });
cc.querySelectorAll('[data-toggle]').forEach(b => b.addEventListener('click', () => b.classList.toggle('on')));
$('#brightness').addEventListener('input', e => { $('#dim').style.opacity = (1 - e.target.value / 100) * 0.85; });

/* ---------- Settings ---------- */
const WALLPAPERS = {
  aurora: 'linear-gradient(160deg,#6a5cff,#ff6fb1,#2ad4ff)',
  sunset: 'linear-gradient(160deg,#ff7a3d,#ffcc4d,#c8327a)',
  ocean: 'linear-gradient(160deg,#0a84ff,#30d6c7,#1240a0)',
  forest: 'linear-gradient(160deg,#34c759,#a4e05a,#0f6b4f)',
};

function renderSettings(win) {
  win.innerHTML = `
    <div class="app-body">
      <h1 class="app-title">Settings</h1>
      <div class="group">
        <div class="row"><div class="badge" style="background:#34c759">👤</div><div class="grow"><b>Aruneko</b><div class="sub">Apple Account, iCloud</div></div></div>
      </div>
      <div class="group">
        <div class="row"><div class="badge" style="background:#0a84ff">🖼️</div><div class="grow">Wallpaper</div></div>
        <div class="swatches">${Object.entries(WALLPAPERS).map(([k, g]) =>
          `<button class="swatch ${screen.dataset.wallpaper === k ? 'active' : ''}" data-wp="${k}" style="background:${g}" aria-label="${k}"></button>`).join('')}
        </div>
      </div>
      <div class="group">
        <div class="row"><div class="badge" style="background:#5e5ce6">🌙</div><div class="grow">Dark Mode</div><button class="switch ${state.dark ? 'on' : ''}" id="darkSwitch" aria-label="Dark Mode"></button></div>
        <div class="row"><div class="badge" style="background:#8e8e93">ℹ️</div><div class="grow">Software Version</div><span class="sub">iOS 26 (Web)</span></div>
      </div>
    </div>`;
  win.querySelectorAll('.swatch').forEach(b => b.addEventListener('click', () => {
    screen.dataset.wallpaper = b.dataset.wp;
    win.querySelectorAll('.swatch').forEach(x => x.classList.toggle('active', x === b));
  }));
  $('#darkSwitch', win).addEventListener('click', e => {
    state.dark = !state.dark;
    e.currentTarget.classList.toggle('on', state.dark);
    screen.classList.toggle('dark', state.dark);
    updateChromeColors();
  });
}

/* ---------- Calculator ---------- */
function renderCalculator(win) {
  win.classList.add('calc');
  const keys = ['AC', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '0', '.', '='];
  win.innerHTML = `<div class="app-body"><div class="calc-display">0</div><div class="calc-keys">${keys.map(k => {
    const cls = ['AC', '±', '%'].includes(k) ? 'fn' : ['÷', '×', '−', '+', '='].includes(k) ? 'op' : k === '0' ? 'zero' : '';
    return `<button class="key ${cls}" data-k="${k}">${k}</button>`;
  }).join('')}</div></div>`;
  const display = $('.calc-display', win);
  let cur = '0', prev = null, op = null, fresh = false;
  const ops = { '+': (a, b) => a + b, '−': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
  const fmt = v => String(+(+v).toPrecision(10)).slice(0, 10);
  win.querySelector('.calc-keys').addEventListener('click', e => {
    const k = e.target.dataset.k;
    if (!k) return;
    if (/[0-9]/.test(k)) { cur = fresh || cur === '0' ? k : cur + k; fresh = false; }
    else if (k === '.') { if (fresh) { cur = '0'; fresh = false; } if (!cur.includes('.')) cur += '.'; }
    else if (k === 'AC') { cur = '0'; prev = op = null; }
    else if (k === '±') cur = String(-cur);
    else if (k === '%') cur = String(cur / 100);
    else {
      if (op && prev !== null && !fresh) cur = String(ops[op](+prev, +cur));
      op = k === '=' ? null : k;
      prev = k === '=' ? null : cur;
      fresh = true;
    }
    display.textContent = cur.endsWith('.') ? cur : fmt(cur);
  });
}

/* ---------- Clock (stopwatch) ---------- */
function renderClock(win) {
  win.innerHTML = `<div class="app-body"><h1 class="app-title">Stopwatch</h1>
    <div class="clock-big" id="swTime">00:00.00</div><div class="clock-sub" id="nowTime"></div>
    <div class="sw-btns"><button class="sw-btn reset">Reset</button><button class="sw-btn go">Start</button></div></div>`;
  const out = $('#swTime', win), go = $('.go', win);
  let running = false, base = 0, startedAt = 0;
  const fmt = ms => {
    const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
  };
  const timer = setInterval(() => {
    out.textContent = fmt(base + (running ? Date.now() - startedAt : 0));
    $('#nowTime', win).textContent = new Date().toLocaleTimeString('th-TH');
  }, 30);
  go.addEventListener('click', () => {
    if (running) base += Date.now() - startedAt; else startedAt = Date.now();
    running = !running;
    go.textContent = running ? 'Stop' : 'Start';
  });
  $('.reset', win).addEventListener('click', () => { base = 0; startedAt = Date.now(); });
  win.cleanup = () => clearInterval(timer);
}

function renderPlaceholder(win, app) {
  win.innerHTML = `<div class="app-body placeholder"><div><div class="tile ${app.logo || ''}" style="--bg:${app.bg}">${app.glyph || ''}</div>
    <h2 style="color:var(--app-text)">${app.name}</h2><p>เร็วๆ นี้ — ปัดขึ้นที่แถบล่างเพื่อกลับหน้าโฮม</p></div></div>`;
}

/* ---------- Chrome ---------- */
// Sites known to send X-Frame-Options / CSP frame-ancestors, so they can't load inside an iframe.
const FRAME_BLOCKED = ['google.', 'youtube.com', 'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'github.com', 'tiktok.com', 'reddit.com'];
const SHORTCUTS = [
  { name: 'Wikipedia', url: 'https://th.wikipedia.org', g: 'W' },
  { name: 'Bing', url: 'https://www.bing.com', g: '🔎' },
  { name: 'Example', url: 'https://example.com', g: 'E' },
  { name: 'OSM', url: 'https://www.openstreetmap.org/export/embed.html', g: '🗺️' },
];

function toUrl(input) {
  const v = input.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(v)) return 'https://' + v;
  return 'https://www.bing.com/search?q=' + encodeURIComponent(v);
}

function renderChrome(win) {
  win.innerHTML = `
    <div class="chrome-view">
      <div class="chrome-progress"></div>
      <iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" referrerpolicy="no-referrer" hidden></iframe>
      <div class="ntp">
        <div class="ntp-logo chrome-logo"></div>
        <button class="ntp-search">🔍 ค้นหาหรือพิมพ์ URL</button>
        <div class="shortcuts">${SHORTCUTS.map(s => `<button class="shortcut" data-url="${s.url}"><b>${s.g}</b>${s.name}</button>`).join('')}</div>
      </div>
      <div class="blocked" hidden>
        <div style="font-size:48px">🧱</div>
        <h3>เว็บนี้ไม่อนุญาตให้แสดงในหน้าต่างจำลอง</h3>
        <p class="blocked-url"></p>
        <a class="pill-btn" target="_blank" rel="noopener">เปิดในแท็บใหม่</a>
      </div>
    </div>
    <div class="glass chrome-bar">
      <button class="back" aria-label="Back" disabled>‹</button>
      <button class="fwd" aria-label="Forward" disabled>›</button>
      <form><input class="omnibox" placeholder="ค้นหาหรือพิมพ์ URL" inputmode="url" autocomplete="off" spellcheck="false"></form>
      <button class="reload" aria-label="Reload">↻</button>
      <button class="ext" aria-label="Open in new tab">↗</button>
    </div>`;

  const frame = $('iframe', win), ntp = $('.ntp', win), blocked = $('.blocked', win);
  const omni = $('.omnibox', win), progress = $('.chrome-progress', win);
  const back = $('.back', win), fwd = $('.fwd', win);
  const history = [];
  let idx = -1;

  function load(url) {
    const host = new URL(url).hostname;
    omni.value = host.replace(/^www\./, '');
    ntp.hidden = true;
    back.disabled = idx < 0;
    fwd.disabled = idx >= history.length - 1;
    if (FRAME_BLOCKED.some(d => (d.endsWith('.') ? host.includes(d) : host === d || host.endsWith('.' + d)))) {
      frame.hidden = true;
      blocked.hidden = false;
      $('.blocked-url', blocked).textContent = url;
      $('a', blocked).href = url;
      return;
    }
    blocked.hidden = true;
    frame.hidden = false;
    progress.style.opacity = 1;
    progress.style.width = '70%';
    frame.src = url;
  }
  frame.addEventListener('load', () => {
    progress.style.width = '100%';
    setTimeout(() => { progress.style.opacity = 0; progress.style.width = '0'; }, 400);
  });

  function navigate(url) {
    history.splice(idx + 1);
    history.push(url);
    idx = history.length - 1;
    load(url);
  }
  function showNtp() {
    idx = -1;
    ntp.hidden = false; frame.hidden = true; blocked.hidden = true;
    omni.value = '';
    back.disabled = true;
    fwd.disabled = history.length === 0;
  }

  $('form', win).addEventListener('submit', e => {
    e.preventDefault();
    const url = toUrl(omni.value);
    omni.blur();
    if (url) navigate(url);
  });
  omni.addEventListener('focus', () => { if (idx >= 0) omni.value = history[idx]; omni.select(); });
  back.addEventListener('click', () => { if (idx > 0) load(history[--idx]); else showNtp(); });
  fwd.addEventListener('click', () => { if (idx < history.length - 1) load(history[++idx]); });
  $('.reload', win).addEventListener('click', () => { if (idx >= 0) load(history[idx]); });
  $('.ext', win).addEventListener('click', () => { if (idx >= 0) window.open(history[idx], '_blank', 'noopener'); });
  $('.ntp-search', win).addEventListener('click', () => omni.focus());
  win.querySelectorAll('.shortcut').forEach(b => b.addEventListener('click', () => navigate(b.dataset.url)));
}

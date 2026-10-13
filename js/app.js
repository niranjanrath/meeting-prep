/* App shell: boot, hash router, header/sidebar chrome. */
import { $, $$, esc, debounce } from './util.js';
import { icon } from './icons.js';
import { initDB, getMeta, getPrep } from './db.js';
import * as store from './store.js';
import { showBanner } from './ui.js';
import * as prepView from './views/prep-view.js';
import * as prepsView from './views/preps-view.js';
import * as templatesView from './views/templates-view.js';
import * as settingsView from './views/settings-view.js';

window.__mpBooted = true; // modules loaded: lets index.html hide the "serve over http" hint

const views = { new: prepView, prep: prepView, preps: prepsView, templates: templatesView, settings: settingsView };
const TITLES = { new: 'New Preparation', prep: 'Preparation', preps: 'My Preparations', templates: 'Templates', settings: 'Settings' };

function parseHash(hash) {
  const [path, query = ''] = String(hash || '').replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(query);
  switch (parts[0]) {
    case 'prep': return { name: 'prep', id: parts[1], nav: 'new' };
    case 'preps': return { name: 'preps', q: params.get('q') || '', nav: 'preps' };
    case 'templates': return { name: 'templates', id: parts[1], nav: 'templates' };
    case 'settings': return { name: 'settings', nav: 'settings' };
    default: return { name: 'new', nav: 'new' };
  }
}

/* ---------------- chrome ---------------- */

function refreshChrome() {
  const s = store.getSettings();
  const initials = (s.initials || '').trim().toUpperCase().slice(0, 3);
  const av = $('#avatar');
  av.innerHTML = initials ? esc(initials) : icon('user', 18);
  av.title = initials ? `Profile: ${initials}` : 'Profile';
  const dark = document.documentElement.dataset.theme === 'dark';
  const btn = $('#theme-toggle');
  btn.innerHTML = icon(dark ? 'sun' : 'moon', 20);
  btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
}

function setupChrome() {
  $('#brand-ico').innerHTML = icon('calendar-check', 28);
  $('#search-ico').innerHTML = icon('search', 18);
  $$('.nav-item').forEach((a) => { $('.nav-ico', a).innerHTML = icon(a.dataset.icon, 22); });

  $('#theme-toggle').addEventListener('click', async () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    store.applyTheme(next);
    refreshChrome();
    try { await store.updateSettings({ theme: next }); } catch (e) { console.warn(e); }
  });

  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (store.getSettings().theme === 'system') { store.applyTheme('system'); refreshChrome(); }
    });
  }

  document.addEventListener('mp:settings', () => { store.applyTheme(); refreshChrome(); });

  const search = $('#global-search');
  const go = debounce(() => {
    const q = search.value.trim();
    if (q) location.hash = '#/preps?q=' + encodeURIComponent(q);
    else if (parseHash(location.hash).name === 'preps') location.hash = '#/preps';
  }, 200);
  search.addEventListener('input', go);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { go.cancel(); const q = search.value.trim(); if (q) location.hash = '#/preps?q=' + encodeURIComponent(q); }
  });

  refreshChrome();
}

/* ---------------- router ---------------- */

let current = null;
let token = 0;

async function navigate() {
  const my = ++token;
  const route = parseHash(location.hash);
  const view = $('#view');

  // Same list view, only the search changed: filter in place.
  if (route.name === 'preps' && current?.name === 'preps' && current.update) {
    current.update(route);
    return;
  }

  if (current?.unmount) {
    try { await current.unmount(); } catch (e) { console.error(e); }
  }
  current = null;
  if (my !== token) return;

  $$('.nav-item').forEach((a) => {
    if (a.dataset.route === route.nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `${TITLES[route.name] || 'Meeting Prep'} · Meeting Prep`;

  const search = $('#global-search');
  if (route.name === 'preps') { if (search.value.trim() !== route.q) search.value = route.q; }
  else if (search.value) search.value = '';

  let inst;
  try {
    inst = await views[route.name].mount(view, route);
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="notice notice-error" role="alert">${icon('alert-triangle', 18)}<span>Something went wrong while loading this screen. Reload the page, or go back to <a href="#/new">New Meeting Prep</a>.</span></div>`;
    return;
  }
  if (my !== token) {
    try { await inst?.unmount?.(); } catch (e) { console.error(e); }
    return;
  }
  current = inst || null;
  $('.main').scrollTo({ top: 0 });
}

/** On a fresh visit (no deep link), reopen the most recent unfinished preparation. */
async function resumeDraft() {
  try {
    const id = await getMeta('currentPrepId');
    if (!id) return;
    const p = await getPrep(id);
    if (p && p.typeId && !p.completed) history.replaceState(null, '', '#/prep/' + encodeURIComponent(id));
  } catch (e) {
    console.warn('Could not restore the unfinished preparation:', e);
  }
}

async function boot() {
  const res = await initDB();
  if (!res.ok) {
    showBanner('Browser storage is unavailable (for example in a private window), so your work cannot be saved after you close this tab. You can still use the app and export your note.');
  }
  await store.loadStore();
  store.applyTheme();
  setupChrome();
  if (!location.hash || location.hash === '#' || location.hash === '#/new') await resumeDraft();
  window.addEventListener('hashchange', navigate);
  await navigate();
}

boot().catch((err) => {
  console.error(err);
  $('#view').innerHTML = '<div class="notice notice-error" role="alert">The app could not start. Reload the page and try again.</div>';
});

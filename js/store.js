/* Application-level state: settings and the template registry (built-ins + saved overrides + custom types). */
import * as db from './db.js';
import { DEFAULT_TEMPLATES, TEMPLATE_ORDER, getDefaultTemplate, normalizeTemplate } from './templates.js';

export { getDefaultTemplate };

const DEFAULT_SETTINGS = { theme: 'system', initials: '', preparedBy: '', omitEmpty: false };

let settings = { ...DEFAULT_SETTINGS };
let registry = new Map();
let overridden = new Set();

export const getSettings = () => settings;

export async function updateSettings(patch) {
  settings = { ...settings, ...patch };
  await db.setMeta('settings', settings);
  return settings;
}

export function replaceSettings(next) {
  settings = { ...DEFAULT_SETTINGS, ...(next || {}) };
}

export async function loadStore() {
  try {
    settings = { ...DEFAULT_SETTINGS, ...(await db.getMeta('settings', {})) };
  } catch (e) {
    console.warn('Could not read settings:', e);
  }
  await reloadTemplates();
}

export async function reloadTemplates() {
  registry = new Map();
  overridden = new Set();
  for (const id of TEMPLATE_ORDER) registry.set(id, getDefaultTemplate(id));
  let records = [];
  try {
    records = await db.listTemplateRecords();
  } catch (e) {
    console.warn('Could not read saved templates:', e);
  }
  records.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  for (const rec of records) {
    const t = normalizeTemplate(rec);
    if (!t) continue; // corrupt record: built-in (if any) stays in place
    if (DEFAULT_TEMPLATES[t.id]) {
      t.custom = false;
      overridden.add(t.id);
    } else {
      t.custom = true;
    }
    registry.set(t.id, t);
  }
}

export const listTemplates = () => Array.from(registry.values());
export const getTemplate = (id) => registry.get(id) || null;
export const isCustomized = (id) => overridden.has(id);
export const isBuiltIn = (id) => !!DEFAULT_TEMPLATES[id];

export async function saveTemplate(t) {
  const n = normalizeTemplate(t);
  if (!n) throw new Error('The template is not valid.');
  n.custom = !DEFAULT_TEMPLATES[n.id];
  n.createdAt = n.createdAt || Date.now();
  n.updatedAt = Date.now();
  await db.saveTemplateRecord(n);
  await reloadTemplates();
  return n;
}

export async function resetTemplate(id) {
  await db.deleteTemplateRecord(id);
  await reloadTemplates();
}

export async function deleteCustomTemplate(id) {
  if (DEFAULT_TEMPLATES[id]) throw new Error('Built-in templates cannot be deleted.');
  await db.deleteTemplateRecord(id);
  await reloadTemplates();
}

/** Options applied when generating the note for copy / print / export. */
export function noteOptions() {
  return { omitEmpty: !!settings.omitEmpty, preparedBy: settings.preparedBy || '' };
}

export function applyTheme(pref = settings.theme) {
  let theme = pref;
  if (theme === 'system') {
    theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('mp-theme', pref); } catch { /* storage blocked */ }
  return theme;
}

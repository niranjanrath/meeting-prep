/*
 * IndexedDB access layer. The only module that touches indexedDB.
 *
 * Stores:
 *   preps      { id, typeId, title, answers, stage, step, completed, template, createdAt, updatedAt, ... }
 *   templates  customised or custom meeting templates (overrides of built-ins, or new types)
 *   meta       key/value: settings, currentPrepId
 *
 * If IndexedDB is unavailable (private mode, blocked, old browser) every call falls back to an
 * in-memory store so the app keeps working for the session; isPersistent() tells callers.
 */
import { clone } from './util.js';

const DB_NAME = 'meeting-prep';
const DB_VERSION = 1;
const KEYS = { preps: 'id', templates: 'id', meta: 'key' };

let db = null;
let persistent = false;
let initError = null;
const memory = { preps: new Map(), templates: new Map(), meta: new Map() };

export const isPersistent = () => persistent;
export const getInitError = () => initError;

function openDatabase() {
  return new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('preps')) {
        d.createObjectStore('preps', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      }
      if (!d.objectStoreNames.contains('templates')) d.createObjectStore('templates', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open the local database.'));
    req.onblocked = () =>
      reject(new Error('The database is blocked by another open tab. Close other Meeting Prep tabs and reload.'));
  });
}

export async function initDB() {
  try {
    if (!globalThis.indexedDB) throw new Error('IndexedDB is not supported in this browser.');
    db = await openDatabase();
    db.onversionchange = () => {
      db.close();
      db = null;
      persistent = false;
    };
    persistent = true;
    return { ok: true };
  } catch (err) {
    console.warn('IndexedDB unavailable, using memory only:', err);
    db = null;
    persistent = false;
    initError = err;
    return { ok: false, error: err };
  }
}

function request(store, mode, action) {
  return new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(store, mode);
    } catch (e) {
      reject(e);
      return;
    }
    let out;
    try {
      const req = action(tx.objectStore(store));
      if (req) req.onsuccess = () => { out = req.result; };
    } catch (e) {
      try { tx.abort(); } catch { /* already finished */ }
      reject(e);
      return;
    }
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('The database operation was aborted.'));
  });
}

async function put(store, value) {
  if (!persistent) {
    memory[store].set(value[KEYS[store]], clone(value));
    return;
  }
  await request(store, 'readwrite', (s) => s.put(value));
}

async function get(store, key) {
  if (!persistent) return clone(memory[store].get(key));
  return request(store, 'readonly', (s) => s.get(key));
}

async function getAll(store) {
  if (!persistent) return clone(Array.from(memory[store].values()));
  return (await request(store, 'readonly', (s) => s.getAll())) || [];
}

async function remove(store, key) {
  if (!persistent) {
    memory[store].delete(key);
    return;
  }
  await request(store, 'readwrite', (s) => s.delete(key));
}

/* ---- Preparations ---- */
export const savePrep = (prep) => put('preps', prep);
export const getPrep = (id) => get('preps', id);
export const deletePrep = (id) => remove('preps', id);
export async function listPreps() {
  const all = await getAll('preps');
  return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/* ---- Templates ---- */
export const saveTemplateRecord = (t) => put('templates', t);
export const listTemplateRecords = () => getAll('templates');
export const deleteTemplateRecord = (id) => remove('templates', id);

/* ---- Meta (settings, current draft pointer) ---- */
export async function getMeta(key, fallback = null) {
  const rec = await get('meta', key);
  return rec ? rec.value : fallback;
}
export const setMeta = (key, value) => put('meta', { key, value });

/* ---- Backup / restore ---- */
export async function exportAll() {
  return {
    app: 'meeting-prep',
    version: 1,
    exportedAt: Date.now(),
    settings: await getMeta('settings', {}),
    templates: await getAll('templates'),
    preps: await getAll('preps'),
  };
}

export async function importAll(data) {
  if (!data || data.app !== 'meeting-prep' || !Array.isArray(data.preps) || !Array.isArray(data.templates)) {
    throw new Error('This file is not a Meeting Prep backup.');
  }
  let preps = 0;
  let templates = 0;
  for (const p of data.preps) {
    if (p && typeof p.id === 'string') { await savePrep(p); preps++; }
  }
  for (const t of data.templates) {
    if (t && typeof t.id === 'string') { await saveTemplateRecord(t); templates++; }
  }
  if (data.settings && typeof data.settings === 'object') await setMeta('settings', data.settings);
  return { preps, templates };
}

export async function clearAll() {
  for (const store of Object.keys(KEYS)) {
    if (!persistent) memory[store].clear();
    else await request(store, 'readwrite', (s) => s.clear());
  }
}

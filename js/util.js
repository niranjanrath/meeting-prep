/* Small shared helpers: DOM, escaping, ids, dates. No app logic here. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export function uid() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function debounce(fn, ms) {
  let t;
  const d = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  d.cancel = () => clearTimeout(t);
  return d;
}

export function clone(v) {
  if (v === undefined) return v;
  return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
}

const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

export const fmtDate = (ts) => (ts ? dateFmt.format(new Date(ts)) : '');
export const fmtDateTime = (ts) => (ts ? dateTimeFmt.format(new Date(ts)) : '');
export const fmtTime = (ts) => (ts ? timeFmt.format(new Date(ts)) : '');

/** 'YYYY-MM-DD' (from <input type="date">) -> 'Wed, 14 Oct 2026', parsed as a local date. */
export function fmtDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  return dayFmt.format(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function fmtRelative(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return fmtDate(ts);
}

export function slug(s) {
  return (
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'note'
  );
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Shared UI primitives: toasts, banner, dialogs. */
import { $, esc } from './util.js';

export function toast(message, type = 'info', timeout = 3600) {
  const host = $('#toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 250);
  }, timeout);
}

export function showBanner(message) {
  const b = $('#banner');
  if (!b) return;
  b.textContent = message;
  b.hidden = false;
}

export function hideBanner() {
  const b = $('#banner');
  if (b) b.hidden = true;
}

let backdropBound = false;

/**
 * Open the shared <dialog> with the given inner HTML.
 * Resolves with { value, dialog } once it closes; `value` is the pressed button's value.
 * Callers read form fields from `dialog` after it resolves.
 */
export function openDialog(html) {
  const dialog = $('#dialog');
  if (!backdropBound) {
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close('cancel');
    });
    backdropBound = true;
  }
  dialog.innerHTML = html;
  dialog.returnValue = '';
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve({ value: dialog.returnValue, dialog }), { once: true });
    try {
      dialog.showModal();
    } catch (e) {
      console.error(e);
      resolve({ value: 'cancel', dialog });
    }
  });
}

export async function confirmDialog({
  title, message, html = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false,
}) {
  const { value } = await openDialog(`
    <form method="dialog" class="dialog-form">
      <h2 id="dialog-title">${esc(title)}</h2>
      ${message ? `<p>${esc(message)}</p>` : ''}${html}
      <div class="dialog-actions">
        <button class="btn" value="cancel">${esc(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" value="ok" autofocus>${esc(confirmText)}</button>
      </div>
    </form>`);
  return value === 'ok';
}

/** Fallback when clipboard or download is blocked: show the text so it can be copied by hand. */
export function textDialog({ title, intro = '', text }) {
  const p = openDialog(`
    <form method="dialog" class="dialog-form dialog-wide">
      <h2 id="dialog-title">${esc(title)}</h2>
      ${intro ? `<p>${esc(intro)}</p>` : ''}
      <label class="sr-only" for="dlg-text">Note text</label>
      <textarea id="dlg-text" class="dlg-text" readonly rows="14"></textarea>
      <div class="dialog-actions"><button class="btn btn-primary" value="ok">Close</button></div>
    </form>`);
  const ta = $('#dlg-text');
  if (ta) {
    ta.value = text;
    ta.focus();
    ta.select();
  }
  return p;
}

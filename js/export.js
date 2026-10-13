/* Copy / print / download actions with graceful fallbacks. */
import { noteToText, noteToHtml, noteFilename } from './note.js';
import { toast, textDialog } from './ui.js';
import { $ } from './util.js';

async function writeClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('Async clipboard failed, trying fallback:', e);
    }
  }
  // Legacy fallback (works on http:// and when the Clipboard API is denied).
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (e) {
    console.warn(e);
  }
  ta.remove();
  return ok;
}

export async function copyNote(note) {
  const text = noteToText(note);
  if (await writeClipboard(text)) {
    toast('Note copied to clipboard.', 'success');
    return true;
  }
  await textDialog({
    title: 'Copy the note manually',
    intro: 'Your browser blocked clipboard access. The text is selected below: press Ctrl/Cmd+C to copy it.',
    text,
  });
  return false;
}

export async function downloadNote(note) {
  const text = noteToText(note);
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = noteFilename(note);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Text file downloaded.', 'success');
    return true;
  } catch (e) {
    console.error(e);
    await textDialog({
      title: 'Download failed',
      intro: 'The file could not be created. You can copy the text below instead.',
      text,
    });
    return false;
  }
}

export function printNote(note) {
  const root = $('#print-root');
  if (!root) {
    toast('Printing is not available here.', 'error');
    return false;
  }
  try {
    root.innerHTML = noteToHtml(note);
    const clear = () => { root.innerHTML = ''; window.removeEventListener('afterprint', clear); };
    window.addEventListener('afterprint', clear);
    window.print();
    return true;
  } catch (e) {
    console.error(e);
    root.innerHTML = '';
    toast('Could not open the print dialog. Try copying the note instead.', 'error');
    return false;
  }
}

/** Download any JSON-serialisable value as a file (used for backups). */
export function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

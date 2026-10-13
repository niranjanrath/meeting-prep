/* Settings: profile, theme, note options, storage status and backup / restore. */
import { icon } from '../icons.js';
import { esc, debounce } from '../util.js';
import * as db from '../db.js';
import * as store from '../store.js';
import { downloadJson } from '../export.js';
import { toast, confirmDialog } from '../ui.js';

const changed = () => document.dispatchEvent(new CustomEvent('mp:settings'));

export async function mount(root) {
  const wrap = document.createElement('div');
  root.replaceChildren(wrap);
  const s = store.getSettings();

  const radio = (value, label) =>
    `<label class="choice"><input type="radio" name="theme" value="${value}" ${s.theme === value ? 'checked' : ''}> <span>${label}</span></label>`;

  wrap.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p class="muted">Everything is stored locally in this browser. Nothing is sent anywhere.</p></div></div>

    <section class="card">
      <h2 class="card-title">Profile</h2>
      <div class="form-grid">
        <div class="field"><label for="s-initials">Initials in the header</label>
          <input id="s-initials" type="text" maxlength="3" value="${esc(s.initials)}" autocomplete="off">
          <p class="hint">Up to 3 characters. Leave empty for a generic icon.</p></div>
        <div class="field"><label for="s-by">&ldquo;Prepared by&rdquo; name</label>
          <input id="s-by" type="text" maxlength="80" value="${esc(s.preparedBy)}" autocomplete="off">
          <p class="hint">Added to copied, printed and exported notes. Leave empty to omit.</p></div>
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">Appearance</h2>
      <div class="choices" role="radiogroup" aria-label="Theme">${radio('system', 'Match system')}${radio('light', 'Light')}${radio('dark', 'Dark')}</div>
    </section>

    <section class="card">
      <h2 class="card-title">Notes</h2>
      <label class="choice"><input type="checkbox" id="s-omit" ${s.omitEmpty ? 'checked' : ''}>
        <span>Leave out empty sections when copying, printing and exporting</span></label>
      <p class="hint">The live preview always shows every section so you can see what is missing.</p>
    </section>

    <section class="card">
      <h2 class="card-title">Your data</h2>
      <p class="storage ${db.isPersistent() ? 'is-ok' : 'is-error'}">${icon('database', 16)}
        ${db.isPersistent() ? 'Saved in this browser (IndexedDB). It stays after you close the tab.' : 'Browser storage is unavailable. Work is kept only until you close this tab.'}</p>
      <div class="export-row">
        <button type="button" class="btn" id="s-export">${icon('download', 16)} Export backup</button>
        <button type="button" class="btn" id="s-import">${icon('upload', 16)} Import backup</button>
        <button type="button" class="btn btn-danger-outline" id="s-clear">${icon('trash', 16)} Delete all data</button>
        <input type="file" id="s-file" accept="application/json,.json" hidden>
      </div>
      <p class="hint">A backup contains all preparations, custom templates and settings as one JSON file.</p>
    </section>`;

  const $w = (sel) => wrap.querySelector(sel);

  async function persist(patch) {
    try {
      await store.updateSettings(patch);
    } catch (e) {
      console.error(e);
      toast('Settings could not be saved.', 'error');
    }
    changed();
  }

  const saveText = debounce(() => persist({
    initials: $w('#s-initials').value.trim().toUpperCase().slice(0, 3),
    preparedBy: $w('#s-by').value.trim(),
  }), 400);

  wrap.addEventListener('input', (e) => {
    if (e.target.id === 's-initials' || e.target.id === 's-by') saveText();
  });

  wrap.addEventListener('change', async (e) => {
    if (e.target.name === 'theme') {
      store.applyTheme(e.target.value);
      await persist({ theme: e.target.value });
    } else if (e.target.id === 's-omit') {
      await persist({ omitEmpty: e.target.checked });
    } else if (e.target.id === 's-file') {
      await importFile(e.target);
    }
  });

  wrap.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 's-export') {
      try {
        const data = await db.exportAll();
        downloadJson(`meeting-prep-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
        toast('Backup downloaded.', 'success');
      } catch (err) {
        console.error(err);
        toast('The backup could not be created.', 'error');
      }
    } else if (b.id === 's-import') {
      $w('#s-file').click();
    } else if (b.id === 's-clear') {
      const ok = await confirmDialog({
        title: 'Delete all data?',
        message: 'All preparations, custom templates and settings in this browser will be permanently deleted. Export a backup first if you might need them.',
        confirmText: 'Delete everything',
        danger: true,
      });
      if (!ok) return;
      try {
        await db.clearAll();
        await store.loadStore();
        store.applyTheme();
        changed();
        toast('All data deleted.', 'success');
        location.hash = '#/new';
      } catch (err) {
        console.error(err);
        toast('Not everything could be deleted.', 'error');
      }
    }
  });

  async function importFile(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const ok = await confirmDialog({
        title: 'Import this backup?',
        message: 'Items in the file are added to your data. Preparations and templates with the same id are overwritten.',
        confirmText: 'Import',
      });
      if (!ok) return;
      const n = await db.importAll(data);
      await store.loadStore();
      store.applyTheme();
      changed();
      toast(`Imported ${n.preps} preparation${n.preps === 1 ? '' : 's'} and ${n.templates} template${n.templates === 1 ? '' : 's'}.`, 'success');
    } catch (err) {
      console.error(err);
      toast(err instanceof SyntaxError ? 'That file is not valid JSON.' : err.message || 'The backup could not be imported.', 'error', 6000);
    }
  }

  return { name: 'settings', unmount: () => saveText.cancel() };
}

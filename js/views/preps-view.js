/* My Preparations: list, search, filter, reopen, duplicate, delete, quick copy. */
import { icon } from '../icons.js';
import { esc, fmtRelative, fmtDay, fmtDate } from '../util.js';
import * as db from '../db.js';
import * as store from '../store.js';
import { buildNote, countAnswered } from '../note.js';
import { duplicatePrep } from '../wizard.js';
import { copyNote } from '../export.js';
import { toast, confirmDialog } from '../ui.js';

export async function mount(root, route) {
  const wrap = document.createElement('div');
  root.replaceChildren(wrap);

  let all = [];
  let query = (route.q || '').trim().toLowerCase();
  let filter = 'all';

  try {
    all = await db.listPreps();
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="notice notice-error" role="alert">${icon('alert-triangle', 18)}<span>Your saved preparations could not be loaded. Reload the page to try again.</span></div>`;
    return { name: 'preps' };
  }

  const templateOf = (p) => p.template || store.getTemplate(p.typeId);

  function matches(p) {
    if (filter === 'draft' && p.completed) return false;
    if (filter === 'complete' && !p.completed) return false;
    if (!query) return true;
    const t = templateOf(p);
    const hay = [p.title, t?.name, t?.fullName, ...Object.values(p.answers || {})].join(' ').toLowerCase();
    return hay.includes(query);
  }

  function itemHtml(p) {
    const t = templateOf(p);
    const total = t?.questions.length || 0;
    const answered = t ? countAnswered(t, p) : 0;
    const pct = total ? Math.round((answered / total) * 100) : 0;
    return `<li class="prep-item">
      <span class="tile">${icon(t?.icon || 'file-text', 24)}</span>
      <div class="pi-main">
        <h3><a href="#/prep/${esc(p.id)}">${esc(p.title || 'Untitled preparation')}</a>
          <span class="badge ${p.completed ? 'badge-ok' : 'badge-draft'}">${p.completed ? 'Complete' : 'Draft'}</span></h3>
        <p class="muted">${esc(t?.fullName || t?.name || 'Meeting')} &middot; Updated ${esc(fmtRelative(p.updatedAt))}
          &middot; Created ${esc(fmtDate(p.createdAt))}${p.meetingDate ? ` &middot; Meeting ${esc(fmtDay(p.meetingDate))}` : ''}</p>
        <div class="progress-row">
          <div class="progress" role="progressbar" aria-label="Answered" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${answered}"><span style="width:${pct}%"></span></div>
          <span class="progress-label">${answered}/${total} answered</span>
        </div>
      </div>
      <div class="pi-actions">
        <a class="btn btn-sm" href="#/prep/${esc(p.id)}">${icon('pencil', 14)} Open</a>
        <button type="button" class="btn btn-sm" data-act="copy" data-id="${esc(p.id)}">${icon('copy', 14)} Copy note</button>
        <button type="button" class="btn btn-sm" data-act="dup" data-id="${esc(p.id)}">${icon('layers', 14)} Duplicate</button>
        <button type="button" class="btn btn-sm btn-danger-outline" data-act="del" data-id="${esc(p.id)}">${icon('trash', 14)} Delete</button>
      </div>
    </li>`;
  }

  function render() {
    const shown = all.filter(matches);
    const drafts = all.filter((p) => !p.completed).length;
    const chip = (key, label, n) =>
      `<button type="button" class="chip" data-filter="${key}" aria-pressed="${filter === key}">${label} <span>${n}</span></button>`;
    let body;
    if (!all.length) {
      body = `<div class="empty"><span class="empty-ico">${icon('file-text', 36)}</span>
        <h2>No preparations yet</h2><p class="muted">Your saved notes will appear here. They are stored in this browser only.</p>
        <a class="btn btn-primary" href="#/new">${icon('plus', 16)} Start a preparation</a></div>`;
    } else if (!shown.length) {
      body = `<div class="empty"><span class="empty-ico">${icon('search', 36)}</span>
        <h2>No matches</h2><p class="muted">${query ? `Nothing matches &ldquo;${esc(query)}&rdquo;` : 'Nothing in this filter'}. Try a different search or filter.</p></div>`;
    } else {
      body = `<ul class="prep-list">${shown.map(itemHtml).join('')}</ul>`;
    }
    wrap.innerHTML = `
      <div class="page-head">
        <div><h1>My Preparations</h1><p class="muted">Reopen, edit, duplicate or delete your saved preparation notes.</p></div>
        <a class="btn btn-primary" href="#/new">${icon('plus', 16)} New preparation</a>
      </div>
      ${all.length ? `<div class="chips" role="group" aria-label="Filter preparations">
        ${chip('all', 'All', all.length)}${chip('draft', 'Drafts', drafts)}${chip('complete', 'Complete', all.length - drafts)}
      </div>` : ''}
      ${query && all.length ? `<p class="muted" role="status">Showing ${shown.length} result${shown.length === 1 ? '' : 's'} for &ldquo;${esc(query)}&rdquo;</p>` : ''}
      ${body}`;
  }

  wrap.addEventListener('click', async (e) => {
    const chipBtn = e.target.closest('[data-filter]');
    if (chipBtn) {
      filter = chipBtn.dataset.filter;
      render();
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const p = all.find((x) => x.id === btn.dataset.id);
    if (!p) return;

    if (btn.dataset.act === 'copy') {
      const t = templateOf(p);
      if (t) await copyNote(buildNote(t, p, store.noteOptions()));
    } else if (btn.dataset.act === 'dup') {
      try {
        const copy = duplicatePrep(p);
        await db.savePrep(copy);
        all.unshift(copy);
        render();
        toast('Preparation duplicated.', 'success');
      } catch (err) {
        console.error(err);
        toast('Could not duplicate the preparation.', 'error');
      }
    } else if (btn.dataset.act === 'del') {
      const ok = await confirmDialog({
        title: 'Delete this preparation?',
        message: `“${p.title || 'Untitled preparation'}” will be permanently removed from this browser. This cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;
      try {
        await db.deletePrep(p.id);
        if ((await db.getMeta('currentPrepId')) === p.id) await db.setMeta('currentPrepId', null);
        all = all.filter((x) => x.id !== p.id);
        render();
        toast('Preparation deleted.', 'success');
      } catch (err) {
        console.error(err);
        toast('Could not delete the preparation.', 'error');
      }
    }
  });

  render();

  return {
    name: 'preps',
    update(next) {
      query = (next.q || '').trim().toLowerCase();
      render();
    },
  };
}

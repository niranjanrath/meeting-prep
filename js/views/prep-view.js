/*
 * New Preparation / edit a preparation: the guided wizard (left) + live paper-style note (right).
 * All content comes from the preparation's template; this file contains no meeting-specific text.
 */
import { icon } from '../icons.js';
import { esc, $$, fmtDay, fmtTime } from '../util.js';
import { Wizard } from '../wizard.js';
import * as store from '../store.js';
import { isPersistent } from '../db.js';
import { buildNote } from '../note.js';
import { copyNote, printNote, downloadNote } from '../export.js';
import { toast, confirmDialog, openDialog } from '../ui.js';

const shell = () => `
  <div class="mobile-tabs" role="tablist" aria-label="Show wizard or preview">
    <button type="button" role="tab" class="tab" data-pane="wizard" aria-selected="true">${icon('edit', 16)} Wizard</button>
    <button type="button" role="tab" class="tab" data-pane="preview" aria-selected="false">${icon('eye', 16)} Preview</button>
  </div>
  <div class="split" data-pane="wizard">
    <div class="pane-wizard">
      <div id="stage" tabindex="-1"></div>
    </div>
    <aside class="pane-preview" aria-label="Live preparation note">
      <div class="preview-bar">
        <span class="pv-label"><span class="live" aria-hidden="true"></span> Live preview</span>
        <div class="menu-wrap">
          <button type="button" class="btn btn-sm" id="export-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="export-menu">
            ${icon('download', 14)} Export ${icon('chevron-down', 12)}
          </button>
          <div class="menu" id="export-menu" role="menu" hidden>
            <button type="button" role="menuitem" data-export="copy">${icon('copy', 16)} Copy to clipboard</button>
            <button type="button" role="menuitem" data-export="print">${icon('printer', 16)} Print</button>
            <button type="button" role="menuitem" data-export="txt">${icon('file-text', 16)} Download .txt</button>
          </div>
        </div>
      </div>
      <div class="paper" id="note"></div>
    </aside>
  </div>`;

export async function mount(root, route) {
  const wiz = new Wizard({ getTemplate: store.getTemplate, getDefault: store.getDefaultTemplate });

  let opened = false;
  if (route.id) opened = await wiz.open(route.id);
  if (!opened) {
    wiz.newPrep();
    history.replaceState(null, '', '#/prep/' + wiz.prep.id);
    if (route.id) toast('That preparation could not be found, so a new one was started.', 'info', 5000);
  }

  const wrap = document.createElement('div');
  wrap.innerHTML = shell();
  root.replaceChildren(wrap);
  const $w = (sel) => wrap.querySelector(sel);

  let errorToasted = false;
  let focusMode = false;

  /* ---------------- HTML builders ---------------- */

  function railHtml() {
    const p = wiz.prep;
    const qs = wiz.questions;
    const onReview = wiz.stage === 'review';
    const segs = qs
      .map((x, i) => {
        const cur = !onReview && i === p.step;
        const cls = cur ? 'is-current' : wiz.isAnswered(x.id) ? 'is-done' : '';
        const state = wiz.isAnswered(x.id) ? 'answered' : 'not answered yet';
        return `<button type="button" class="rp-seg ${cls}" data-step="${i}" ${cur ? 'aria-current="step"' : ''}
          title="${esc(x.step)}" aria-label="Question ${i + 1}: ${esc(x.step)} (${state})"></button>`;
      })
      .join('');
    const review = `<button type="button" class="rp-seg is-review ${onReview ? 'is-current' : ''}" data-stage="review"
      ${onReview ? 'aria-current="step"' : ''} title="Review &amp; export" aria-label="Review and export"></button>`;
    return `<div class="rail-progress">
      <div class="rp-top">
        <span class="rp-type"><strong>${esc(p.template.name)}</strong>
          <span class="rp-change-wrap"><button type="button" class="link-btn" data-stage="type">Change</button></span></span>
        <span class="rp-right">
          <span class="progress-label" id="progress-label" aria-live="polite"></span>
          <button type="button" class="btn btn-ghost btn-sm" id="focus-btn" aria-pressed="false"></button>
        </span>
      </div>
      <div class="rp-segs" role="group" aria-label="Progress">${segs}${review}</div>
    </div>`;
  }

  function actionsHtml() {
    const p = wiz.prep;
    const st = wiz.stage;
    const back = `<button type="button" class="btn btn-ghost" id="btn-back" ${st === 'type' ? 'disabled' : ''}>${icon('arrow-left', 16)} Back</button>`;
    const save = `<button type="button" class="btn btn-ghost" id="btn-save" aria-label="Save" ${p.typeId ? '' : 'disabled'}>${icon('save', 16)} <span class="lbl">Save</span></button>`;
    let primary;
    if (st === 'type') {
      primary = `<button type="button" class="btn btn-primary" id="btn-next" ${p.typeId ? '' : 'disabled'}>Continue ${icon('arrow-right', 16)}</button>`;
    } else if (st === 'questions') {
      const nxt = wiz.questions[p.step + 1];
      primary = `<button type="button" class="btn btn-primary" id="btn-next">Next: ${esc(nxt ? nxt.step : 'Review')} ${icon('arrow-right', 16)}</button>`;
    } else if (p.completed) {
      primary = `<a class="btn btn-primary" href="#/preps">${icon('check', 16)} Done</a>`;
    } else {
      primary = `<button type="button" class="btn btn-primary" id="btn-finish">${icon('check', 16)} Finish</button>`;
    }
    return `<div class="wiz-actions">${back}<div class="wa-right"><span class="save-state" id="save-state" role="status" aria-live="polite"></span>${save}${primary}</div></div>`;
  }

  function typeStageHtml() {
    const p = wiz.prep;
    const list = store.listTemplates().slice();
    if (p.template && !list.some((t) => t.id === p.typeId)) list.push(p.template); // type since deleted
    const cards = list
      .map((t) => {
        const sel = t.id === p.typeId;
        return `<label class="type-card${sel ? ' is-selected' : ''}" style="--accent-type:${esc(t.accent)}">
          <input class="sr-only" type="radio" name="mtype" value="${esc(t.id)}" ${sel ? 'checked' : ''}>
          <span class="type-ico">${icon(t.icon, 22)}</span>
          <span class="type-name">${esc(t.name)}</span>
          <span class="type-tag">${esc(t.tagline)}</span>
        </label>`;
      })
      .join('');
    return `<section class="q-section" aria-labelledby="t-heading">
        <p class="eyebrow">New preparation</p>
        <h1 class="q-title" id="t-heading">What kind of meeting is it?</h1>
        <p class="q-desc">Pick a type to get a tailored set of questions. You can change it later without losing your answers.</p>
        <div class="type-grid" role="radiogroup" aria-label="Meeting type">${cards}</div>
      </section>${actionsHtml()}`;
  }

  function questionsStageHtml() {
    const cur = wiz.currentQuestion;
    const hasPrompts = cur.prompts.length > 0;
    const ideas =
      hasPrompts || cur.example
        ? `<details class="ideas"><summary>${icon('lightbulb', 16)} Need ideas?</summary>
            <div class="ideas-body">
              ${hasPrompts ? `<ul>${cur.prompts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
              ${cur.example ? `<p class="example"><strong>Example:</strong> ${esc(cur.example)}</p>` : ''}
            </div></details>`
        : '';
    const placeholder = cur.example ? `e.g. ${cur.example}` : cur.placeholder;
    return `${railHtml()}
      <section class="q-section" aria-labelledby="q-heading">
        <p class="eyebrow">${esc(cur.step)}</p>
        <h1 class="q-title" id="q-heading">${esc(cur.label)}</h1>
        <p class="q-desc" id="q-desc">${esc(cur.description)}</p>
        <label class="sr-only" for="answer">${esc(cur.label)}</label>
        <textarea id="answer" data-qid="${esc(cur.id)}" rows="6" maxlength="${cur.maxLength}"
          placeholder="${esc(placeholder)}" aria-describedby="q-desc"></textarea>
        <div class="q-foot">
          <span class="kbd-hint"><kbd>Ctrl</kbd>/<kbd>&#8984;</kbd> + <kbd>Enter</kbd> for next</span>
          <span class="q-count"></span>
        </div>
        ${ideas}
      </section>${actionsHtml()}
      <p class="fine"><button type="button" class="link-btn" id="use-default">Restore default questions</button></p>`;
  }

  function noticeHtml() {
    const empty = wiz.emptyCount();
    const total = wiz.questions.length;
    if (wiz.prep.completed) {
      return `<div class="notice notice-ok">${icon('circle-check', 18)}<span>This preparation is complete. You can still edit it &ndash; changes save automatically.</span></div>`;
    }
    if (empty) {
      return `<div class="notice notice-warn">${icon('alert-triangle', 18)}<span>${empty} of ${total} sections ${empty === 1 ? 'is' : 'are'} still empty. You can finish anyway or fill them in below.</span></div>`;
    }
    return `<div class="notice notice-info">${icon('info', 18)}<span>All sections are answered. Check the wording, then choose Finish.</span></div>`;
  }

  function reviewStageHtml() {
    const items = wiz.questions
      .map(
        (x, i) => `<div class="review-item">
          <div class="ri-head">
            <label for="r-${i}"><span class="ri-num">${i + 1}.</span>${esc(x.noteHeading)}</label>
            <button type="button" class="link-btn" data-step="${i}">Show question</button>
          </div>
          <textarea id="r-${i}" data-qid="${esc(x.id)}" rows="3" maxlength="${x.maxLength}" placeholder="${esc(x.placeholder)}"></textarea>
          <div class="q-count"></div>
        </div>`,
      )
      .join('');
    return `${railHtml()}
      <section class="q-section" aria-labelledby="r-heading">
        <p class="eyebrow">Review &amp; export</p>
        <h1 class="q-title" id="r-heading">Review your answers</h1>
        <p class="q-desc">Edit anything here &ndash; the note updates as you type.</p>
        <div id="review-notice">${noticeHtml()}</div>
        <div class="review-list">${items}</div>
        <div class="export-row">
          <button type="button" class="btn" data-export="copy">${icon('copy', 16)} Copy</button>
          <button type="button" class="btn" data-export="print">${icon('printer', 16)} Print</button>
          <button type="button" class="btn" data-export="txt">${icon('download', 16)} Download .txt</button>
        </div>
      </section>${actionsHtml()}`;
  }

  /* ---------------- rendering ---------------- */

  function autosize(ta) {
    if (!ta || !ta.offsetParent) return;
    ta.style.height = 'auto';
    const max = ta.id === 'answer' ? 560 : 420;
    ta.style.height = `${Math.min(ta.scrollHeight + 2, max)}px`;
  }

  function fillTextareas() {
    $$('textarea[data-qid]', wrap).forEach((ta) => {
      ta.value = wiz.prep.answers[ta.dataset.qid] ?? '';
      autosize(ta);
    });
  }

  function refreshCounts() {
    $$('textarea[data-qid]', wrap).forEach((ta) => {
      const c = ta.parentElement.querySelector('.q-count') || ta.nextElementSibling?.querySelector?.('.q-count');
      if (!c) return;
      const max = Number(ta.getAttribute('maxlength')) || 0;
      c.textContent = `${ta.value.length} / ${max}`;
      c.classList.toggle('is-near', max > 0 && ta.value.length >= max * 0.9);
    });
  }

  function syncFocus() {
    const b = $w('#focus-btn');
    if (!b) return;
    b.innerHTML = focusMode ? `${icon('minimize', 14)} Exit focus` : `${icon('maximize', 14)} Focus`;
    b.setAttribute('aria-pressed', String(focusMode));
    b.title = focusMode ? 'Show the sidebar and preview again (Esc)' : 'Hide everything except the question';
  }

  function refreshProgress() {
    const total = wiz.questions.length;
    const label = $w('#progress-label');
    if (label) label.textContent = wiz.stage === 'review' ? 'Review' : `${wiz.prep.step + 1} of ${total}`;
    $$('.rp-seg[data-step]', wrap).forEach((b, i) => {
      const x = wiz.questions[i];
      if (!x) return;
      const cur = wiz.stage === 'questions' && i === wiz.prep.step;
      b.classList.toggle('is-current', cur);
      b.classList.toggle('is-done', !cur && wiz.isAnswered(x.id));
      b.setAttribute('aria-label', `Question ${i + 1}: ${x.step} (${wiz.isAnswered(x.id) ? 'answered' : 'not answered yet'})`);
    });
    const n = $w('#review-notice');
    if (n) n.innerHTML = noticeHtml();
  }

  function renderPreview() {
    const p = wiz.prep;
    const exp = $w('#export-btn');
    const el = $w('#note');
    if (!p.template) {
      exp.disabled = true;
      el.innerHTML = `<div class="note-empty">${icon('file-text', 32)}<p><strong>Your note will appear here</strong></p><p>Choose a meeting type to begin.</p></div>`;
      return;
    }
    exp.disabled = false;
    const note = buildNote(p.template, p, store.noteOptions());
    const meta = [note.meetingDate ? fmtDay(note.meetingDate) : '', note.preparedBy ? `Prepared by ${note.preparedBy}` : '']
      .filter(Boolean)
      .map(esc)
      .join(' &middot; ');
    const activeIdx = wiz.stage === 'questions' ? p.step : -1;
    el.innerHTML = `
      <header class="paper-head">
        <p class="paper-kicker">${esc(note.typeName)}</p>
        <h2 class="paper-title">${esc(note.title)}</h2>
        ${meta ? `<p class="paper-meta">${meta}</p>` : ''}
        <button type="button" class="link-btn" id="edit-meta">Edit title &amp; date</button>
      </header>
      <ol class="note-sections">${note.sections
        .map((s) => {
          const idx = s.index - 1;
          return `<li><button type="button" class="p-sec${idx === activeIdx ? ' is-active' : ''}" data-step="${idx}"
            ${idx === activeIdx ? 'aria-current="true"' : ''} aria-label="Edit section ${s.index}: ${esc(s.heading)}">
            <span class="p-head"><span class="n">${s.index}.</span>${esc(s.heading)}</span>
            <span class="p-text${s.empty ? ' is-empty' : ''}">${s.empty ? 'Your notes will appear here…' : esc(s.text)}</span>
          </button></li>`;
        })
        .join('')}</ol>`;
  }

  /** Keep the highlighted section visible inside the (scrollable) desktop preview pane. */
  function revealActiveSection() {
    const pane = $w('.pane-preview');
    const el = $w('.p-sec.is-active');
    if (!pane || !el || pane.scrollHeight <= pane.clientHeight) return;
    const top = el.offsetTop - 12;
    const bottom = el.offsetTop + el.offsetHeight + 12;
    if (top < pane.scrollTop) pane.scrollTop = Math.max(0, top - 48);
    else if (bottom > pane.scrollTop + pane.clientHeight) pane.scrollTop = bottom - pane.clientHeight;
  }

  function updateSaveState() {
    const el = $w('#save-state');
    if (!el) return;
    const p = wiz.prep;
    let text = '';
    let cls = '';
    if (!p.typeId) {
      text = '';
    } else if (!isPersistent()) {
      text = 'Browser storage unavailable – not saved';
      cls = 'is-error';
    } else if (wiz.saveState === 'dirty') {
      text = 'Unsaved changes…';
    } else if (wiz.saveState === 'saving') {
      text = 'Saving…';
    } else if (wiz.saveState === 'saved') {
      text = `Saved at ${fmtTime(wiz.lastSavedAt)}`;
      cls = 'is-ok';
    } else if (wiz.saveState === 'error') {
      text = 'Could not save – try Save again';
      cls = 'is-error';
    } else if (wiz.persisted) {
      text = 'All changes saved';
      cls = 'is-ok';
    }
    el.textContent = text;
    el.className = `save-state ${cls}`.trim();
  }

  function renderAll() {
    $w('#stage').innerHTML =
      wiz.stage === 'type' ? typeStageHtml() : wiz.stage === 'questions' ? questionsStageHtml() : reviewStageHtml();
    fillTextareas();
    refreshCounts();
    refreshProgress();
    syncFocus();
    renderPreview();
    revealActiveSection();
    updateSaveState();
  }

  /** Radio change on the type step: update in place so keyboard focus is not lost. */
  function refreshTypeSelection() {
    $$('.type-card', wrap).forEach((c) => c.classList.toggle('is-selected', c.querySelector('input').checked));
    const next = $w('#btn-next');
    if (next) next.disabled = !wiz.prep.typeId;
    const save = $w('#btn-save');
    if (save) save.disabled = !wiz.prep.typeId;
    renderPreview();
    updateSaveState();
  }

  function navigated() {
    root.closest('.main')?.scrollTo({ top: 0 });
    const ta = $w('#answer');
    const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    if (ta && !coarse) ta.focus({ preventScroll: true });
    else $w('#stage').focus({ preventScroll: true });
  }

  function setPane(name) {
    $w('.split').dataset.pane = name;
    $$('.tab', wrap).forEach((t) => t.setAttribute('aria-selected', String(t.dataset.pane === name)));
    if (name === 'wizard') $$('textarea[data-qid]', wrap).forEach(autosize);
  }

  function setMenu(open) {
    const menu = $w('#export-menu');
    menu.hidden = !open;
    $w('#export-btn').setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('button')?.focus();
  }

  function setFocusMode(on) {
    focusMode = on;
    document.body.classList.toggle('focus', on);
    syncFocus();
    $$('textarea[data-qid]', wrap).forEach(autosize);
  }

  /* ---------------- actions ---------------- */

  async function runExport(kind) {
    setMenu(false);
    if (!wiz.prep.template) return;
    const note = buildNote(wiz.prep.template, wiz.prep, store.noteOptions());
    if (kind === 'copy') await copyNote(note);
    else if (kind === 'print') printNote(note);
    else await downloadNote(note);
  }

  async function manualSave() {
    if (!wiz.prep.typeId) return;
    const ok = await wiz.save();
    if (ok && isPersistent()) toast('Saved.', 'success', 1800);
    else if (!isPersistent()) toast('Browser storage is unavailable, so nothing could be saved. Use Export to keep your note.', 'error', 6000);
  }

  async function onFinish() {
    const empty = wiz.emptyCount();
    if (empty) {
      const ok = await confirmDialog({
        title: 'Finish with empty sections?',
        message: `${empty} of ${wiz.questions.length} sections have no answer yet. You can still finish and come back to fill them in later.`,
        confirmText: 'Finish anyway',
        cancelText: 'Keep editing',
      });
      if (!ok) return;
    }
    const saved = await wiz.finish();
    toast(saved ? 'Preparation marked as complete.' : 'Marked complete, but it could not be saved.', saved ? 'success' : 'error');
    navigated();
  }

  async function editMeta() {
    const p = wiz.prep;
    const { value, dialog } = await openDialog(`
      <form method="dialog" class="dialog-form">
        <h2 id="dialog-title">Preparation details</h2>
        <div class="field"><label for="md-title">Title</label>
          <input id="md-title" type="text" maxlength="120" value="${esc(p.title)}">
          <p class="hint">Shown in My Preparations and at the top of exports. Leave empty to use the automatic title.</p></div>
        <div class="field"><label for="md-date">Meeting date <span class="optional">(optional)</span></label>
          <input id="md-date" type="date" value="${esc(p.meetingDate)}"></div>
        <div class="dialog-actions">
          <button class="btn" value="cancel" formnovalidate>Cancel</button>
          <button class="btn btn-primary" value="ok">Save</button>
        </div>
      </form>`);
    if (value !== 'ok') return;
    wiz.setMeta({
      title: dialog.querySelector('#md-title').value,
      meetingDate: dialog.querySelector('#md-date').value,
    });
  }

  /* ---------------- events ---------------- */

  wrap.addEventListener('click', async (e) => {
    const el = e.target.closest(
      '[data-pane],[data-stage],[data-step],[data-export],#btn-next,#btn-back,#btn-save,#btn-finish,#use-default,#edit-meta,#export-btn,#focus-btn',
    );
    if (!el) return;
    if (el.dataset.pane) return setPane(el.dataset.pane);
    if (el.id === 'export-btn') return setMenu($w('#export-menu').hidden);
    if (el.id === 'focus-btn') return setFocusMode(!focusMode);
    if (el.dataset.export) return runExport(el.dataset.export);
    if (el.dataset.stage) {
      if (wiz.go(el.dataset.stage)) navigated();
      return;
    }
    if (el.dataset.step !== undefined) {
      wiz.go('questions', Number(el.dataset.step));
      setPane('wizard');
      navigated();
      return;
    }
    switch (el.id) {
      case 'btn-next': if (wiz.next()) navigated(); break;
      case 'btn-back': if (wiz.back()) navigated(); break;
      case 'btn-save': await manualSave(); break;
      case 'btn-finish': await onFinish(); break;
      case 'edit-meta': await editMeta(); break;
      case 'use-default': {
        const r = wiz.useDefaultTemplate();
        if (r === 'none') toast('Custom meeting types have no built-in default template.', 'info');
        else if (r === 'same') toast('You are already using the default questions.', 'info');
        else toast('Default questions restored. Your answers were kept.', 'success');
        break;
      }
      default:
    }
  });

  wrap.addEventListener('change', (e) => {
    if (e.target.matches('input[name="mtype"]')) wiz.selectType(e.target.value);
  });

  wrap.addEventListener('input', (e) => {
    if (e.target.matches('textarea[data-qid]')) {
      autosize(e.target);
      wiz.setAnswer(e.target.dataset.qid, e.target.value);
    }
  });

  wrap.addEventListener('keydown', (e) => {
    const menu = $w('#export-menu');
    if (!menu.hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMenu(false);
        $w('#export-btn').focus();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = $$('button', menu);
        const i = items.indexOf(document.activeElement);
        const n = items.length;
        items[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n].focus();
      }
      return;
    }
    if (e.key === 'Escape' && focusMode && !document.querySelector('dialog[open]')) {
      setFocusMode(false);
      return;
    }
    // Ctrl/Cmd + Enter: continue to the next step without leaving the keyboard.
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && wiz.stage !== 'review') {
      if (wiz.stage === 'type' && !wiz.prep.typeId) return;
      e.preventDefault();
      if (wiz.next()) navigated();
    }
  });

  const onDocClick = (e) => {
    if (!e.target.closest('.menu-wrap')) {
      const menu = $w('#export-menu');
      if (menu && !menu.hidden) setMenu(false);
    }
  };
  const onDocKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      manualSave();
    }
  };
  const flush = () => { if (wiz.hasPendingSave()) wiz.save(); };
  const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onDocKey);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', flush);

  const unsubscribe = wiz.subscribe((type) => {
    switch (type) {
      case 'type':
        if (wiz.stage === 'type') refreshTypeSelection();
        else renderAll();
        break;
      case 'stage':
        renderAll();
        break;
      case 'meta':
        renderPreview();
        break;
      case 'answer':
        renderPreview();
        refreshCounts();
        refreshProgress();
        break;
      case 'save':
        updateSaveState();
        if (wiz.saveState === 'error' && !errorToasted) {
          errorToasted = true;
          toast('Could not save your changes. Check your browser storage settings, then try Save again.', 'error', 7000);
        } else if (wiz.saveState === 'saved') {
          errorToasted = false;
        }
        break;
      default:
    }
  });

  renderAll();

  return {
    name: 'prep',
    async unmount() {
      unsubscribe();
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onDocKey);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      document.body.classList.remove('focus');
      if (wiz.hasPendingSave()) await wiz.save();
      else await wiz.queue;
    },
  };
}

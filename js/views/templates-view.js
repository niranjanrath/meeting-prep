/* Templates: list built-in/custom meeting types and edit their questions. Saved to IndexedDB. */
import { icon, PICKABLE_ICONS } from '../icons.js';
import { esc, clone, $$ } from '../util.js';
import * as store from '../store.js';
import { blankQuestion, blankTemplate, validateTemplate } from '../templates.js';
import { toast, confirmDialog } from '../ui.js';

const ICON_CHOICES = Array.from(
  new Set([...PICKABLE_ICONS, 'file-text', 'circle-check', 'help-circle', 'list-checks', 'layers', 'alert-triangle', 'clock']),
);

export async function mount(root, route) {
  const wrap = document.createElement('div');
  root.replaceChildren(wrap);
  if (route.id) return mountEditor(wrap, route.id);
  return mountList(wrap);
}

/* ---------------------------- list ---------------------------- */

function mountList(wrap) {
  function render() {
    wrap.innerHTML = `
      <div class="page-head">
        <div><h1>Templates</h1>
          <p class="muted">Meeting types and their preparation questions. Edit a template or add your own. Existing preparations keep the template they were started with.</p></div>
        <a class="btn btn-primary" href="#/templates/new">${icon('plus', 16)} New meeting type</a>
      </div>
      <ul class="tpl-list">${store
        .listTemplates()
        .map((t) => {
          const edited = store.isCustomized(t.id);
          return `<li class="tpl-item">
            <span class="tile">${icon(t.icon, 26)}</span>
            <div class="ti-main">
              <h3>${esc(t.name)}${edited ? ' <span class="badge">Edited</span>' : ''}${t.custom ? ' <span class="badge">Custom</span>' : ''}</h3>
              <p class="muted">${esc(t.description || t.tagline)}</p>
              <p class="ti-meta">${t.questions.length} questions: ${t.questions.map((x) => esc(x.step)).join(' &middot; ')}</p>
            </div>
            <div class="ti-actions">
              <a class="btn btn-sm" href="#/templates/${esc(t.id)}">${icon('pencil', 14)} Edit</a>
              ${edited ? `<button type="button" class="btn btn-sm" data-act="reset" data-id="${esc(t.id)}">${icon('refresh', 14)} Reset to default</button>` : ''}
              ${t.custom ? `<button type="button" class="btn btn-sm btn-danger-outline" data-act="delete" data-id="${esc(t.id)}">${icon('trash', 14)} Delete</button>` : ''}
            </div>
          </li>`;
        })
        .join('')}</ul>`;
  }

  wrap.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.dataset.id;
    const t = store.getTemplate(id);
    if (!t) return;
    try {
      if (btn.dataset.act === 'reset') {
        const ok = await confirmDialog({
          title: 'Reset to the default template?',
          message: `Your changes to “${t.name}” will be discarded. Saved preparations are not affected.`,
          confirmText: 'Reset',
        });
        if (!ok) return;
        await store.resetTemplate(id);
        toast('Template reset to default.', 'success');
      } else if (btn.dataset.act === 'delete') {
        const ok = await confirmDialog({
          title: 'Delete this meeting type?',
          message: `“${t.name}” will be removed. Preparations already created with it keep working.`,
          confirmText: 'Delete',
          danger: true,
        });
        if (!ok) return;
        await store.deleteCustomTemplate(id);
        toast('Meeting type deleted.', 'success');
      }
      render();
    } catch (err) {
      console.error(err);
      toast('That change could not be saved.', 'error');
    }
  });

  render();
  return { name: 'templates' };
}

/* ---------------------------- editor ---------------------------- */

function mountEditor(wrap, id) {
  const isNew = id === 'new';
  const source = isNew ? blankTemplate() : store.getTemplate(id);
  if (!source) {
    wrap.innerHTML = `<div class="empty"><h2>Template not found</h2><p class="muted">It may have been deleted.</p>
      <a class="btn" href="#/templates">Back to templates</a></div>`;
    return { name: 'templates' };
  }
  const draft = clone(source);
  const openIds = new Set(isNew ? [draft.questions[0].id] : []);

  const field = (label, html, cls = '') => `<div class="field ${cls}">${label}${html}</div>`;
  const iconSelect = (cur, attrs) =>
    `<select ${attrs}>${ICON_CHOICES.map((n) => `<option value="${n}" ${n === cur ? 'selected' : ''}>${n}</option>`).join('')}</select>`;

  function questionHtml(x, i) {
    const n = draft.questions.length;
    const f = (key, label, extra = '', cls = '') =>
      field(
        `<label for="q${i}-${key}">${label}</label>`,
        `<input id="q${i}-${key}" type="text" data-q="${i}" data-f="${key}" value="${esc(x[key])}" ${extra}>`,
        cls,
      );
    return `<li class="qe"><details data-qid="${esc(x.id)}" ${openIds.has(x.id) ? 'open' : ''}>
      <summary><span class="qe-num">${i + 1}</span><span class="qe-title">${esc(x.noteHeading || x.label)}</span></summary>
      <div class="form-grid">
        ${f('step', 'Step name')}${f('stepHint', 'Step hint')}
        ${f('label', 'Question label')}${f('noteHeading', 'Heading in the note')}
        ${f('description', 'Description', '', 'span2')}
        ${f('placeholder', 'Placeholder', '', 'span2')}
        ${field(`<label for="q${i}-prompts">Helpful prompts <span class="optional">(one per line)</span></label>`,
          `<textarea id="q${i}-prompts" rows="4" data-q="${i}" data-f="prompts">${esc(x.prompts.join('\n'))}</textarea>`, 'span2')}
        ${f('example', 'Example answer', '', 'span2')}
        ${field(`<label for="q${i}-icon">Icon</label>`, iconSelect(x.icon, `id="q${i}-icon" data-q="${i}" data-f="icon"`))}
        ${field(`<label for="q${i}-max">Maximum length</label>`,
          `<input id="q${i}-max" type="number" min="50" max="20000" step="50" data-q="${i}" data-f="maxLength" value="${esc(x.maxLength)}">`)}
      </div>
      <div class="qe-actions">
        <button type="button" class="btn btn-sm" data-qa="up" data-q="${i}" ${i === 0 ? 'disabled' : ''}>${icon('arrow-up', 14)} Move up</button>
        <button type="button" class="btn btn-sm" data-qa="down" data-q="${i}" ${i === n - 1 ? 'disabled' : ''}>${icon('arrow-down', 14)} Move down</button>
        <button type="button" class="btn btn-sm btn-danger-outline" data-qa="remove" data-q="${i}" ${n === 1 ? 'disabled' : ''}>${icon('trash', 14)} Remove</button>
      </div>
    </details></li>`;
  }

  function render() {
    const canReset = !isNew && store.isCustomized(id);
    wrap.innerHTML = `
      <form id="tpl-form" novalidate>
        <div class="page-head"><div>
          <h1>${isNew ? 'New meeting type' : `Edit &ldquo;${esc(source.name)}&rdquo;`}</h1>
          <p class="muted">Changes apply to new preparations. Saved ones keep their own copy.</p></div></div>
        <div id="form-errors" class="notice notice-error" role="alert" tabindex="-1" hidden></div>
        <section class="card">
          <h2 class="card-title">Meeting type</h2>
          <div class="form-grid">
            ${field('<label for="t-name">Name</label>', `<input id="t-name" type="text" data-f="name" maxlength="60" value="${esc(draft.name)}">`)}
            ${field('<label for="t-full">Full name <span class="optional">(used in the note title)</span></label>', `<input id="t-full" type="text" data-f="fullName" maxlength="80" value="${esc(draft.fullName)}">`)}
            ${field('<label for="t-tag">Card summary</label>', `<input id="t-tag" type="text" data-f="tagline" maxlength="80" value="${esc(draft.tagline)}">`, 'span2')}
            ${field('<label for="t-desc">Description</label>', `<textarea id="t-desc" rows="2" data-f="description">${esc(draft.description)}</textarea>`, 'span2')}
            ${field('<label for="t-icon">Icon</label>', iconSelect(draft.icon, 'id="t-icon" data-f="icon"'))}
          </div>
        </section>
        <section class="card">
          <div class="card-head"><h2 class="card-title">Questions</h2>
            <button type="button" class="btn btn-sm" id="add-q">${icon('plus', 14)} Add question</button></div>
          <p class="muted">Each question becomes one wizard step and one section of the note, in this order.</p>
          <ol class="qe-list">${draft.questions.map(questionHtml).join('')}</ol>
        </section>
        <div class="wiz-actions">
          <a class="btn" href="#/templates">Cancel</a>
          <span class="save-state"></span>
          ${canReset ? `<button type="button" class="btn" id="reset-tpl">${icon('refresh', 16)} Reset to default</button>` : ''}
          <button type="submit" class="btn btn-primary">${icon('save', 16)} Save template</button>
        </div>
      </form>`;
  }

  function showErrors(list) {
    const box = wrap.querySelector('#form-errors');
    box.innerHTML = `${icon('alert-triangle', 18)}<span><strong>Please fix this before saving:</strong><br>${list.map(esc).join('<br>')}</span>`;
    box.hidden = false;
    box.focus();
  }

  wrap.addEventListener('input', (e) => {
    const key = e.target.dataset.f;
    if (!key) return;
    let value = e.target.value;
    if (e.target.dataset.q !== undefined) {
      const q = draft.questions[Number(e.target.dataset.q)];
      if (!q) return;
      if (key === 'prompts') value = value.split('\n');
      else if (key === 'maxLength') value = Number(value) || 1000;
      q[key] = value;
      if (key === 'noteHeading' || key === 'label') {
        const title = e.target.closest('li').querySelector('.qe-title');
        if (title) title.textContent = q.noteHeading || q.label;
      }
    } else {
      draft[key] = value;
    }
  });

  wrap.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!d.matches || !d.matches('details[data-qid]')) return;
    if (d.open) openIds.add(d.dataset.qid);
    else openIds.delete(d.dataset.qid);
  }, true);

  wrap.addEventListener('click', async (e) => {
    if (e.target.closest('#add-q')) {
      const x = blankQuestion();
      draft.questions.push(x);
      openIds.add(x.id);
      render();
      wrap.querySelector(`details[data-qid="${x.id}"]`)?.scrollIntoView({ block: 'center' });
      return;
    }
    const qa = e.target.closest('[data-qa]');
    if (qa) {
      const i = Number(qa.dataset.q);
      const list = draft.questions;
      if (qa.dataset.qa === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      else if (qa.dataset.qa === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      else if (qa.dataset.qa === 'remove' && list.length > 1) list.splice(i, 1);
      render();
      return;
    }
    if (e.target.closest('#reset-tpl')) {
      const ok = await confirmDialog({
        title: 'Reset to the default template?',
        message: 'Your changes to this template will be discarded.',
        confirmText: 'Reset',
      });
      if (!ok) return;
      try {
        await store.resetTemplate(id);
        toast('Template reset to default.', 'success');
        location.hash = '#/templates';
      } catch (err) {
        console.error(err);
        toast('Could not reset the template.', 'error');
      }
    }
  });

  wrap.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = validateTemplate(draft);
    if (errors.length) return showErrors(errors);
    try {
      await store.saveTemplate(draft);
      toast('Template saved.', 'success');
      location.hash = '#/templates';
    } catch (err) {
      console.error(err);
      showErrors(['The template could not be saved. Check your browser storage settings and try again.']);
    }
  });

  render();
  return { name: 'templates' };
}

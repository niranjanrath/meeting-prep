/*
 * Wizard logic (no DOM). Owns the current preparation, navigation between stages/steps,
 * autosave and the "unfinished draft" pointer. Views subscribe to its events and render.
 *
 * Stages:  'type' (choose meeting type) -> 'questions' (one question at a time) -> 'review'
 *
 * A preparation keeps a snapshot of the template it was started with, so later template edits
 * never change or break saved notes. Answers are keyed by question id.
 */
import * as db from './db.js';
import { uid, clone, fmtDate } from './util.js';

export const STAGES = ['type', 'questions', 'review'];

export const defaultTitle = (template) => `${template.name} – ${fmtDate(Date.now())}`;

export function duplicatePrep(prep) {
  const now = Date.now();
  const copy = clone(prep);
  copy.id = uid();
  copy.title = `${prep.title} (copy)`;
  copy.titleCustom = true;
  copy.completed = false;
  copy.stage = 'questions';
  copy.step = 0;
  copy.createdAt = now;
  copy.updatedAt = now;
  return copy;
}

export class Wizard {
  constructor({ getTemplate, getDefault }) {
    this.getTemplate = getTemplate;
    this.getDefault = getDefault;
    this.listeners = new Set();
    this.prep = null;
    this.persisted = false;
    this.saveState = 'idle'; // idle | dirty | saving | saved | error
    this.lastSavedAt = 0;
    this.lastError = null;
    this.timer = null;
    this.queue = Promise.resolve(true);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, detail) {
    for (const fn of this.listeners) fn(type, detail);
  }

  /* ---------- lifecycle ---------- */

  newPrep() {
    const now = Date.now();
    this.prep = {
      id: uid(),
      typeId: null,
      title: '',
      titleCustom: false,
      meetingDate: '',
      answers: {},
      stage: 'type',
      step: 0,
      completed: false,
      template: null,
      createdAt: now,
      updatedAt: now,
    };
    this.persisted = false;
    this.saveState = 'idle';
  }

  /** Load a saved preparation. Returns false if it does not exist or is unusable. */
  async open(id) {
    let p;
    try {
      p = await db.getPrep(id);
    } catch (e) {
      console.error(e);
      return false;
    }
    if (!p || typeof p !== 'object' || !p.id) return false;
    p.answers = p.answers && typeof p.answers === 'object' ? p.answers : {};
    if (!p.template && p.typeId) p.template = clone(this.getTemplate(p.typeId));
    if (!p.template || !Array.isArray(p.template.questions) || !p.template.questions.length) {
      p.typeId = null;
      p.template = null;
      p.stage = 'type';
    }
    if (!STAGES.includes(p.stage) || (!p.typeId && p.stage !== 'type')) p.stage = p.typeId ? 'questions' : 'type';
    const max = (p.template?.questions.length || 1) - 1;
    p.step = Number.isInteger(p.step) ? Math.max(0, Math.min(p.step, max)) : 0;
    this.prep = p;
    this.persisted = true;
    this.saveState = 'idle';
    return true;
  }

  /* ---------- derived state ---------- */

  get stage() { return this.prep.stage; }
  get stageIndex() { return STAGES.indexOf(this.prep.stage); }
  get template() { return this.prep.template; }
  get questions() { return this.prep.template?.questions || []; }
  get currentQuestion() { return this.questions[this.prep.step] || null; }
  isAnswered(qid) { return String(this.prep.answers[qid] ?? '').trim().length > 0; }
  answeredCount() { return this.questions.filter((q) => this.isAnswered(q.id)).length; }
  emptyCount() { return this.questions.length - this.answeredCount(); }

  /* ---------- mutations ---------- */

  touch() { this.prep.updatedAt = Date.now(); }

  selectType(typeId) {
    const p = this.prep;
    if (p.typeId === typeId && p.template) return;
    const t = this.getTemplate(typeId);
    if (!t) return;
    p.typeId = typeId;
    p.template = clone(t);
    if (!p.titleCustom) p.title = defaultTitle(t);
    p.step = Math.min(p.step, t.questions.length - 1);
    this.touch();
    this.emit('type');
    this.save();
  }

  setAnswer(qid, value) {
    this.prep.answers[qid] = value;
    this.touch();
    this.emit('answer', { qid });
    this.scheduleSave();
  }

  setMeta({ title, meetingDate }) {
    const p = this.prep;
    if (title !== undefined) {
      const t = String(title).trim();
      if (t) {
        p.title = t;
        p.titleCustom = true;
      } else if (p.template) {
        p.title = defaultTitle(p.template);
        p.titleCustom = false;
      }
    }
    if (meetingDate !== undefined) p.meetingDate = meetingDate;
    this.touch();
    this.emit('meta');
    this.save();
  }

  go(stage, step = this.prep.step) {
    if (!STAGES.includes(stage)) return false;
    if (stage !== 'type' && !this.prep.typeId) return false;
    this.prep.stage = stage;
    this.prep.step = Math.max(0, Math.min(step, Math.max(0, this.questions.length - 1)));
    this.emit('stage');
    this.save();
    return true;
  }

  next() {
    const p = this.prep;
    if (p.stage === 'type') return this.go('questions', p.step);
    if (p.stage === 'questions') {
      return p.step < this.questions.length - 1 ? this.go('questions', p.step + 1) : this.go('review');
    }
    return false;
  }

  back() {
    const p = this.prep;
    if (p.stage === 'review') return this.go('questions', this.questions.length - 1);
    if (p.stage === 'questions') return p.step > 0 ? this.go('questions', p.step - 1) : this.go('type');
    return false;
  }

  /** Replace this preparation's template with the built-in default. Returns 'none' | 'same' | 'reset'. */
  useDefaultTemplate() {
    const p = this.prep;
    const def = p.typeId ? this.getDefault(p.typeId) : null;
    if (!def) return 'none';
    if (JSON.stringify(def) === JSON.stringify(p.template)) return 'same';
    p.template = def;
    p.step = Math.min(p.step, def.questions.length - 1);
    this.touch();
    this.emit('type');
    this.save();
    return 'reset';
  }

  async finish() {
    const p = this.prep;
    p.completed = true;
    p.stage = 'review';
    this.touch();
    this.emit('stage');
    const ok = await this.save();
    try {
      if ((await db.getMeta('currentPrepId')) === p.id) await db.setMeta('currentPrepId', null);
    } catch (e) {
      console.warn(e);
    }
    return ok;
  }

  /* ---------- persistence ---------- */

  scheduleSave(delay = 600) {
    if (!this.prep.typeId) return;
    clearTimeout(this.timer);
    this.saveState = 'dirty';
    this.emit('save');
    this.timer = setTimeout(() => this.save(), delay);
  }

  hasPendingSave() { return this.timer !== null; }

  /** Persist now (serialised so writes never overlap). Nothing is stored until a meeting type is chosen. */
  save() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.prep || !this.prep.typeId) return Promise.resolve(true);
    const snapshot = clone(this.prep);
    this.queue = this.queue.then(async () => {
      this.saveState = 'saving';
      this.emit('save');
      try {
        await db.savePrep(snapshot);
        if (!snapshot.completed) await db.setMeta('currentPrepId', snapshot.id);
        this.persisted = true;
        this.lastSavedAt = Date.now();
        this.lastError = null;
        this.saveState = 'saved';
        return true;
      } catch (err) {
        console.error('Save failed:', err);
        this.lastError = err;
        this.saveState = 'error';
        return false;
      } finally {
        this.emit('save');
      }
    });
    return this.queue;
  }
}

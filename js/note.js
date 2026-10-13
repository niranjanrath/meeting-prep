/* Preparation note generation. Pure functions: (template, prep) -> structured note -> text / HTML. */
import { esc, fmtDay, fmtDateTime, slug } from './util.js';

export function countAnswered(template, prep) {
  const qs = template?.questions || [];
  return qs.filter((q) => ((prep.answers || {})[q.id] || '').trim()).length;
}

/**
 * Build the structured note.
 * @param {object} template  the prep's template snapshot
 * @param {object} prep
 * @param {{omitEmpty?:boolean, preparedBy?:string}} opts
 */
export function buildNote(template, prep, { omitEmpty = false, preparedBy = '' } = {}) {
  const questions = template?.questions || [];
  let sections = questions.map((q) => {
    const text = String((prep.answers || {})[q.id] ?? '').trim();
    return { id: q.id, icon: q.icon, heading: q.noteHeading || q.label, text, empty: !text };
  });
  const answered = sections.filter((s) => !s.empty).length;
  if (omitEmpty) sections = sections.filter((s) => !s.empty);
  sections = sections.map((s, i) => ({ ...s, index: i + 1 }));
  const typeName = template?.fullName || template?.name || 'Meeting';
  return {
    title: prep.title || `${typeName} Preparation Note`,
    typeName,
    noteTitle: `${typeName} Preparation Note`,
    icon: template?.icon || 'file-text',
    accent: template?.accent || '#2563eb',
    meetingDate: prep.meetingDate || '',
    createdAt: prep.createdAt,
    updatedAt: prep.updatedAt,
    preparedBy,
    total: questions.length,
    answered,
    sections,
  };
}

export function noteToText(note) {
  const out = [];
  out.push(note.title, '='.repeat(Math.min(Math.max(note.title.length, 8), 72)));
  out.push(`Meeting type: ${note.typeName}`);
  if (note.meetingDate) out.push(`Meeting date: ${fmtDay(note.meetingDate)}`);
  if (note.preparedBy) out.push(`Prepared by: ${note.preparedBy}`);
  if (note.updatedAt) out.push(`Last updated: ${fmtDateTime(note.updatedAt)}`);
  out.push('');
  for (const s of note.sections) {
    const h = `${s.index}. ${s.heading}`;
    out.push(h, '-'.repeat(Math.min(h.length, 72)), s.empty ? '(Not answered yet)' : s.text, '');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

/** Markup for the print view (everything escaped; line breaks preserved by CSS). */
export function noteToHtml(note) {
  const meta = [note.typeName];
  if (note.meetingDate) meta.push(fmtDay(note.meetingDate));
  if (note.preparedBy) meta.push(`Prepared by ${note.preparedBy}`);
  return `<article class="print-note">
    <h1>${esc(note.title)}</h1>
    <p class="pn-meta">${meta.map(esc).join(' &middot; ')}</p>
    ${note.sections
      .map(
        (s) => `<section><h2>${s.index}. ${esc(s.heading)}</h2>
        <p class="${s.empty ? 'pn-empty' : ''}">${s.empty ? '(Not answered yet)' : esc(s.text)}</p></section>`,
      )
      .join('')}
  </article>`;
}

export function noteFilename(note) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${slug(note.title)}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.txt`;
}

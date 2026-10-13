/*
 * Meeting templates (data only).
 *
 * A template is a plain object:
 *   { id, name, fullName, tagline, description, icon, accent, questions: [...] }
 * and each question is:
 *   { id, step, stepHint, icon, label, noteHeading, description, placeholder, prompts[], example, maxLength }
 *
 * The wizard, preview and exports are generated entirely from this data, so adding a meeting type
 * or a question means editing this object (or using the Templates screen) - no wizard code changes.
 */
import { clone, uid } from './util.js';

const q = (id, step, stepHint, icon, heading, description, placeholder, prompts, example) => ({
  id, step, stepHint, icon,
  label: heading,
  noteHeading: heading,
  description, placeholder, prompts, example,
  maxLength: 1000,
});

export const DEFAULT_TEMPLATES = {
  stakeholder: {
    id: 'stakeholder',
    name: 'Stakeholder / Business',
    fullName: 'Stakeholder / Business Meeting',
    tagline: 'Business objectives, value, expectations',
    description: 'For meetings with sponsors, clients or business owners where value, expectations and alignment matter.',
    icon: 'handshake',
    accent: '#2563eb',
    questions: [
      q('purpose', 'Purpose', 'Why are we meeting?', 'target', 'Meeting Purpose',
        'Why is this meeting happening and what should we achieve?',
        'Enter the main purpose of this meeting...',
        ['What is the main topic?', 'Why is it important now?', 'What should we achieve by the end of the meeting?', 'What does success look like?'],
        'Align with the sponsor on scope and budget for phase 2 so hiring can start in November.'),
      q('context', 'Context', 'Background and status', 'file-text', 'Context and Current Status',
        'What does everyone need to know about where things stand?',
        'Summarise the background, current status and any recent decisions...',
        ['What has happened so far?', 'What is the current status or latest data?', 'Which decisions or commitments are already made?', 'What changed since the last conversation?'],
        'Phase 1 shipped on time, adoption is at 64%, and the budget review was postponed to this meeting.'),
      q('people', 'People', 'Who is involved?', 'users', 'Key Stakeholders and Their Concerns',
        'Who will be in the room and what does each of them care about?',
        'List attendees, their roles and what matters most to each of them...',
        ['Who has decision authority?', 'What does each stakeholder want or fear?', 'Who might disagree, and why?', 'Who is missing that should be here?'],
        'Finance cares about run-rate cost; Operations worries about training time; the sponsor wants a visible win by Q1.'),
      q('position', 'My Contribution', 'Your perspective', 'message-square', 'My Position or Recommendation',
        'What is your point of view and what are you asking for?',
        'State your position, the evidence behind it and what you need from the group...',
        ['What is my recommendation?', 'What evidence supports it?', 'What am I asking the group to approve or support?', 'What am I willing to compromise on?'],
        'Recommend funding phase 2 in two tranches, with the second released after an adoption review.'),
      q('questions', 'Key Questions', 'Risks and trade-offs', 'help-circle', 'Key Questions, Risks and Trade-offs',
        'What could be asked, and what could go wrong?',
        'Note the tough questions you expect, the main risks and the trade-offs...',
        ['What tough questions should I expect?', 'What are the main risks and their impact?', 'What trade-offs are involved (cost, time, scope, quality)?', 'What do I still not know?'],
        'Expect: "Why not wait for the new platform?" Risk: key vendor contract ends in March.'),
      q('outcome', 'Desired Outcome', 'Decision and next steps', 'circle-check', 'Desired Outcome and Next Steps',
        'What do you want to walk away with?',
        'Describe the decision or agreement you want and the follow-up actions...',
        ['What decision or agreement do I want?', 'Who owns which follow-up action?', 'What is the deadline for each next step?', 'How will we communicate the outcome?'],
        'Approval of tranche 1; I send a summary within 24 hours and book the review for February.'),
    ],
  },

  architecture: {
    id: 'architecture',
    name: 'Architecture / Technical',
    fullName: 'Technical Architecture Meeting',
    tagline: 'Requirements, options, trade-offs, risks',
    description: 'For design reviews and architecture discussions where options and trade-offs need to be weighed.',
    icon: 'cube',
    accent: '#475569',
    questions: [
      q('problem', 'Problem', 'What are we solving?', 'target', 'Problem and Goals',
        'What technical problem or decision is on the table, and why now?',
        'Describe the problem, its impact and what this session should settle...',
        ['What problem are we solving, and for whom?', 'What is the impact of not solving it?', 'What is in and out of scope?', 'What outcome do we need from this session?'],
        'Checkout latency doubled as the catalogue grew; we need an agreed caching direction before the Q1 release.'),
      q('requirements', 'Requirements', 'Needs and constraints', 'list-checks', 'Requirements and Constraints',
        'Which functional, quality and organisational constraints shape the solution?',
        'List key requirements, quality attributes (performance, security...), deadlines and constraints...',
        ['Which functional requirements matter most?', 'Which quality attributes are critical (scale, latency, security, availability)?', 'What constraints exist (budget, skills, existing systems, compliance)?', 'What assumptions are we making?'],
        'p95 under 300 ms at 2,000 requests/s; must run on the existing Kubernetes cluster; no new licensed products.'),
      q('options', 'Options', 'Candidate approaches', 'layers', 'Options Considered',
        'Which approaches are realistic, and how do they work at a high level?',
        'Describe two or three options with a short sketch of each...',
        ['What are the realistic alternatives (including doing nothing)?', 'How does each option work at a high level?', 'What has the team or others already tried?', 'Which diagrams or documents should I bring?'],
        'A) Cache in front of the catalogue API. B) Read replicas plus query tuning. C) Event-driven projection store.'),
      q('tradeoffs', 'Trade-offs', 'Pros, cons, risks', 'scale', 'Trade-offs and Risks',
        'What does each option cost, and what could go wrong?',
        'Compare the options: benefits, drawbacks, technical and delivery risks...',
        ['What are the main pros and cons of each option?', 'What are the technical and delivery risks?', 'What are the operational and maintenance costs?', 'What would be hard to reverse later?'],
        'Option A is quick to build but adds cache-invalidation complexity and a new failure mode.'),
      q('proposal', 'Proposal', 'Preferred direction', 'circle-check', 'Recommended Direction',
        'Which option do you favour, and why?',
        'State your preferred option, the reasoning and what would change your mind...',
        ['Which option do I recommend and why?', 'What evidence or prototype supports it?', 'What conditions would change my mind?', 'What would a first, low-risk step look like?'],
        'Recommend A with a short time-to-live and an explicit invalidation event; validate with a two-week spike.'),
      q('nextsteps', 'Next Steps', 'Decisions and actions', 'flag', 'Open Questions and Next Steps',
        'What is still unknown, and what happens after the meeting?',
        'List open questions, decisions to record and follow-up actions...',
        ['Which questions remain open and who can answer them?', 'Which decisions need to be recorded (for example as an ADR)?', 'Who does what by when?', 'Which stakeholders need to be informed?'],
        'Open: invalidation strategy (platform team). Write the ADR by Friday; schedule the spike for next sprint.'),
    ],
  },

  project: {
    id: 'project',
    name: 'Project / Status',
    fullName: 'Project Status Meeting',
    tagline: 'Progress, blockers, dependencies',
    description: 'For status updates and project check-ins: what is done, what is blocked and what you need.',
    icon: 'users',
    accent: '#0ea5e9',
    questions: [
      q('goal', 'Goal', 'Where are we heading?', 'target', 'Project Goal and Focus',
        'What is the project delivering and what is the focus of this update?',
        'Summarise the objective, scope and the focus for this meeting...',
        ['What is the objective and agreed scope?', 'What is the current phase or milestone?', 'What is the focus of this meeting?', 'Who is the audience for this update?'],
        'Migrate invoicing to the new platform by 30 November; today we cover cut-over readiness.'),
      q('progress', 'Progress', 'Done since last time', 'circle-check', 'Progress Since Last Update',
        'What has been completed and how does it compare with the plan?',
        'List what was completed and how time, budget and scope are tracking...',
        ['What was completed since the last meeting?', 'Which milestones were met or missed?', 'How do time, budget and scope compare with the plan?', 'What went particularly well?'],
        'Data migration scripts finished; 3 of 5 integrations tested; budget at 62% with 70% of the work done.'),
      q('blockers', 'Blockers', 'What is in the way?', 'alert-triangle', 'Blockers and Issues',
        'What is slowing the work down right now?',
        'Describe what is blocked, since when and what would unblock it...',
        ['What is blocked and since when?', 'Who or what can unblock it?', 'What is the impact on the schedule?', 'Is there a workaround?'],
        'Waiting five days for test credentials from the payment provider; blocks end-to-end testing.'),
      q('risks', 'Risks', 'Dependencies', 'git-branch', 'Risks and Dependencies',
        'What could affect delivery, and what do we depend on?',
        'List the main risks, owners, mitigations and external dependencies...',
        ['Which risks are most likely or most severe?', 'How are they mitigated and who owns them?', 'Which teams or vendors do we depend on?', 'What changed in the risk picture since last time?'],
        'Risk: a key engineer leaves in December (medium). Mitigation: pair on the cut-over scripts now.'),
      q('plan', 'Plan', 'Next milestones', 'calendar', 'Upcoming Work and Milestones',
        'What is planned for the next period?',
        'Outline the next milestones, dates and work in progress...',
        ['What are the next milestones and dates?', 'What will the team work on next?', 'Are any dates at risk?', 'What needs to be communicated to others?'],
        'Next two weeks: finish integrations 4 and 5; dress rehearsal on 2 November.'),
      q('asks', 'Asks', 'Help and decisions', 'message-square', 'Asks and Decisions Needed',
        'What do you need from the attendees?',
        'State the decisions, help or resources you need...',
        ['Which decisions do I need from this group?', 'What help, budget or people do I need?', 'What needs to be escalated?', 'What actions should we leave with?'],
        'Need a go/no-go on the 2 November rehearsal and one extra tester for a week.'),
    ],
  },

  decision: {
    id: 'decision',
    name: 'Decision Making',
    fullName: 'Decision-Making Meeting',
    tagline: 'Options, evidence, recommendation',
    description: 'For meetings that must end in a decision: criteria, options, evidence and a clear recommendation.',
    icon: 'scale',
    accent: '#d97706',
    questions: [
      q('decision', 'Decision', 'What must be decided?', 'help-circle', 'Decision to Be Made',
        'What exactly needs to be decided, and by when?',
        'State the decision as a question, who decides and the deadline...',
        ['What is the decision, stated as a question?', 'Who is the decision maker?', 'What is the deadline and why?', 'What happens if we do not decide?'],
        'Do we renew the current vendor contract or move to the in-house tool before 1 December?'),
      q('criteria', 'Criteria', 'How we will judge', 'list-checks', 'Decision Criteria',
        'Which criteria should the options be judged by?',
        'List the criteria, which are must-haves and how they are weighted...',
        ['What matters most (cost, risk, speed, quality, strategic fit)?', 'Which criteria are must-haves and which are nice-to-haves?', 'How should the criteria be weighted?', 'Which constraints or policies apply?'],
        'Must: GDPR compliant, live by Q1. Weighted: total cost 40%, effort 30%, user impact 30%.'),
      q('options', 'Options', 'Alternatives', 'layers', 'Options',
        'Which alternatives are on the table?',
        'List each option with a one-line description...',
        ['What are all realistic options, including doing nothing?', 'How does each option score against the criteria?', 'Which options were already ruled out, and why?', 'Is there a hybrid option?'],
        'Renew for 12 months; renew for 36 months at a discount; build in-house; switch to another vendor.'),
      q('evidence', 'Evidence', 'Facts and data', 'trending-up', 'Evidence and Data',
        'What facts, data and opinions support each choice?',
        'Summarise the data, research and expert or user input...',
        ['Which data or research supports each option?', 'What do users, customers or experts say?', 'What are the known unknowns?', 'How reliable is the evidence?'],
        'Usage is down 18% year on year; a pilot with vendor B cut handling time by 22% (40 cases).'),
      q('recommendation', 'Recommendation', 'Preferred choice', 'circle-check', 'Recommendation and Rationale',
        'Which option do you recommend and why?',
        'State your recommendation, why it beats the alternatives and the main risks...',
        ['Which option do I recommend?', 'Why is it better than the alternatives?', 'What are the main risks and how will we handle them?', 'What objections should I expect?'],
        'Renew for 12 months and pilot vendor B; revisit in Q3 with real numbers.'),
      q('actions', 'Next Steps', 'Owners and dates', 'flag', 'Decision Process and Next Steps',
        'How will the decision be made, recorded and communicated?',
        'Describe how you will decide, who must be informed and the follow-up actions...',
        ['How will we decide (consensus, vote, single owner)?', 'Who needs to be informed or consulted?', 'Who does what by when after the decision?', 'How will we check that the decision worked?'],
        'The owner decides in the meeting; I log it in the decision record and inform the wider team by Friday.'),
    ],
  },

  brainstorm: {
    id: 'brainstorm',
    name: 'Brainstorming',
    fullName: 'Brainstorming Session',
    tagline: 'Problem statement, ideas, success criteria',
    description: 'For creative sessions: frame the problem, set boundaries and plan how ideas become action.',
    icon: 'lightbulb',
    accent: '#ca8a04',
    questions: [
      q('problem', 'Problem', 'What are we solving?', 'target', 'Problem Statement',
        'What question or challenge should the group explore?',
        'Describe the problem or opportunity, ideally as a "How might we...?" question...',
        ['What is the problem or opportunity?', 'Who is affected and how?', 'Why does it matter now?', 'Can I phrase it as "How might we...?"'],
        'How might we cut onboarding time for new customers from 10 days to 3?'),
      q('success', 'Success', 'Success criteria', 'circle-check', 'Goals and Success Criteria',
        'What does a good outcome of the session look like?',
        'Describe the output you want and how you will choose the best ideas...',
        ['How many ideas, or what kind of output, do we want?', 'How will we choose the best ideas?', 'What would make this session a success?', 'What is out of scope?'],
        'Leave with three shortlisted ideas, each with an owner and a first experiment.'),
      q('constraints', 'Constraints', 'Boundaries', 'shield', 'Constraints and Context',
        'What boundaries or background should the group know?',
        'Note limits (budget, time, technology), past attempts and assumptions to challenge...',
        ['What is the budget, time or technology limit?', 'What has been tried before?', 'Which assumptions can we challenge?', 'What inspiration or data can I share?'],
        'No new headcount; must use the existing CRM; two earlier pilots failed on data quality.'),
      q('ideas', 'Seed Ideas', 'Starting points', 'lightbulb', 'Seed Ideas',
        'Which ideas or angles can you bring to get the group started?',
        'List a few starter ideas, analogies or provocations...',
        ['What are two or three starter ideas?', 'Which analogies from other fields could help?', 'What is a wild or unconventional idea?', 'Which ideas could build on each other?'],
        'Self-service setup wizard; pre-filled data from the sales hand-over; weekly office hours.'),
      q('format', 'Format', 'How to run it', 'clock', 'Session Format and Roles',
        'How will you run the session?',
        'Describe the technique, timing, roles and materials...',
        ['Which technique will we use (silent writing, rounds, mind map)?', 'How long is each phase?', 'Who facilitates and who takes notes?', 'Which tools or materials do we need?'],
        '10 min silent writing, 20 min sharing, 15 min clustering, 15 min dot voting. Whiteboard and sticky notes.'),
      q('followup', 'Follow-up', 'Capture and decide', 'flag', 'Capturing and Follow-up',
        'How will you capture ideas and turn them into action?',
        'Explain how ideas will be documented, prioritised and followed up...',
        ['How will ideas be documented and shared?', 'How will we prioritise and decide?', 'Who owns the next step for each shortlisted idea?', 'When do we review progress?'],
        'Photos of the board into the project wiki by end of day; vote results in a shared list; review on Thursday.'),
    ],
  },

  one2one: {
    id: 'one2one',
    name: 'One-to-One',
    fullName: 'One-to-One Meeting',
    tagline: 'Priorities, feedback, agreed actions',
    description: 'For regular one-to-ones with a colleague, report or manager: priorities, feedback, growth and actions.',
    icon: 'user',
    accent: '#3b82f6',
    questions: [
      q('checkin', 'Check-in', 'How are things?', 'message-square', 'Check-in',
        'How is the other person doing, and what is on your mind?',
        'Note how you want to open the conversation and anything you should be aware of...',
        ['How are their workload and energy?', 'What went well since we last spoke?', 'What is on my mind going into this meeting?', 'Is there any context I should know about?'],
        'Open with their move to the new team and ask how the first month felt.'),
      q('priorities', 'Priorities', 'Focus areas', 'target', 'Priorities and Progress',
        'What are the current priorities and how are they going?',
        'List the top priorities and progress against them...',
        ['What are their top priorities right now?', 'What progress have they made against goals?', 'Where do priorities need to change?', 'What should be dropped or delayed?'],
        'Priority 1: ship reporting v2 by month end. Priority 2: onboard the new teammate.'),
      q('topics', 'Topics', 'To discuss', 'list-checks', 'Topics to Discuss',
        'Which topics should we cover, in order of importance?',
        'List the topics, most important first...',
        ['What are the must-discuss items?', 'What did they ask to talk about?', 'Which items are open from last time?', 'What can wait until next time?'],
        '1) Incident follow-up. 2) Conference request. 3) Open item: on-call rota.'),
      q('feedback', 'Feedback', 'Give and receive', 'user', 'Feedback',
        'What feedback will you give, and what do you want to hear?',
        'Prepare specific examples and the feedback you would like to ask for...',
        ['Which specific, recent examples can I give (positive and constructive)?', 'What impact did the behaviour have?', 'What feedback do I want to ask for?', 'How will I make it safe to respond?'],
        'Positive: a clear incident write-up that saved the team a day. Constructive: demos need more lead time.'),
      q('growth', 'Growth', 'Development and support', 'trending-up', 'Growth and Support',
        'What are their development goals and how can you help?',
        'Note development goals, opportunities and support needed...',
        ['What are their career or learning goals?', 'Which opportunities or stretch tasks fit?', 'What obstacles are in their way?', 'What support or resources do they need?'],
        'They want to lead a small project; offer the vendor evaluation and a mentoring session.'),
      q('actions', 'Actions', 'Agreed next steps', 'circle-check', 'Agreed Actions',
        'What will each of you do before the next meeting?',
        'List the actions, owners and dates, plus the next meeting...',
        ['What did we agree?', 'Who owns each action and by when?', 'What will I follow up on?', 'When is the next one-to-one?'],
        'They draft the project proposal by Friday; I introduce them to the architecture group.'),
    ],
  },
};

export const TEMPLATE_ORDER = ['stakeholder', 'architecture', 'project', 'decision', 'brainstorm', 'one2one'];

export const ACCENTS = ['#2563eb', '#475569', '#0ea5e9', '#d97706', '#ca8a04', '#16a34a', '#db2777', '#7c3aed'];

export function getDefaultTemplate(id) {
  return DEFAULT_TEMPLATES[id] ? clone(DEFAULT_TEMPLATES[id]) : null;
}

const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

/** Coerce stored/edited data into a valid template, or null if it cannot be salvaged. */
export function normalizeTemplate(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const seen = new Set();
  const questions = (Array.isArray(raw.questions) ? raw.questions : [])
    .filter((x) => x && typeof x === 'object')
    .map((x) => {
      let id = str(x.id) || 'q-' + uid().slice(0, 8);
      while (seen.has(id)) id += '-' + uid().slice(0, 4);
      seen.add(id);
      const heading = str(x.noteHeading) || str(x.label) || 'Untitled section';
      const max = Number(x.maxLength);
      return {
        id,
        step: str(x.step) || heading,
        stepHint: str(x.stepHint),
        icon: str(x.icon) || 'file-text',
        label: str(x.label) || heading,
        noteHeading: heading,
        description: str(x.description),
        placeholder: str(x.placeholder),
        prompts: (Array.isArray(x.prompts) ? x.prompts : []).map((p) => str(p).trim()).filter(Boolean),
        example: str(x.example),
        maxLength: Number.isFinite(max) && max >= 50 && max <= 20000 ? Math.round(max) : 1000,
      };
    });
  if (!questions.length) return null;
  const name = str(raw.name).trim() || 'Untitled meeting';
  return {
    id: raw.id,
    name,
    fullName: str(raw.fullName).trim() || `${name} Meeting`,
    tagline: str(raw.tagline),
    description: str(raw.description),
    icon: str(raw.icon) || 'file-text',
    accent: /^#[0-9a-f]{6}$/i.test(str(raw.accent)) ? raw.accent : ACCENTS[0],
    custom: !!raw.custom,
    createdAt: raw.createdAt || undefined,
    updatedAt: raw.updatedAt || undefined,
    questions,
  };
}

/** Human-readable problems with a template being edited (empty array = valid). */
export function validateTemplate(t) {
  const errors = [];
  if (!str(t.name).trim()) errors.push('Give the meeting type a name.');
  if (!Array.isArray(t.questions) || !t.questions.length) errors.push('Add at least one question.');
  (t.questions || []).forEach((x, i) => {
    if (!str(x.label).trim() && !str(x.noteHeading).trim()) errors.push(`Question ${i + 1} needs a label or note heading.`);
  });
  return errors;
}

export function blankQuestion() {
  return {
    id: 'q-' + uid().slice(0, 8),
    step: 'New step',
    stepHint: '',
    icon: 'file-text',
    label: 'New question',
    noteHeading: 'New question',
    description: '',
    placeholder: 'Type your notes here...',
    prompts: [],
    example: '',
    maxLength: 1000,
  };
}

export function blankTemplate() {
  return {
    id: 'custom-' + uid().slice(0, 8),
    name: 'My meeting type',
    fullName: 'My Meeting',
    tagline: 'Short summary shown on the card',
    description: '',
    icon: 'clipboard',
    accent: ACCENTS[6],
    custom: true,
    createdAt: Date.now(),
    questions: [blankQuestion()],
  };
}

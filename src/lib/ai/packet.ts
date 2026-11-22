/**
 * Gemini Nano via hybrid inference is single-turn: the app rebuilds a compact state packet every call.
 * Budget: ≤ ~900 input tokens (we keep the serialised packet under 3,600 characters).
 */
import type { Problem } from '@/content/schema';
import { MISCONCEPTIONS, isMisconceptionId } from '@/content/misconceptions';
import type { ProblemState, Stage } from '@/lib/learning/reducer';
import { currentStepIndex, forbiddenStrings } from '@/lib/learning/verify';
import { lastAccepted } from '@/lib/learning/reducer';
import type { TutorTask } from './prompts';
import { TASK_INSTRUCTIONS } from './prompts';

export interface TutorPacket {
  task: TutorTask;
  student: { yearGroup: number | 'adult'; tone: 'encouraging' | 'direct' };
  problem: { id: string; statement: string; skill: string; objective: string };
  stage: Exclude<Stage, 'COMPLETE'>;
  step: { index: number; total: number; nextObjective: string };
  facts: string[];
  lastTutorQuestion: string | null;
  lastStudentInput: string | null;
  hintLevel: number;
  authoredHint?: string;
  sessionMisconceptions: string[];
  watchList: string[];
  forbidden: string[];
  recentTutorQuestions: string[];
  /** The checker's verdict on the student's latest work, stated plainly so a small model cannot miss it. */
  verdict: 'WRONG' | 'CORRECT' | null;
}

/** Derive the verdict from the newest fact (facts come from the deterministic checker). */
export function verdictFromFacts(facts: string[]): TutorPacket['verdict'] {
  const last = facts[facts.length - 1] ?? '';
  if (/CHANGED|WRONG|does not balance/.test(last)) return 'WRONG';
  if (/is balanced|keeps the same value/.test(last)) return 'CORRECT';
  return null;
}

export interface PacketInput {
  task: TutorTask;
  problem: Problem;
  state: ProblemState;
  skillName: string;
  yearGroup: number | 'adult';
  tone: 'encouraging' | 'direct';
  facts: string[];
  lastTutorQuestion: string | null;
  lastStudentInput: string | null;
  authoredHint?: string;
  watchList: string[];
  recentTutorQuestions: string[];
}

export function buildPacket(i: PacketInput): TutorPacket {
  const lastGood = lastAccepted(i.state.lines)?.text ?? i.problem.statement;
  const stepIdx = currentStepIndex(i.problem, lastGood);
  const stage = (i.state.stage === 'COMPLETE' ? 'TRANSFER' : i.state.stage) as TutorPacket['stage'];
  // once the student has the answer (VERIFY onwards) it is theirs, so it is no longer forbidden
  const forbidden = ['ORIENT', 'PLAN', 'STEP'].includes(i.state.stage) ? forbiddenStrings(i.problem, stepIdx) : [];
  return {
    task: i.task,
    student: { yearGroup: i.yearGroup, tone: i.tone },
    problem: { id: i.problem.id, statement: i.problem.statement, skill: i.skillName, objective: i.problem.objective },
    stage,
    step: { index: stepIdx + 1, total: i.problem.steps.length, nextObjective: i.problem.steps[stepIdx]?.objective ?? 'finish' },
    facts: i.facts.slice(-4),
    lastTutorQuestion: i.lastTutorQuestion,
    lastStudentInput: i.lastStudentInput ? i.lastStudentInput.slice(0, 200) : null,
    hintLevel: i.state.hintLevel,
    authoredHint: i.authoredHint,
    sessionMisconceptions: i.state.misconceptions,
    watchList: i.watchList.slice(0, 2),
    forbidden,
    recentTutorQuestions: i.recentTutorQuestions.slice(-2),
    verdict: i.task === 'respond_to_line' || i.task === 'verify_prompt' ? verdictFromFacts(i.facts) : null,
  };
}

/** Compact labelled text: cheaper than raw JSON on a small model. */
export function serialisePacket(p: TutorPacket): string {
  const lines: string[] = [
    `TASK: ${p.task}`,
    `STUDENT: ${p.student.yearGroup === 'adult' ? 'adult learner' : `year ${p.student.yearGroup}`}, tone ${p.student.tone}`,
    `PROBLEM: ${p.problem.statement} | skill: ${p.problem.skill} | objective: ${p.problem.objective}`,
    `STAGE: ${p.stage}${p.stage === 'STEP' ? ` ${p.step.index}/${p.step.total}` : ''} | next objective: ${p.step.nextObjective}`,
  ];
  if (p.verdict === 'WRONG') lines.push("VERDICT: the student's latest line is WRONG. Do NOT say it is correct. Point to the mistake with a question.");
  if (p.verdict === 'CORRECT') lines.push("VERDICT: the student's latest line is CORRECT. Say so briefly, then ask about the next step.");
  if (p.facts.length) lines.push('FACTS:', ...p.facts.map((f) => `- ${f}`));
  if (p.sessionMisconceptions.length) {
    lines.push(`SEEN THIS SESSION: ${p.sessionMisconceptions.map((m) => (isMisconceptionId(m) ? `${m} (${MISCONCEPTIONS[m].name})` : m)).join('; ')}`);
  }
  if (p.lastTutorQuestion) lines.push(`LAST TUTOR QUESTION: ${p.lastTutorQuestion}`);
  if (p.lastStudentInput) lines.push(`STUDENT SAID: ${p.lastStudentInput}`);
  lines.push(`HINT LEVEL: ${p.hintLevel}`);
  if (p.authoredHint) lines.push(`AUTHORED HINT: ${p.authoredHint}`);
  if (p.watchList.length) lines.push(`WATCH: ${p.watchList.join('; ')}`);
  if (p.forbidden.length) lines.push(`DO NOT SAY: ${p.forbidden.map((f) => `"${f}"`).join(', ')}`);
  if (p.recentTutorQuestions.length) lines.push(`AVOID REPEATING: ${p.recentTutorQuestions.map((q) => `"${q}"`).join(', ')}`);
  lines.push('', `INSTRUCTION: ${TASK_INSTRUCTIONS[p.task]}`);
  const text = lines.join('\n');
  return text.length > 3600 ? text.slice(0, 3600) : text;
}

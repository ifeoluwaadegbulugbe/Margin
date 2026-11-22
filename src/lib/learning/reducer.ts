/**
 * The Socratic stage machine. The app owns the stage; model signals only move stages that
 * have no deterministic evidence (ORIENT, PLAN, EXPLAIN). Pure: (state, event) -> state.
 */
import type { MisconceptionId } from '@/content/misconceptions';
import type { LineResult } from './verify';

export type Stage = 'ORIENT' | 'PLAN' | 'STEP' | 'VERIFY' | 'EXPLAIN' | 'TRANSFER' | 'COMPLETE';
export const STAGES: Stage[] = ['ORIENT', 'PLAN', 'STEP', 'VERIFY', 'EXPLAIN', 'TRANSFER', 'COMPLETE'];

export type HintLevel = 0 | 1 | 2 | 3 | 4;
export type Understanding = 'understands' | 'partial' | 'confused' | 'off_topic';
export type ExplanationQuality = 'sound' | 'partial' | 'missing' | 'not_applicable';
export type ReplyKind = 'normal' | 'idk' | 'answer_request' | 'frustrated' | 'empty';

export interface LineEntry {
  text: string;
  result: LineResult;
  /** A later accepted line fixed this changed line. */
  superseded?: boolean;
}

export interface TransferState {
  problemId: string;
  lines: LineEntry[];
  hintLevel: HintLevel;
  solved: boolean;
}

export interface ProblemState {
  problemId: string;
  stage: Stage;
  lines: LineEntry[];
  hintLevel: HintLevel;
  /** Wording escalations that did not consume a rung (repeat-error help). */
  autoEscalation: number;
  confusion: number;
  offTopic: number;
  answerRequests: number;
  frustrated: boolean;
  errorsInARow: number;
  /** Count of each wrong line text, to detect repeats. */
  wrongRepeats: Record<string, number>;
  misconceptions: MisconceptionId[];
  /** Errors fixed by the student before opening a hint since the error. */
  selfCorrections: number;
  pendingErrorNoHint: boolean;
  finalAttempts: number;
  solved: boolean;
  compensating: boolean;
  explainFollowUps: number;
  explanation: ExplanationQuality;
  supported: boolean;
  swift: boolean;
  transfer: TransferState | null;
  transferSkipped: boolean;
  startedAt: number;
  endedAt: number | null;
}

export type ProblemEvent =
  | { type: 'LINE_VERIFIED'; text: string; result: LineResult }
  | { type: 'FINAL_ANSWER'; correct: boolean }
  | { type: 'TUTOR_SIGNAL'; understanding: Understanding; shouldAdvance: boolean; explanation: ExplanationQuality }
  | { type: 'HINT_REQUESTED' }
  | { type: 'STUDENT_REPLY'; text: string; kind: ReplyKind }
  | { type: 'FREE_PARALLEL' }
  | { type: 'TRANSFER_START'; problemId: string }
  | { type: 'TRANSFER_LINE'; text: string; result: LineResult }
  | { type: 'TRANSFER_HINT' }
  | { type: 'TRANSFER_DONE'; solved: boolean }
  | { type: 'TRANSFER_SKIP' };

export function initialProblemState(problemId: string, now = Date.now()): ProblemState {
  return {
    problemId, stage: 'ORIENT', lines: [], hintLevel: 0, autoEscalation: 0, confusion: 0, offTopic: 0,
    answerRequests: 0, frustrated: false, errorsInARow: 0, wrongRepeats: {}, misconceptions: [],
    selfCorrections: 0, pendingErrorNoHint: false, finalAttempts: 0, solved: false, compensating: false,
    explainFollowUps: 0, explanation: 'not_applicable', supported: false, swift: false, transfer: null,
    transferSkipped: false, startedAt: now, endedAt: null,
  };
}

const BEFORE_VERIFY: Stage[] = ['ORIENT', 'PLAN', 'STEP'];

/** The previous accepted line (balanced or no-progress), or null to use the statement. */
export function lastAccepted(lines: LineEntry[]): LineEntry | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    const s = lines[i].result.status;
    if (s === 'balanced' || s === 'no_progress') return lines[i];
  }
  return null;
}

export function reduceProblem(state: ProblemState, event: ProblemEvent, now = Date.now()): ProblemState {
  if (state.stage === 'COMPLETE') return state;
  switch (event.type) {
    case 'LINE_VERIFIED': {
      if (!BEFORE_VERIFY.includes(state.stage) && state.stage !== 'VERIFY') return state;
      const { result, text } = event;
      const s: ProblemState = { ...state, lines: [...state.lines, { text, result }] };
      if (result.status === 'unreadable') return s;
      if (result.status === 'changed') {
        const key = text.replace(/\s+/g, '');
        const repeats = { ...s.wrongRepeats, [key]: (s.wrongRepeats[key] ?? 0) + 1 };
        const misconceptions = result.misconception && !s.misconceptions.includes(result.misconception)
          ? [...s.misconceptions, result.misconception] : s.misconceptions;
        return {
          ...s,
          wrongRepeats: repeats,
          misconceptions,
          errorsInARow: s.errorsInARow + 1,
          pendingErrorNoHint: true,
          autoEscalation: repeats[key] >= 2 ? s.autoEscalation + 1 : s.autoEscalation,
          // a wrong line in VERIFY sends the student back to working
          stage: s.stage === 'VERIFY' ? 'STEP' : s.stage === 'ORIENT' || s.stage === 'PLAN' ? 'STEP' : s.stage,
        };
      }
      // balanced or no-progress: mark earlier unfixed errors as superseded
      const lines = s.lines.map((l, i) => (i < s.lines.length - 1 && l.result.status === 'changed' ? { ...l, superseded: true } : l));
      const selfCorrections = s.pendingErrorNoHint && result.status === 'balanced' ? s.selfCorrections + 1 : s.selfCorrections;
      let stage = s.stage;
      if (result.solved) {
        stage = 'VERIFY';
        if (state.stage === 'ORIENT' && state.hintLevel === 0) s.swift = true;
      } else if (result.status === 'balanced' && (stage === 'ORIENT' || stage === 'PLAN')) stage = 'STEP';
      return {
        ...s, lines, stage, selfCorrections,
        pendingErrorNoHint: false,
        errorsInARow: result.status === 'balanced' ? 0 : s.errorsInARow,
      };
    }

    case 'FINAL_ANSWER': {
      if (!BEFORE_VERIFY.includes(state.stage) && state.stage !== 'VERIFY') return state;
      if (!event.correct) {
        return { ...state, stage: 'STEP', finalAttempts: state.finalAttempts + 1, errorsInARow: state.errorsInARow + 1, swift: false };
      }
      const last = state.lines[state.lines.length - 1];
      if (last && last.result.status === 'changed' && !last.superseded) {
        // compensating errors: right value, broken working. Stay in STEP until the line is fixed.
        return { ...state, stage: 'STEP', compensating: true, finalAttempts: state.finalAttempts + 1 };
      }
      const swift = state.swift || (state.stage === 'ORIENT' && state.hintLevel === 0 && state.lines.every((l) => l.result.status !== 'changed'));
      return { ...state, stage: 'EXPLAIN', solved: true, finalAttempts: state.finalAttempts + 1, swift };
    }

    case 'TUTOR_SIGNAL': {
      if (state.stage === 'ORIENT' && event.shouldAdvance) return { ...state, stage: 'PLAN' };
      if (state.stage === 'PLAN' && (event.shouldAdvance || event.understanding === 'understands')) return { ...state, stage: 'STEP' };
      if (state.stage === 'EXPLAIN') {
        const q = event.explanation;
        if (q === 'sound' || state.explainFollowUps >= 1) {
          const best: ExplanationQuality = q === 'not_applicable' ? 'missing' : q;
          return { ...state, explanation: best, stage: 'TRANSFER' };
        }
        return { ...state, explanation: q === 'not_applicable' ? 'missing' : q, explainFollowUps: state.explainFollowUps + 1 };
      }
      if (event.understanding === 'confused') return { ...state, confusion: state.confusion + 1 };
      return state;
    }

    case 'HINT_REQUESTED': {
      if (state.hintLevel >= 4) return state;
      return { ...state, hintLevel: (state.hintLevel + 1) as HintLevel, pendingErrorNoHint: false };
    }

    case 'STUDENT_REPLY': {
      const s = { ...state };
      if (event.kind === 'idk') s.confusion += 1;
      if (event.kind === 'answer_request') s.answerRequests += 1;
      if (event.kind === 'frustrated') s.frustrated = true;
      if (s.stage === 'ORIENT' && event.kind !== 'empty' && event.text.trim()) s.stage = 'PLAN';
      return s;
    }

    case 'FREE_PARALLEL':
      return { ...state, supported: true };

    case 'TRANSFER_START':
      if (state.stage !== 'TRANSFER') return state;
      return { ...state, transfer: { problemId: event.problemId, lines: [], hintLevel: 0, solved: false } };

    case 'TRANSFER_LINE':
      if (!state.transfer) return state;
      return { ...state, transfer: { ...state.transfer, lines: [...state.transfer.lines, { text: event.text, result: event.result }] } };

    case 'TRANSFER_HINT':
      if (!state.transfer || state.transfer.hintLevel >= 4) return state;
      return { ...state, transfer: { ...state.transfer, hintLevel: (state.transfer.hintLevel + 1) as HintLevel } };

    case 'TRANSFER_DONE':
      if (state.stage !== 'TRANSFER') return state;
      return { ...state, stage: 'COMPLETE', transfer: state.transfer ? { ...state.transfer, solved: event.solved } : null, endedAt: now };

    case 'TRANSFER_SKIP':
      if (state.stage !== 'TRANSFER') return state;
      return { ...state, stage: 'COMPLETE', transferSkipped: true, endedAt: now };
  }
}

/** Classify a free-text reply so the app (not the model) tracks confusion and answer requests. */
export function classifyReply(text: string): ReplyKind {
  const t = text.trim().toLowerCase();
  if (!t) return 'empty';
  if (/\b(just )?(tell|give|show) me( the)? (answer|solution)\b|\bwhat('?s| is) the answer\b|^answer\??$/.test(t)) return 'answer_request';
  if (/\b(stupid|hate|pointless|boring|useless|can'?t do this|give up|annoying)\b/.test(t)) return 'frustrated';
  if (/^(idk|i ?d ?k|dunno|no idea|not sure|i don'?t know|\?+|no clue|huh)\.?$/.test(t) || /\bi don'?t (know|get it|understand)\b/.test(t)) return 'idk';
  return 'normal';
}

/** Genuinely confused: 3+ "I don't know", or 3 errors in a row. */
export const isConfused = (s: ProblemState) => s.confusion >= 3 || s.errorsInARow >= 3;

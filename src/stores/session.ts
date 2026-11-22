/**
 * Expedition runtime: owns the current problem's state machine, Nova's conversation and autosave.
 * Correctness always comes from the verifier; Nova only supplies language.
 */
import { create } from 'zustand';
import { getProblem, getSkill, type Problem } from '@/content';
import {
  classifyReply, initialProblemState, isConfused, lastAccepted, reduceProblem,
  type ProblemEvent, type ProblemState,
} from '@/lib/learning/reducer';
import { verifyFinal, verifyLine, type LineResult } from '@/lib/learning/verify';
import { formatNumber } from '@/lib/learning/linear';
import { askNova, resetProblemCalls, type NovaReply } from '@/lib/ai/tutor';
import type { TutorTask } from '@/lib/ai/prompts';
import { runCartographer, watchList } from '@/lib/ai/strategist';
import type { Expedition } from '@/lib/learning/recommender';
import { computeCompletion, type CompletionSummary } from '@/lib/game/complete';
import { localDate } from '@/lib/game/streak';
import type { SessionRecord } from '@/types/domain';
import type { Source } from './aiStatus';
import { useAuth } from './auth';
import { useProfile } from './profile';
import { useToast } from './toast';

export interface ChatMessage {
  id: number;
  from: 'nova' | 'student';
  text: string;
  source?: Source | 'AUTHORED';
  latencyMs?: number;
  hint?: { level: number; worked?: { problem: string; lines: string[] } };
  facts?: string[];
  flagged?: boolean;
  task?: TutorTask;
}

export interface FinalFeedback {
  kind: 'correct' | 'wrong' | 'compensating' | 'unreadable' | 'simplify';
  text: string;
}

interface SessionState {
  session: SessionRecord | null;
  index: number;
  done: ProblemState[];
  current: ProblemState | null;
  messages: ChatMessage[];
  pending: boolean;
  awaitingReply: boolean;
  lastTutorQuestion: string | null;
  recentQuestions: string[];
  facts: string[];
  finalFeedback: FinalFeedback | null;
  offerParallel: boolean;
  offerWorked: boolean;
  completion: CompletionSummary | null;
  finishing: boolean;

  start: (exp: Expedition) => Promise<void>;
  resume: (s: SessionRecord) => void;
  submitLine: (text: string) => Promise<LineResult | null>;
  submitFinal: (text: string) => Promise<void>;
  reply: (text: string) => Promise<void>;
  requestHint: () => Promise<void>;
  takeFreeParallel: () => void;
  skipTransfer: () => Promise<void>;
  nextProblem: () => Promise<void>;
  flagMessage: (id: number) => void;
  pause: () => Promise<void>;
  clear: () => void;
}

let msgId = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

const OPENERS = [
  'What is this asking you to find? What is the first thing you notice about it?',
  'Before you write anything: what do you notice first?',
  'Take a look. What would you like to find out, and what stands in the way?',
];

/** Problem currently on screen: the transfer problem during TRANSFER, else the main one. */
export function activeProblem(s: Pick<SessionState, 'current'>): Problem | null {
  const c = s.current;
  if (!c) return null;
  if (c.stage === 'TRANSFER' && c.transfer) return getProblem(c.transfer.problemId) ?? null;
  return getProblem(c.problemId) ?? null;
}

export const useSession = create<SessionState>((set, get) => {
  const dispatch = (e: ProblemEvent) => {
    const c = get().current;
    if (!c) return null;
    const next = reduceProblem(c, e);
    set({ current: next });
    return next;
  };

  const novaSay = (text: string, extra: Partial<ChatMessage> = {}) => {
    set({ messages: [...get().messages, { id: msgId++, from: 'nova', text, ...extra }] });
    if (text.includes('?')) {
      set({ awaitingReply: true, lastTutorQuestion: text, recentQuestions: [...get().recentQuestions, text].slice(-2) });
    }
  };

  const studentSay = (text: string) => set({ messages: [...get().messages, { id: msgId++, from: 'student', text }] });

  const countSource = (src: Source) => {
    const s = get().session;
    if (!s) return;
    const c = { ...s.inferenceCounts };
    if (src === 'ON_DEVICE') c.onDevice++;
    else if (src === 'SCRIPTED') c.scripted++;
    else c.cloud++;
    set({ session: { ...s, inferenceCounts: c } });
  };

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persist(), 3000);
  };

  const persist = async () => {
    const { session, current, index } = get();
    const uid = useAuth.getState().uid;
    if (!session || !uid) return;
    const rec: SessionRecord = { ...session, currentIndex: index, currentState: current };
    try {
      window.localStorage.setItem('margin.draft', JSON.stringify(rec));
    } catch {
      /* crash-recovery draft is best effort */
    }
    await useAuth.getState().repo.saveSession(uid, rec).catch((e) => console.error('[margin] autosave failed', e));
  };

  /** Ask Nova, render the reply, return the structured response for signals. */
  const nova = async (task: TutorTask, opts: {
    problem: Problem; state: ProblemState; facts?: string[]; studentInput?: string | null; authoredHint?: string;
    verifierMisconception?: LineResult['misconception']; lastLine?: LineResult & { text: string; lineNumber: number };
    replyKind?: ReturnType<typeof classifyReply>; hint?: ChatMessage['hint'];
  }): Promise<NovaReply | null> => {
    const profile = useProfile.getState();
    const user = profile.user;
    const wl = watchList(profile.insight, profile.misconceptions);
    set({ pending: true });
    try {
      const reply = await askNova({
        task,
        problem: opts.problem,
        state: opts.state,
        skillName: getSkill(opts.problem.skillId)?.name ?? opts.problem.skillId,
        yearGroup: user?.yearGroup ?? 10,
        tone: opts.state.frustrated ? 'encouraging' : user?.tone ?? 'encouraging',
        facts: opts.facts ?? get().facts,
        lastTutorQuestion: get().lastTutorQuestion,
        lastStudentInput: opts.studentInput ?? null,
        authoredHint: opts.authoredHint,
        watchList: wl.phrases,
        recentTutorQuestions: get().recentQuestions,
        verifierMisconception: opts.verifierMisconception ?? null,
        lastLine: opts.lastLine,
        replyKind: opts.replyKind,
      });
      if (reply.stale) return null;
      countSource(reply.source);
      novaSay(reply.message, { source: reply.source, latencyMs: reply.latencyMs, hint: opts.hint, facts: opts.facts ?? get().facts, task });
      return reply;
    } finally {
      set({ pending: false });
    }
  };

  const enterProblem = (problemId: string, state?: ProblemState) => {
    const p = getProblem(problemId);
    resetProblemCalls(problemId);
    set({
      current: state ?? initialProblemState(problemId),
      messages: [], facts: [], lastTutorQuestion: null, recentQuestions: [], finalFeedback: null,
      offerParallel: false, offerWorked: false, awaitingReply: false,
    });
    const opener = p?.transferOnly ? 'Read it carefully. What is the unknown, and what do you know about it?' : OPENERS[Math.floor(Math.random() * OPENERS.length)];
    if (!state || state.lines.length === 0) novaSay(opener, { source: 'AUTHORED' });
    else novaSay('Welcome back. Pick up from your last line. What is your next move?', { source: 'AUTHORED' });
  };

  /** After EXPLAIN completes: start the transfer challenge, or finish if there is none. */
  const afterExplain = async () => {
    const c = get().current;
    if (!c || c.stage !== 'TRANSFER') return;
    const p = getProblem(c.problemId)!;
    const inExpedition = get().session?.problemIds.includes(p.transferId ?? '');
    const alreadyUsed = get().done.some((d) => d.transfer?.problemId === p.transferId);
    if (p.transferId && getProblem(p.transferId) && !inExpedition && !alreadyUsed) {
      dispatch({ type: 'TRANSFER_START', problemId: p.transferId });
      set({ finalFeedback: null, facts: [] });
      novaSay('Transfer challenge: same idea, new situation. Hints are tucked away. Try it first. What equation or calculation would describe it?', { source: 'AUTHORED' });
    } else {
      dispatch({ type: 'TRANSFER_SKIP' });
      await celebrate();
    }
  };

  const celebrate = async () => {
    const c = get().current;
    if (!c) return;
    const p = getProblem(c.problemId)!;
    const facts = [
      c.selfCorrections ? `The student fixed their own error ${c.selfCorrections} time(s).` : '',
      c.hintLevel === 0 ? 'No hints used.' : `Hints used up to level ${c.hintLevel}.`,
      c.explanation === 'sound' ? 'Explanation was sound.' : '',
      c.transfer?.solved ? 'Transfer challenge solved.' : '',
    ].filter(Boolean);
    set({ awaitingReply: false });
    await nova('celebrate', { problem: p, state: c, facts });
    set({ awaitingReply: false });
    scheduleSave();
  };

  return {
    session: null, index: 0, done: [], current: null, messages: [], pending: false, awaitingReply: false,
    lastTutorQuestion: null, recentQuestions: [], facts: [], finalFeedback: null, offerParallel: false,
    offerWorked: false, completion: null, finishing: false,

    start: async (exp) => {
      const user = await useProfile.getState().ensureUser();
      const session: SessionRecord = {
        id: `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        expeditionType: exp.type, skillId: exp.skillId, problemIds: exp.problemIds, reason: exp.reason, focus: exp.focus,
        status: 'active', startedAt: Date.now(), endedAt: null, currentIndex: 0, currentState: null, problems: [],
        inferenceCounts: { onDevice: 0, cloud: 0, scripted: 0 }, xpEarned: 0,
      };
      set({ session, index: 0, done: [], completion: null });
      enterProblem(exp.problemIds[0]);
      await useAuth.getState().repo.saveSession(user.uid, session).catch((e) => console.error(e));
    },

    resume: (s) => {
      set({ session: s, index: s.currentIndex, done: [], completion: null });
      enterProblem(s.problemIds[s.currentIndex], s.currentState ?? undefined);
    },

    submitLine: async (text) => {
      const c = get().current;
      if (!c || get().pending) return null;
      const inTransfer = c.stage === 'TRANSFER' && !!c.transfer;
      const problem = activeProblem(get());
      if (!problem) return null;
      const lines = inTransfer ? c.transfer!.lines : c.lines;
      const prev = lastAccepted(lines);
      const lineNumber = lines.length + 1;
      const result = verifyLine(problem, text, { prevText: prev?.text ?? problem.statement, prevBalanced: true, lineNumber });
      studentSay(text);

      if (inTransfer) {
        const next = dispatch({ type: 'TRANSFER_LINE', text, result })!;
        if (result.status === 'unreadable') return result;
        const synthetic: ProblemState = { ...initialProblemState(problem.id), stage: 'STEP', lines: next.transfer!.lines, hintLevel: next.transfer!.hintLevel };
        if (result.solved) {
          novaSay('That isolates it. Type your final answer in the box to lock it in.', { source: 'AUTHORED' });
          return result;
        }
        await nova('respond_to_line', { problem, state: synthetic, facts: [result.fact], studentInput: text, verifierMisconception: result.misconception, lastLine: { ...result, text, lineNumber } });
        return result;
      }

      const before = c.autoEscalation;
      const next = dispatch({ type: 'LINE_VERIFIED', text, result })!;
      const facts = [...get().facts, result.fact].slice(-4);
      set({ facts, finalFeedback: null });
      scheduleSave();
      if (result.status === 'unreadable') return result;

      if (isConfused(next) && !next.supported) set({ offerParallel: true });

      if (next.autoEscalation > before) {
        // same wrong line again: escalate the wording for free (no rung consumed)
        const level = Math.min(4, Math.max(1, next.hintLevel + 1)) as 1 | 2 | 3;
        const authored = level <= 3 ? problem.hints[String(level) as '1' | '2' | '3'] : problem.hints['3'];
        await nova('phrase_hint', {
          problem, state: next, facts: [...facts, 'The student repeated the same wrong line. Name the pattern kindly and make the question easier.'],
          studentInput: text, authoredHint: authored, verifierMisconception: result.misconception, lastLine: { ...result, text, lineNumber },
        });
        return result;
      }
      await nova(result.solved ? 'verify_prompt' : 'respond_to_line', {
        problem, state: next, facts, studentInput: text, verifierMisconception: result.misconception, lastLine: { ...result, text, lineNumber },
      });
      return result;
    },

    submitFinal: async (text) => {
      const c = get().current;
      if (!c || get().pending) return;
      const problem = activeProblem(get());
      if (!problem) return;
      const r = verifyFinal(problem, text);
      if (!r.readable) {
        set({ finalFeedback: { kind: 'unreadable', text: r.message } });
        return;
      }
      if (r.notSimplest) {
        set({ finalFeedback: { kind: 'simplify', text: r.message } });
        return;
      }

      if (c.stage === 'TRANSFER' && c.transfer) {
        if (r.correct) {
          dispatch({ type: 'TRANSFER_DONE', solved: true });
          set({ finalFeedback: { kind: 'correct', text: 'Transfer solved. The idea travels.' } });
          await celebrate();
        } else {
          set({ finalFeedback: { kind: 'wrong', text: 'Not quite. Check your working line by line.' } });
        }
        return;
      }

      const next = dispatch({ type: 'FINAL_ANSWER', correct: r.correct })!;
      const v = problem.variable ?? 'x';
      if (next.stage === 'EXPLAIN') {
        set({ finalFeedback: { kind: 'correct', text: 'Correct, and it came from your own working.' } });
        novaSay(`You got it. ${problem.explainPrompt}`, { source: 'AUTHORED' });
        scheduleSave();
        return;
      }
      if (next.compensating) {
        const bad = [...next.lines].reverse().find((l) => l.result.status === 'changed');
        const idx = bad ? next.lines.indexOf(bad) + 1 : next.lines.length;
        const fact = `The final answer is right, but line ${idx} does not balance (compensating errors).`;
        set({ finalFeedback: { kind: 'compensating', text: `Right value, but line ${idx} doesn't balance. Can you see why it worked out anyway?` }, facts: [...get().facts, fact].slice(-4) });
        await nova('respond_to_line', { problem, state: next, facts: [fact], studentInput: text });
        return;
      }
      const firstChanged = next.lines.findIndex((l) => l.result.status === 'changed' && !l.superseded);
      const fact = `The student submitted ${v} = ${r.value !== null ? formatNumber(r.value) : text} as the final answer and it is WRONG.${firstChanged >= 0 ? ` Line ${firstChanged + 1} is where the solution changed.` : ''}${r.misconception ? ` Likely misconception: ${r.misconception}.` : ''}`;
      set({ finalFeedback: { kind: 'wrong', text: firstChanged >= 0 ? `Not quite. Line ${firstChanged + 1} is where it changed.` : 'Not quite. Check your working line by line.' }, facts: [...get().facts, fact].slice(-4) });
      await nova('respond_to_line', { problem, state: next, facts: [...get().facts], studentInput: text, verifierMisconception: r.misconception });
    },

    reply: async (text) => {
      const c = get().current;
      if (!c || get().pending || !text.trim()) return;
      const problem = activeProblem(get());
      if (!problem) return;
      const kind = classifyReply(text);
      studentSay(text);
      set({ awaitingReply: false });

      if (c.stage === 'EXPLAIN') {
        const res = await nova('evaluate_explanation', { problem, state: c, studentInput: text, facts: [`The student solved it correctly. Explain prompt: "${problem.explainPrompt}"`] });
        const quality = res?.response.explanation_quality ?? 'partial';
        const next = dispatch({ type: 'TUTOR_SIGNAL', understanding: res?.response.understanding_signal ?? 'partial', shouldAdvance: !!res?.response.should_advance, explanation: quality === 'not_applicable' ? 'partial' : quality });
        if (next?.stage === 'TRANSFER') await afterExplain();
        scheduleSave();
        return;
      }

      const next = dispatch({ type: 'STUDENT_REPLY', text, kind })!;
      if (isConfused(next) && !next.supported) set({ offerParallel: true });
      if (next.answerRequests >= 3) set({ offerWorked: true });
      const res = await nova('respond_to_reply', { problem, state: next, studentInput: text, replyKind: kind });
      if (res) dispatch({ type: 'TUTOR_SIGNAL', understanding: res.response.understanding_signal, shouldAdvance: res.response.should_advance, explanation: 'not_applicable' });
      scheduleSave();
    },

    requestHint: async () => {
      const c = get().current;
      if (!c || get().pending) return;
      const problem = activeProblem(get());
      if (!problem) return;
      const inTransfer = c.stage === 'TRANSFER' && !!c.transfer;
      const next = dispatch(inTransfer ? { type: 'TRANSFER_HINT' } : { type: 'HINT_REQUESTED' })!;
      const level = inTransfer ? next.transfer!.hintLevel : next.hintLevel;
      scheduleSave();
      if (level === 4) {
        const w = problem.hints['4'];
        novaSay(`Watch this one, then try yours: ${w.problem}`, { source: 'AUTHORED', hint: { level: 4, worked: { problem: w.problem, lines: w.lines } } });
        return;
      }
      const authored = problem.hints[String(level) as '1' | '2' | '3'];
      const state = inTransfer ? { ...initialProblemState(problem.id), stage: 'STEP' as const, lines: next.transfer!.lines, hintLevel: level } : next;
      await nova('phrase_hint', { problem, state, authoredHint: authored, studentInput: lastAccepted(state.lines)?.text ?? null, hint: { level } });
    },

    takeFreeParallel: () => {
      const c = get().current;
      const problem = activeProblem(get());
      if (!c || !problem) return;
      dispatch({ type: 'FREE_PARALLEL' });
      const w = problem.hints['4'];
      set({ offerParallel: false });
      novaSay(`Let's look at a similar one together: ${w.problem}`, { source: 'AUTHORED', hint: { level: 4, worked: { problem: w.problem, lines: w.lines } } });
    },

    skipTransfer: async () => {
      dispatch({ type: 'TRANSFER_SKIP' });
      await celebrate();
    },

    nextProblem: async () => {
      const { current, index, session } = get();
      if (!current || !session) return;
      const finished = current.stage === 'COMPLETE' ? current : { ...current, endedAt: Date.now() };
      const done = [...get().done, finished];
      if (index + 1 < session.problemIds.length) {
        set({ done, index: index + 1 });
        enterProblem(session.problemIds[index + 1]);
        scheduleSave();
        return;
      }
      // expedition finished: one batched write, then the Cartographer (non-blocking)
      set({ done, finishing: true });
      if (saveTimer) clearTimeout(saveTimer);
      const profile = useProfile.getState();
      const user = profile.user ?? (await profile.ensureUser());
      const wl = watchList(profile.insight, profile.misconceptions);
      const high = profile.insight?.output.recurring_misconceptions.filter((m) => m.severity === 'high').map((m) => m.id) ?? [];
      const { batch, summary } = computeCompletion({
        user, mastery: profile.mastery, misconceptions: profile.misconceptions, unlocked: new Set(Object.keys(profile.achievements)),
        session, states: done, watchIds: wl.ids, highSeverityIds: high, today: localDate(),
      });
      try {
        await useAuth.getState().repo.completeSession(user.uid, batch);
      } catch (e) {
        console.error('[margin] completion write failed', e);
        useToast.getState().push({ kind: 'error', text: 'Saving this session failed. Your rewards are shown but may not sync.', persist: true });
      }
      try {
        window.localStorage.removeItem('margin.draft');
      } catch {
        /* ignore */
      }
      const newAch = Object.fromEntries(Object.entries(batch.achievements));
      useProfile.setState({
        user: { ...user, ...batch.userPatch },
        mastery: { ...profile.mastery, ...batch.mastery },
        misconceptions: { ...profile.misconceptions, ...batch.misconceptions },
        achievements: { ...profile.achievements, ...newAch },
        sessions: [batch.session, ...profile.sessions.filter((s) => s.id !== batch.session.id)].slice(0, 8),
      });
      set({ completion: summary, session: batch.session, finishing: false });
      void runPostSessionStrategist();
    },

    flagMessage: (id) => set({ messages: get().messages.map((m) => (m.id === id ? { ...m, flagged: true } : m)) }),

    pause: async () => {
      if (saveTimer) clearTimeout(saveTimer);
      await persist();
    },

    clear: () => set({ session: null, current: null, messages: [], done: [], index: 0, completion: null }),
  };
});

export async function runPostSessionStrategist(type: 'post_session' | 'weekly' | 'first_route' = 'post_session') {
  const p = useProfile.getState();
  if (!p.user) return;
  p.setStrategistPending(true);
  try {
    const res = await runCartographer(type, p.user, p.mastery, p.sessions, p.misconceptions);
    if (res.ok) await useProfile.getState().setInsight(res.insight);
    else useToast.getState().push({ kind: 'info', text: `Learning Guide notes unavailable (${res.error}). Using the built-in plan for now.` });
    return res;
  } finally {
    useProfile.getState().setStrategistPending(false);
  }
}

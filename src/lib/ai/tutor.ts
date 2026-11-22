/**
 * The only entry point the UI uses for Nova: packet -> inference -> validation -> (retry) -> authored fallback.
 * The lesson never dead-ends: if the model fails twice, an authored line is shown and labelled SCRIPTED.
 */
import type { Problem } from '@/content/schema';
import type { MisconceptionId } from '@/content/misconceptions';
import type { ExplanationQuality, ProblemState, ReplyKind } from '@/lib/learning/reducer';
import type { LineResult } from '@/lib/learning/verify';
import { buildPacket, serialisePacket, type PacketInput } from './packet';
import { applyGuards, parseJsonLoose } from './guards';
import { isCurrent, runTutor } from './inference';
import type { TutorResponse } from './schemas';
import type { TutorTask } from './prompts';
import { useAiStatus, type Source } from '@/stores/aiStatus';

export interface NovaReply {
  message: string;
  response: TutorResponse;
  source: Source;
  latencyMs: number;
  scripted: boolean;
  stale: boolean;
  packetText: string;
}

export interface TutorCall extends Omit<PacketInput, 'task'> {
  task: TutorTask;
  verifierMisconception: MisconceptionId | null;
  /** Context for authored fallbacks. */
  lastLine?: LineResult & { text: string; lineNumber: number };
  replyKind?: ReplyKind;
}

const MAX_CALLS_PER_PROBLEM = 30;
const callsByProblem = new Map<string, number>();

export async function askNova(call: TutorCall): Promise<NovaReply> {
  const packet = buildPacket(call);
  const packetText = serialisePacket(packet);
  const used = callsByProblem.get(call.problem.id) ?? 0;
  callsByProblem.set(call.problem.id, used + 1);
  const log = useAiStatus.getState().addLog;

  if (used >= MAX_CALLS_PER_PROBLEM) {
    const fb = fallback(call);
    log({ role: 'Scribble', task: call.task, mode: '-', source: 'SCRIPTED', latencyMs: 0, validation: 'failed', note: 'per-problem call cap reached' });
    return { ...fb, source: 'SCRIPTED', latencyMs: 0, scripted: true, stale: false, packetText };
  }

  const guardCtx = { task: call.task, forbidden: packet.forbidden, verifierMisconception: call.verifierMisconception, verdict: packet.verdict };
  let totalLatency = 0;
  let lastReason = '';
  // Second attempt goes to the cloud when the first went down the device path ("cloud rescue"):
  // a fresh on-device retry would cost another slow turn and repeat the same small-model mistake.
  let rescueInCloud = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? packetText : `${packetText}\n\nYour previous reply was rejected (${lastReason}). Return valid JSON only, with exactly one question and none of the DO NOT SAY strings. Follow the VERDICT line.`;
    const res = await runTutor(prompt, { cloud: rescueInCloud, keepRequestId: attempt > 0 });
    totalLatency += res.latencyMs;
    if (!isCurrent(res.requestId)) {
      return { ...fallback(call), source: res.source, latencyMs: totalLatency, scripted: false, stale: true, packetText };
    }
    if (attempt === 0 && res.devicePath) rescueInCloud = true;
    if (res.text === null) {
      log({ role: 'Scribble', task: call.task, mode: res.mode, source: 'SCRIPTED', latencyMs: res.latencyMs, validation: 'error', note: res.timedOut ? 'on-device reply too slow' : res.error });
      if (attempt === 0 && res.devicePath && res.error !== 'Firebase not configured') {
        lastReason = res.timedOut ? 'too slow' : 'error';
        continue; // cloud rescue
      }
      break; // cloud failure or no config: go straight to the authored line
    }
    const parsed = parseJsonLoose(res.text);
    if (!parsed.ok) {
      lastReason = 'invalid JSON';
      log({ role: 'Scribble', task: call.task, mode: res.mode, source: res.source, latencyMs: res.latencyMs, validation: 'failed', note: 'invalid JSON' });
      continue;
    }
    const g = applyGuards(parsed.value, guardCtx);
    if (!g.ok) {
      lastReason = g.reason;
      log({ role: 'Scribble', task: call.task, mode: res.mode, source: res.source, latencyMs: res.latencyMs, validation: 'failed', note: g.reason });
      continue;
    }
    log({
      role: 'Scribble', task: call.task, mode: res.mode, source: res.source, latencyMs: res.latencyMs,
      validation: attempt > 0 ? 'retried' : parsed.repaired || g.notes.length ? 'repaired' : 'valid',
      note: g.notes.join(', ') || undefined,
    });
    return { message: g.response.tutor_message, response: g.response, source: res.source, latencyMs: totalLatency, scripted: false, stale: false, packetText };
  }
  const fb = fallback(call);
  log({ role: 'Scribble', task: call.task, mode: '-', source: 'SCRIPTED', latencyMs: 0, validation: 'failed', note: `authored fallback${lastReason ? ` after: ${lastReason}` : ''}` });
  return { ...fb, source: 'SCRIPTED', latencyMs: totalLatency, scripted: true, stale: false, packetText };
}

export const resetProblemCalls = (problemId: string) => callsByProblem.delete(problemId);

// ---------- authored fallbacks (correct by construction: built from content and verifier facts) ----------

const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const ensureQuestion = (s: string) => (s.includes('?') ? s : `${s} What do you notice?`);

function base(partial: Partial<TutorResponse> & { tutor_message: string }): TutorResponse {
  return {
    response_type: 'question', feedback_type: 'neutral', detected_misconception: 'none',
    understanding_signal: 'partial', explanation_quality: 'not_applicable', should_advance: false, confidence: 1,
    ...partial,
  };
}

export function heuristicExplanation(text: string): ExplanationQuality {
  const t = text.toLowerCase();
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < 3) return 'missing';
  const why = /(both sides|balance|balanced|undo|undoes|opposite|inverse|cancel|same to|keep it equal|equal)/.test(t);
  return why && words >= 6 ? 'sound' : 'partial';
}

function fallback(call: TutorCall): Pick<NovaReply, 'message' | 'response'> {
  const p: Problem = call.problem;
  const s: ProblemState = call.state;
  const packet = buildPacket(call);
  const next = lc(packet.step.nextObjective);
  const h1 = p.hints['1'];
  let r: TutorResponse;
  switch (call.task) {
    case 'respond_to_line': {
      const l = call.lastLine;
      if (!l) r = base({ tutor_message: ensureQuestion(h1) });
      else if (l.status === 'changed') {
        r = base({
          response_type: 'feedback_question', feedback_type: 'correct_error',
          tutor_message: l.slip
            ? `Your method looks right. Check the arithmetic on line ${l.lineNumber}: does it really give that?`
            : `Line ${l.lineNumber} changed the solution. What did you do to the left side there, and what did you do to the right?`,
          detected_misconception: call.verifierMisconception ?? 'none',
        });
      } else if (l.status === 'unreadable') r = base({ tutor_message: `${l.message} Can you rewrite that line?` });
      else if (l.status === 'no_progress') r = base({ feedback_type: 'partial', tutor_message: `That's true, but it isn't simpler yet. What could you do to ${next}?` });
      else r = base({ response_type: 'feedback_question', feedback_type: 'affirm', understanding_signal: 'understands', tutor_message: `That line balances. What's your next move to ${next}?` });
      break;
    }
    case 'respond_to_reply': {
      const k = call.replyKind ?? 'normal';
      if (k === 'answer_request') r = base({ response_type: 'redirect', tutor_message: `I won't hand you the answer, because you can get there yourself. ${ensureQuestion(h1)}` });
      else if (k === 'frustrated') r = base({ feedback_type: 'encourage', tutor_message: `Fair enough, this one is tricky. Let's make it smaller. ${ensureQuestion(h1)}` });
      else if (k === 'idk') r = base({ understanding_signal: 'confused', tutor_message: `Let's make it smaller. ${ensureQuestion(h1)}` });
      else r = base({ understanding_signal: 'partial', should_advance: s.stage === 'ORIENT', tutor_message: `Good, keep going. What could you try to ${next}?` });
      break;
    }
    case 'phrase_hint':
      r = base({ response_type: 'hint', tutor_message: ensureQuestion(call.authoredHint ?? h1) });
      break;
    case 'evaluate_explanation': {
      const q = heuristicExplanation(call.lastStudentInput ?? '');
      r = base({
        explanation_quality: q, feedback_type: q === 'sound' ? 'affirm' : 'partial',
        tutor_message: q === 'sound' ? 'Clear reasoning. Ready to try a new problem that uses the same idea?' : 'Nearly. Why does doing it to both sides keep the equation true?',
      });
      break;
    }
    case 'verify_prompt':
      r = base({ response_type: 'feedback_question', feedback_type: 'affirm', tutor_message: p.verifier === 'linearEquation'
        ? `x is on its own. How could you check your value works in the original equation?`
        : `That's a single value. How could you double-check it?` });
      break;
    case 'celebrate':
      r = base({ response_type: 'celebrate', feedback_type: 'affirm', understanding_signal: 'understands', tutor_message: s.selfCorrections > 0
        ? 'You caught and fixed your own mistake. That is exactly how strong mathematicians work.'
        : s.hintLevel === 0 ? 'Solved with no hints. Your reasoning carried you all the way.' : 'Solved, and you explained it. That idea is yours now.' });
      break;
  }
  return { message: r.tutor_message, response: r };
}

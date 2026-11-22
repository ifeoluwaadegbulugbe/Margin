/**
 * The correctness authority. Every line and final answer is judged here, never by the model.
 */
import type { Problem } from '@/content/schema';
import { isMisconceptionId, type MisconceptionId } from '@/content/misconceptions';
import {
  approxEqual,
  complexity,
  evaluate,
  formatNumber,
  isIsolated,
  normalise,
  parseEquation,
  parseExpr,
  signFlipVariants,
  solveLinear,
} from './linear';

export type LineStatus = 'balanced' | 'no_progress' | 'changed' | 'unreadable';

export interface LineResult {
  status: LineStatus;
  progress: boolean;
  /** Line is "x = number" (linear) or a plain number (numeric) and still correct. */
  solved: boolean;
  /** The value this line implies (solution for equations, value for expressions). */
  now: number | null;
  misconception: MisconceptionId | null;
  misconceptionSource: 'distractor' | 'signature' | null;
  /** Method looked sound; error appears to be arithmetic in the final step only. */
  slip: boolean;
  /** Student-facing one-line reason (never reveals the answer). */
  message: string;
  /** Fact for the tutor packet. */
  fact: string;
  complexity: number;
}

const unreadable = (message: string, fact: string): LineResult => ({
  status: 'unreadable', progress: false, solved: false, now: null, misconception: null,
  misconceptionSource: null, slip: false, message, fact, complexity: Infinity,
});

function matchDistractor(problem: Problem, value: number): MisconceptionId | null {
  const d = problem.distractors.find((d) => Math.abs(d.value - value) <= 1e-4 * Math.max(1, Math.abs(value)));
  return d && isMisconceptionId(d.misconception) ? d.misconception : null;
}

/** Complexity of the problem statement or a previous line; null when it is not maths (word problems). */
export function lineComplexity(problem: Problem, text: string): number | null {
  if (problem.verifier === 'linearEquation') {
    const p = parseEquation(text, problem.variable ?? 'x');
    if (!p.ok) return null;
    return complexity(p.left, problem.variable ?? 'x') + complexity(p.right, problem.variable ?? 'x') + bothSidesPenalty(p.left, p.right, problem.variable ?? 'x');
  }
  const p = parseExpr(text, null);
  return p.ok ? complexity(p.node, null) : null;
}

function bothSidesPenalty(l: import('mathjs').MathNode, r: import('mathjs').MathNode, v: string) {
  const has = (n: import('mathjs').MathNode) => {
    let f = false;
    n.traverse((m: import('mathjs').MathNode) => {
      if (m.type === 'SymbolNode' && (m as unknown as { name: string }).name === v) f = true;
    });
    return f;
  };
  return has(l) && has(r) ? 1 : 0;
}

export interface VerifyContext {
  /** Previous accepted line, or the statement for line 1. */
  prevText: string;
  /** Whether prevText was itself balanced (true for the statement). */
  prevBalanced: boolean;
  lineNumber: number;
}

export function verifyLine(problem: Problem, text: string, ctx: VerifyContext): LineResult {
  if (!text.trim()) return unreadable('Write a line of working first.', `Line ${ctx.lineNumber} was empty.`);
  return problem.verifier === 'linearEquation' ? verifyEquationLine(problem, text, ctx) : verifyNumericLine(problem, text, ctx);
}

function verifyEquationLine(problem: Problem, text: string, ctx: VerifyContext): LineResult {
  const v = problem.variable ?? 'x';
  const p = parseEquation(text, v);
  const L = ctx.lineNumber;
  if (!p.ok) {
    return unreadable(
      `I couldn't read that (${p.reason}). Try something like 3x - 6 = 12.`,
      `Line ${L} "${text}" could not be read (${p.reason}).`,
    );
  }
  const sol = solveLinear(p.left, p.right);
  const cx = complexity(p.left, v) + complexity(p.right, v) + bothSidesPenalty(p.left, p.right, v);
  if (sol.kind === 'nonlinear') {
    return unreadable(`That isn't a straight-line equation in ${v}. Check for x² or x in a denominator.`, `Line ${L} "${text}" is not linear in ${v}.`);
  }
  const prevCx = lineComplexity(problem, ctx.prevText);
  const base = { complexity: cx, slip: false, misconception: null, misconceptionSource: null } as const;

  if (sol.kind === 'identity' || sol.kind === 'none') {
    return {
      ...base, status: 'changed', progress: false, solved: false, now: null,
      message: sol.kind === 'identity'
        ? `This line is true for every ${v}, so it no longer pins ${v} down. Something got lost.`
        : `This line has no solution at all, so the balance broke somewhere.`,
      fact: `Line ${L} "${text}" CHANGED the equation: it is ${sol.kind === 'identity' ? 'true for every x' : 'never true'}.`,
    };
  }

  const now = sol.value;
  const isolated = isIsolated(p.left, p.right, v);
  if (approxEqual(now, problem.answer)) {
    const progress = prevCx === null ? true : cx < prevCx || isolated;
    return {
      ...base,
      status: progress ? 'balanced' : 'no_progress',
      progress,
      solved: isolated,
      now,
      message: progress
        ? isolated ? `Balanced, and ${v} is on its own.` : 'Balanced: same solution, one step closer.'
        : 'True, but not simpler than the line before.',
      fact: progress
        ? `Line ${L} "${text}" is balanced (progress)${isolated ? `; ${v} is isolated` : ''}.`
        : `Line ${L} "${text}" is balanced but makes no progress.`,
    };
  }

  // Solution changed: find the most likely misconception deterministically.
  let misconception: MisconceptionId | null = matchDistractor(problem, now);
  let source: LineResult['misconceptionSource'] = misconception ? 'distractor' : null;
  const prev = parseEquation(ctx.prevText, v);
  if (!misconception && prev.ok) {
    const sameL = normalise(p.leftText) === normalise(prev.leftText);
    const sameR = normalise(p.rightText) === normalise(prev.rightText);
    if (sameL !== sameR) {
      misconception = 'M-ONE-SIDE';
      source = 'signature';
    } else {
      const flips = [
        ...signFlipVariants(prev.left).map((l) => solveLinear(l, prev.right)),
        ...signFlipVariants(prev.right).map((r) => solveLinear(prev.left, r)),
      ];
      if (flips.some((s) => s.kind === 'unique' && approxEqual(s.value, now, 1e-6))) {
        misconception = 'M-SIGN-MOVE';
        source = 'signature';
      }
    }
  }
  const slip = !misconception && isolated && ctx.prevBalanced && prevCx !== null && prevCx <= 3;
  return {
    ...base,
    status: 'changed',
    progress: false,
    solved: false,
    now,
    misconception,
    misconceptionSource: source,
    slip,
    message: slip
      ? `Your method is right, but this gives ${v} = ${formatNumber(now)}. Check the arithmetic.`
      : `Solution changed: this line gives ${v} = ${formatNumber(now)}, the line before doesn't.`,
    fact: `Line ${L} "${text}" CHANGED the solution (now ${v}=${formatNumber(now)}).${misconception ? ` Likely misconception: ${misconception}.` : ''}${slip ? ' Looks like an arithmetic slip in the last step only.' : ''}`,
  };
}

function verifyNumericLine(problem: Problem, text: string, ctx: VerifyContext): LineResult {
  const L = ctx.lineNumber;
  const p = parseExpr(text, null);
  if (!p.ok) {
    return unreadable(`I couldn't read that (${p.reason}). Try something like 4 + 6.`, `Line ${L} "${text}" could not be read.`);
  }
  const now = evaluate(p.node);
  if (!Number.isFinite(now)) return unreadable('That divides by zero somewhere.', `Line ${L} "${text}" divides by zero.`);
  const cx = complexity(p.node, null);
  const prevCx = lineComplexity(problem, ctx.prevText);
  let top = p.node;
  while (top.type === 'ParenthesisNode') top = (top as unknown as { content: typeof top }).content;
  const plain = top.type === 'ConstantNode' ||
    (top.type === 'OperatorNode' && ['unaryMinus', 'divide'].includes((top as unknown as { fn: string }).fn) && cx <= 2);
  if (approxEqual(now, problem.answer, 1e-9)) {
    // numeric rewrites (4 - (-6) -> 4 + 6, 1/3 -> 4/12) are progress even when the leaf count stays the same
    const changedForm = normalise(text) !== normalise(ctx.prevText);
    const progress = prevCx === null ? true : changedForm && cx <= prevCx + 1;
    const simplestOk = !(plain && problem.requireSimplest && !isSimplest(text));
    return {
      status: progress ? 'balanced' : 'no_progress', progress, solved: plain && simplestOk, now,
      misconception: null, misconceptionSource: null, slip: false, complexity: cx,
      message: progress ? (plain && !simplestOk ? 'Equal, but it can be simplified further.' : 'Correct so far: same value, one step closer.') : 'True, but not simpler than before.',
      fact: `Line ${L} "${text}" keeps the same value (${progress ? 'progress' : 'no progress'}).`,
    };
  }
  let misconception = matchDistractor(problem, now);
  let source: LineResult['misconceptionSource'] = misconception ? 'distractor' : null;
  if (!misconception && approxEqual(-now, problem.answer, 1e-9) && problem.answer !== 0) {
    misconception = problem.skillId === 'neg-numbers' || problem.skillId === 'order-ops' ? 'M-NEG-MULT' : null;
    source = misconception ? 'signature' : null;
  }
  return {
    status: 'changed', progress: false, solved: false, now, misconception, misconceptionSource: source,
    slip: false, complexity: cx,
    message: `This changes the value: it works out to ${formatNumber(now)}, which doesn't match the line before.`,
    fact: `Line ${L} "${text}" CHANGED the value (now ${formatNumber(now)}).${misconception ? ` Likely misconception: ${misconception}.` : ''}`,
  };
}

function isSimplest(text: string): boolean {
  let s = normalise(text);
  while (/^\(.*\)$/.test(s)) s = s.slice(1, -1);
  const m = s.match(/^(-?)(\d+)\/(\d+)$/);
  if (!m) return true;
  return gcd(Number(m[2]), Number(m[3])) === 1;
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export interface FinalResult {
  correct: boolean;
  readable: boolean;
  value: number | null;
  notSimplest: boolean;
  misconception: MisconceptionId | null;
  message: string;
}

/** Check the final answer box ("x = ___" or the value of an expression). */
export function verifyFinal(problem: Problem, raw: string): FinalResult {
  const v = problem.variable ?? 'x';
  const text = normalise(raw).replace(new RegExp(`^${v}=`), '');
  const p = parseExpr(text, null);
  if (!p.ok) return { correct: false, readable: false, value: null, notSimplest: false, misconception: null, message: 'Type a number, like 6 or 9/4.' };
  const value = evaluate(p.node);
  const correct = approxEqual(value, problem.answer, 1e-6);
  const notSimplest = correct && !!problem.requireSimplest && !isSimplest(text);
  const misconception = correct ? null : matchDistractor(problem, value);
  return {
    correct: correct && !notSimplest,
    readable: true,
    value,
    notSimplest,
    misconception,
    message: correct ? (notSimplest ? 'Right value. Can you simplify it fully?' : 'Correct!') : 'Not quite. Let’s find the line where it changed.',
  };
}

/** Which authored step the student is working towards, judged from their last good line. */
export function currentStepIndex(problem: Problem, lastGoodText: string): number {
  const cx = lineComplexity(problem, lastGoodText);
  if (cx === null) return 0;
  for (let i = 0; i < problem.steps.length; i++) {
    const ex = lineComplexity(problem, problem.steps[i].exampleLine);
    if (ex !== null && ex < cx) return i;
  }
  return problem.steps.length - 1;
}

/** Strings the tutor must never say before VERIFY: final-answer forms and the next step's result. */
export function forbiddenStrings(problem: Problem, stepIndex: number): string[] {
  const v = problem.variable ?? 'x';
  const a = formatNumber(problem.answer);
  const inStatement = (s: string) => new RegExp(`(^|[^0-9.])${s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}($|[^0-9.])`).test(problem.statement);
  const out = new Set<string>();
  if (!inStatement(a)) out.add(a);
  if (problem.verifier === 'linearEquation') {
    out.add(`${v} = ${a}`);
    out.add(`${v}=${a}`);
  }
  const step = problem.steps[stepIndex];
  if (step && !problem.transferOnly) {
    out.add(step.exampleLine);
    const rhs = step.exampleLine.split('=').pop()?.trim();
    if (rhs && problem.verifier === 'linearEquation' && /^-?\d+(\.\d+)?$/.test(rhs) && !inStatement(rhs)) out.add(rhs);
  }
  return [...out];
}

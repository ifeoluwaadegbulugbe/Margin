/**
 * Deterministic algebra core. No React, no Firebase, no AI.
 * Parses student lines with mathjs, then evaluates the AST with a tiny whitelisted
 * evaluator (only numbers, the variable, + - * / ^ and brackets are allowed).
 */
import { parse, type MathNode } from 'mathjs';

export const EPS = 1e-6;

export type Parsed =
  | { ok: true; node: MathNode }
  | { ok: false; reason: string };

/** Normalise typographic maths into ASCII and make implicit multiplication explicit. */
export function normalise(raw: string): string {
  let s = raw
    .replace(/[−‒–—﹣－]/g, '-') // minus variants
    .replace(/[×⋅·✕]/g, '*') // times variants
    .replace(/[²]/g, '^2')
    .replace(/[³]/g, '^3')
    .replace(/\s+/g, '')
    // a typed fraction a/b binds tighter than a written ÷ (3/4 ÷ 1/2 means (3/4)/(1/2))
    .replace(/(^|[^0-9.)])(\d+(?:\.\d+)?\/\d+(?:\.\d+)?)(?![0-9.(a-z^])/g, '$1($2)')
    .replace(/÷/g, '/')
    .replace(/^=+/, '') // "= 10" written as a numeric working line
    .toLowerCase();
  // implicit multiplication: 3x, 3(…), )(, )x, x(, )3, x3 is left alone (unreadable on purpose)
  s = s.replace(/(\d|\.)([a-z(])/g, '$1*$2');
  s = s.replace(/\)([a-z0-9(])/g, ')*$1');
  s = s.replace(/([a-z])\(/g, '$1*(');
  return s;
}

const ALLOWED_OPS = new Set(['+', '-', '*', '/', '^']);

/** Parse one side of an equation (or a plain expression). */
export function parseExpr(raw: string, variable: string | null): Parsed {
  const s = normalise(raw);
  if (!s) return { ok: false, reason: 'empty' };
  if (/[^0-9a-z+\-*/^().]/.test(s)) return { ok: false, reason: 'unknown symbol' };
  let node: MathNode;
  try {
    node = parse(s);
  } catch {
    return { ok: false, reason: 'parse error' };
  }
  const bad = findIllegal(node, variable);
  if (bad) return { ok: false, reason: bad };
  return { ok: true, node };
}

function findIllegal(node: MathNode, variable: string | null): string | null {
  let problem: string | null = null;
  node.traverse((n: MathNode) => {
    if (problem) return;
    switch (n.type) {
      case 'ConstantNode':
        if (typeof (n as unknown as { value: unknown }).value !== 'number') problem = 'non-numeric constant';
        break;
      case 'SymbolNode': {
        const name = (n as unknown as { name: string }).name;
        if (name !== variable) problem = `unknown symbol ${name}`;
        break;
      }
      case 'OperatorNode': {
        const op = (n as unknown as { op: string; fn: string }).op;
        if (!ALLOWED_OPS.has(op)) problem = `operator ${op}`;
        break;
      }
      case 'ParenthesisNode':
        break;
      default:
        problem = `unsupported ${n.type}`;
    }
  });
  return problem;
}

/** Evaluate a validated AST at a value of the variable. */
export function evaluate(node: MathNode, x = 0): number {
  switch (node.type) {
    case 'ConstantNode':
      return (node as unknown as { value: number }).value;
    case 'SymbolNode':
      return x;
    case 'ParenthesisNode':
      return evaluate((node as unknown as { content: MathNode }).content, x);
    case 'OperatorNode': {
      const { fn, args } = node as unknown as { fn: string; args: MathNode[] };
      const a = evaluate(args[0], x);
      if (fn === 'unaryMinus') return -a;
      if (fn === 'unaryPlus') return a;
      const b = evaluate(args[1], x);
      switch (fn) {
        case 'add': return a + b;
        case 'subtract': return a - b;
        case 'multiply': return a * b;
        case 'divide': return a / b;
        case 'pow': return Math.pow(a, b);
      }
      throw new Error(`fn ${fn}`);
    }
  }
  throw new Error(`node ${node.type}`);
}

/** Leaf count plus penalties for bracketed variable groups: a "how unsolved is this" score. */
export function complexity(node: MathNode, variable: string | null): number {
  let score = 0;
  node.traverse((n: MathNode) => {
    if (n.type === 'ConstantNode' || n.type === 'SymbolNode') score += 1;
    if (n.type === 'ParenthesisNode' && variable && containsVar(n, variable)) score += 1;
  });
  return score;
}

export function containsVar(node: MathNode, variable: string): boolean {
  let found = false;
  node.traverse((n: MathNode) => {
    if (n.type === 'SymbolNode' && (n as unknown as { name: string }).name === variable) found = true;
  });
  return found;
}

export type EquationParse =
  | { ok: true; left: MathNode; right: MathNode; leftText: string; rightText: string }
  | { ok: false; reason: string };

export function parseEquation(raw: string, variable: string): EquationParse {
  const s = normalise(raw);
  const parts = s.split('=');
  if (parts.length !== 2) return { ok: false, reason: parts.length < 2 ? 'no equals sign' : 'more than one equals sign' };
  const l = parseExpr(parts[0], variable);
  if (!l.ok) return l;
  const r = parseExpr(parts[1], variable);
  if (!r.ok) return r;
  return { ok: true, left: l.node, right: r.node, leftText: parts[0], rightText: parts[1] };
}

export type Solution =
  | { kind: 'unique'; value: number }
  | { kind: 'identity' }
  | { kind: 'none' }
  | { kind: 'nonlinear' };

/** Solve L(x) = R(x) assuming linearity; detect non-linear equations by finite differences. */
export function solveLinear(left: MathNode, right: MathNode): Solution {
  const f = (x: number) => evaluate(left, x) - evaluate(right, x);
  const f0 = f(0), f1 = f(1), f2 = f(2), f3 = f(-3);
  if (![f0, f1, f2, f3].every(Number.isFinite)) return { kind: 'nonlinear' };
  const a = f1 - f0;
  const tol = 1e-9 * Math.max(1, Math.abs(f0), Math.abs(f1), Math.abs(f2));
  if (Math.abs(f2 - f1 - a) > tol || Math.abs(f3 - (f0 - 3 * a)) > tol * 10) return { kind: 'nonlinear' };
  if (Math.abs(a) < 1e-12) return Math.abs(f0) < 1e-12 ? { kind: 'identity' } : { kind: 'none' };
  return { kind: 'unique', value: -f0 / a };
}

export function solveText(raw: string, variable = 'x'): Solution | null {
  const p = parseEquation(raw, variable);
  if (!p.ok) return null;
  return solveLinear(p.left, p.right);
}

export const approxEqual = (a: number, b: number, eps = EPS) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

/** Is this line "x = number" (either way round)? */
export function isIsolated(left: MathNode, right: MathNode, variable: string): boolean {
  const bare = (n: MathNode) => {
    let m = n;
    while (m.type === 'ParenthesisNode') m = (m as unknown as { content: MathNode }).content;
    return m.type === 'SymbolNode';
  };
  return (bare(left) && !containsVar(right, variable)) || (bare(right) && !containsVar(left, variable));
}

/** Pretty-print a number: integers as-is, simple fractions as a/b, otherwise 2-dp. */
export function formatNumber(v: number): string {
  if (Number.isInteger(v)) return String(v);
  for (let d = 2; d <= 12; d++) {
    const n = v * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return `${Math.round(n)}/${d}`;
  }
  return v.toFixed(2);
}

/** Every constant node in the tree, with a function that returns a copy with that constant negated. */
export function signFlipVariants(node: MathNode): MathNode[] {
  const out: MathNode[] = [];
  const constants: MathNode[] = [];
  node.traverse((n: MathNode) => {
    if (n.type === 'ConstantNode') constants.push(n);
  });
  for (const target of constants) {
    out.push(
      node.transform((n: MathNode) => {
        if (n === target) {
          const v = (n as unknown as { value: number }).value;
          return parse(String(-v));
        }
        return n;
      }),
    );
  }
  return out;
}

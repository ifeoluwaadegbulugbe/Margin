import { describe, expect, it } from 'vitest';
import { PROBLEMS, SKILLS, getProblem } from '@/content';
import { approxEqual, evaluate, parseExpr, solveText } from '@/lib/learning/linear';
import { verifyLine } from '@/lib/learning/verify';

function valueOf(p: (typeof PROBLEMS)[number], text: string): number | null {
  if (p.verifier === 'linearEquation') {
    const s = solveText(text, p.variable ?? 'x');
    return s?.kind === 'unique' ? s.value : null;
  }
  const e = parseExpr(text, null);
  return e.ok ? evaluate(e.node) : null;
}

describe('content bank', () => {
  it('has 40 problems across 5 skills', () => {
    expect(PROBLEMS.length).toBe(40);
    expect(SKILLS.length).toBe(5);
  });
  it('ids are unique', () => expect(new Set(PROBLEMS.map((p) => p.id)).size).toBe(PROBLEMS.length));
  it('every prerequisite exists', () => {
    for (const s of SKILLS) for (const pre of s.prerequisites) expect(SKILLS.some((k) => k.id === pre)).toBe(true);
  });

  for (const p of PROBLEMS) {
    describe(p.id, () => {
      it('skill exists', () => expect(SKILLS.some((s) => s.id === p.skillId)).toBe(true));
      it('statement re-solves to the answer', () => {
        if (p.transferOnly) return; // word problem: the first step's equation is checked instead
        const v = valueOf(p, p.statement);
        expect(v).not.toBeNull();
        expect(approxEqual(v!, p.answer, 1e-6)).toBe(true);
      });
      it('every example step line is balanced', () => {
        for (const s of p.steps) {
          const v = valueOf(p, s.exampleLine);
          expect(v, `${p.id} step ${s.id}: ${s.exampleLine}`).not.toBeNull();
          expect(approxEqual(v!, p.answer, 1e-6), `${p.id} step ${s.id}`).toBe(true);
          for (const alt of s.alt ?? []) expect(approxEqual(valueOf(p, alt)!, p.answer, 1e-6)).toBe(true);
        }
      });
      it('example steps make progress through the verifier', () => {
        let prev = p.statement;
        p.steps.forEach((s, i) => {
          const r = verifyLine(p, s.exampleLine, { prevText: prev, prevBalanced: true, lineNumber: i + 1 });
          expect(['balanced'], `${p.id} step ${s.id} "${s.exampleLine}" -> ${r.status}`).toContain(r.status);
          prev = s.exampleLine;
        });
      });
      it('distractors differ from the answer', () => {
        for (const d of p.distractors) expect(approxEqual(d.value, p.answer, 1e-4)).toBe(false);
      });
      it('parallel example (H4) has a different answer and its lines check out', () => {
        const h4 = p.hints['4'];
        expect(approxEqual(h4.answer, p.answer, 1e-6)).toBe(false);
        const last = h4.lines[h4.lines.length - 1];
        const lastVal = p.verifier === 'linearEquation' ? valueOf(p, last) : valueOf(p, last);
        expect(lastVal).not.toBeNull();
        expect(approxEqual(lastVal!, h4.answer, 1e-6), `${p.id} H4 last line`).toBe(true);
        for (const l of h4.lines) expect(approxEqual(valueOf(p, l)!, h4.answer, 1e-6), `${p.id} H4 "${l}"`).toBe(true);
      });
      it('hints 1-3 never contain the answer as a standalone number', () => {
        const a = Number.isInteger(p.answer) ? String(p.answer) : null;
        if (!a) return;
        const tok = new RegExp(`(^|[^0-9.])${a.replace('-', '\\-')}($|[^0-9.])`);
        if (tok.test(p.statement)) return; // the number is part of the question itself
        const re = new RegExp(`(^|[^0-9a-z.])${a.replace('-', '\\-')}($|[^0-9a-z.])`, 'i');
        for (const k of ['1', '2', '3'] as const) expect(re.test(p.hints[k]), `${p.id} hint ${k}: ${p.hints[k]}`).toBe(false);
      });
      it('transfer target exists', () => {
        if (p.transferId) expect(getProblem(p.transferId)).toBeDefined();
      });
    });
  }
});

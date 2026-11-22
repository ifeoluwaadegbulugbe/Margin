import { describe, expect, it } from 'vitest';
import { getProblem } from '@/content';
import { normalise, solveText, formatNumber } from '@/lib/learning/linear';
import { verifyLine, verifyFinal, currentStepIndex, forbiddenStrings } from '@/lib/learning/verify';

const P = (id: string) => {
  const p = getProblem(id);
  if (!p) throw new Error(id);
  return p;
};
const line = (id: string, text: string, prev?: string, n = 1) =>
  verifyLine(P(id), text, { prevText: prev ?? P(id).statement, prevBalanced: true, lineNumber: n });

describe('normalise', () => {
  it('handles unicode minus and times', () => expect(normalise('3x − 6 = 12')).toBe('3*x-6=12'));
  it('adds implicit multiplication before brackets', () => expect(normalise('3(x-2)')).toBe('3*(x-2)'));
  it('handles bracket followed by bracket', () => expect(normalise('(x+1)(2)')).toBe('(x+1)*(2)'));
  it('strips a leading equals sign', () => expect(normalise('= 10')).toBe('10'));
  it('maps ÷ and ×', () => expect(normalise('6 ÷ 3 × 2')).toBe('6/3*2'));
});

describe('solveText', () => {
  const cases: [string, number][] = [
    ['3(x - 2) = 12', 6], ['2x + 5 = 17', 6], ['x/4 - 3 = 2', 20], ['-3x + 4 = 19', -5],
    ['5x + 3 = 2x + 18', 5], ['4(x - 1) = 2(x + 3)', 5], ['6x - 5 = 2x + 4', 2.25],
    ['12 = 3x - 6', 6], ['10 + 2x = 4 + 3.5x', 4], ['x = 7', 7],
  ];
  for (const [eq, v] of cases) {
    it(`${eq} -> ${v}`, () => {
      const s = solveText(eq);
      expect(s?.kind).toBe('unique');
      if (s?.kind === 'unique') expect(s.value).toBeCloseTo(v, 9);
    });
  }
  it('detects identity', () => expect(solveText('2x + 2 = 2(x + 1)')?.kind).toBe('identity'));
  it('detects no solution', () => expect(solveText('2x + 1 = 2x + 3')?.kind).toBe('none'));
  it('rejects non-linear', () => expect(solveText('x^2 = 4')?.kind).toBe('nonlinear'));
  it('rejects unknown variables', () => expect(solveText('y + 2 = 5')).toBeNull());
  it('rejects two equals signs', () => expect(solveText('x = 2 = 2')).toBeNull());
});

describe('verifyLine: linear equations', () => {
  it('balanced with progress when expanding a bracket', () => {
    const r = line('MS-02', '3x - 6 = 12');
    expect(r.status).toBe('balanced');
    expect(r.progress).toBe(true);
  });
  it('balanced when dividing first', () => expect(line('MS-02', 'x - 2 = 4').status).toBe('balanced'));
  it('flags the sign-move error from a distractor', () => {
    const r = line('MS-02', '3x = 6', '3x - 6 = 12', 2);
    expect(r.status).toBe('changed');
    expect(r.misconception).toBe('M-SIGN-MOVE');
    expect(r.now).toBeCloseTo(2);
  });
  it('flags distribute-first', () => {
    const r = line('MS-02', '3x - 2 = 12');
    expect(r.misconception).toBe('M-DIST-FIRST');
  });
  it('flags one-side change by signature', () => {
    const r = line('TS-03', '2x = 17', '2x + 5 = 17');
    expect(r.status).toBe('changed');
    expect(r.misconception).toBe('M-ONE-SIDE');
  });
  it('flags sign flip by signature when no distractor matches', () => {
    const r = line('TS-03', '2x = 17 + 5', '2x + 5 = 17');
    expect(r.misconception).toBe('M-SIGN-MOVE');
  });
  it('no progress for a swapped equation', () => expect(line('TS-03', '17 = 2x + 5').status).toBe('no_progress'));
  it('marks solved when x is isolated', () => {
    const r = line('TS-03', 'x = 6', '2x = 12', 2);
    expect(r.solved).toBe(true);
    expect(r.status).toBe('balanced');
  });
  it('accepts x = 12/2 as isolated', () => expect(line('TS-03', 'x = 12/2', '2x = 12').solved).toBe(true));
  it('accepts unicode minus', () => expect(line('MS-02', '3x − 6 = 12').status).toBe('balanced'));
  it('reports unreadable for garbage', () => expect(line('MS-02', 'banana').status).toBe('unreadable'));
  it('reports unreadable without equals', () => expect(line('MS-02', '3x - 6').status).toBe('unreadable'));
  it('detects arithmetic slip on final line', () => {
    const r = line('TS-03', 'x = 5', '2x = 12', 2);
    expect(r.status).toBe('changed');
    expect(r.slip).toBe(true);
  });
  it('collects x terms with progress', () => expect(line('MS-03', '3x + 3 = 18').status).toBe('balanced'));
  it('identity line counts as changed', () => expect(line('MS-03', '3 = 3').status).toBe('changed'));
  it('word problem first line accepted', () => expect(line('TS-08', '3 + 2x = 17').status).toBe('balanced'));
  it('never reveals the answer in a changed-line message', () => {
    const r = line('MS-02', '3x = 6', '3x - 6 = 12', 2);
    expect(r.message).not.toMatch(/x = 6\b/);
  });
});

describe('verifyLine: numeric', () => {
  it('balanced rewrite of subtracting a negative', () => expect(line('NN-02', '4 + 6').status).toBe('balanced'));
  it('M-NEG-SUB from distractor', () => expect(line('NN-02', '4 - 6').misconception).toBe('M-NEG-SUB'));
  it('order-ops left to right', () => expect(line('OO-01', '7 × 2').misconception).toBe('M-BODMAS-LTR'));
  it('fraction add tops and bottoms', () => expect(line('FR-02', '2/7').misconception).toBe('M-FRAC-ADD'));
  it('equivalent fractions are balanced', () => expect(line('FR-02', '4/12 + 3/12').status).toBe('balanced'));
  it('sign-only error on negatives', () => expect(line('NN-03', '-15').misconception).toBe('M-NEG-MULT'));
  it('requireSimplest blocks solved for unsimplified', () => expect(line('FR-04', '18/30').solved).toBe(false));
});

describe('verifyFinal', () => {
  it('accepts x = 6', () => expect(verifyFinal(P('MS-02'), 'x = 6').correct).toBe(true));
  it('accepts bare 6', () => expect(verifyFinal(P('MS-02'), '6').correct).toBe(true));
  it('accepts 9/4 and 2.25', () => {
    expect(verifyFinal(P('MS-06'), '9/4').correct).toBe(true);
    expect(verifyFinal(P('MS-06'), '2.25').correct).toBe(true);
  });
  it('rejects wrong with misconception', () => {
    const r = verifyFinal(P('MS-02'), '2');
    expect(r.correct).toBe(false);
    expect(r.misconception).toBe('M-SIGN-MOVE');
  });
  it('requires simplest form when asked', () => {
    expect(verifyFinal(P('FR-04'), '18/30').correct).toBe(false);
    expect(verifyFinal(P('FR-04'), '3/5').correct).toBe(true);
  });
  it('accepts equivalent fraction forms', () => expect(verifyFinal(P('FR-02'), '7/12').correct).toBe(true));
});

describe('steps and forbidden strings', () => {
  it('step index advances', () => {
    expect(currentStepIndex(P('MS-02'), P('MS-02').statement)).toBe(0);
    expect(currentStepIndex(P('MS-02'), '3x - 6 = 12')).toBe(1);
    expect(currentStepIndex(P('MS-02'), '3x = 18')).toBe(2);
  });
  it('forbids answer forms and next step result', () => {
    const f = forbiddenStrings(P('MS-02'), 1);
    expect(f).toContain('x = 6');
    expect(f).toContain('18');
    expect(f).toContain('3x = 18');
  });
  it('formats fractions', () => expect(formatNumber(2.25)).toBe('9/4'));
});

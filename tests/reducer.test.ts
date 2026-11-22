import { describe, expect, it } from 'vitest';
import { getProblem } from '@/content';
import { classifyReply, initialProblemState, reduceProblem, type ProblemState, type ProblemEvent } from '@/lib/learning/reducer';
import { verifyLine } from '@/lib/learning/verify';

const p = getProblem('TS-03')!;
const run = (events: ProblemEvent[], s: ProblemState = initialProblemState('TS-03', 0)) =>
  events.reduce((acc, e) => reduceProblem(acc, e, 1), s);
const lineEv = (text: string, prev = p.statement): ProblemEvent => ({
  type: 'LINE_VERIFIED', text, result: verifyLine(p, text, { prevText: prev, prevBalanced: true, lineNumber: 1 }),
});

describe('stage machine', () => {
  it('ORIENT -> PLAN on any reply', () => expect(run([{ type: 'STUDENT_REPLY', text: 'find x', kind: 'normal' }]).stage).toBe('PLAN'));
  it('ORIENT -> STEP on a balanced line', () => expect(run([lineEv('2x = 12')]).stage).toBe('STEP'));
  it('model should_advance moves PLAN -> STEP', () => {
    const s = run([
      { type: 'STUDENT_REPLY', text: 'x', kind: 'normal' },
      { type: 'TUTOR_SIGNAL', understanding: 'understands', shouldAdvance: true, explanation: 'not_applicable' },
    ]);
    expect(s.stage).toBe('STEP');
  });
  it('model signal cannot advance STEP', () => {
    const s = run([lineEv('2x = 12'), { type: 'TUTOR_SIGNAL', understanding: 'understands', shouldAdvance: true, explanation: 'not_applicable' }]);
    expect(s.stage).toBe('STEP');
  });
  it('skip-ahead: x = 6 in ORIENT goes to VERIFY and is swift', () => {
    const s = run([lineEv('x = 6')]);
    expect(s.stage).toBe('VERIFY');
    expect(s.swift).toBe(true);
  });
  it('correct final -> EXPLAIN', () => expect(run([lineEv('x = 6'), { type: 'FINAL_ANSWER', correct: true }]).stage).toBe('EXPLAIN'));
  it('wrong final -> STEP', () => expect(run([lineEv('x = 6'), { type: 'FINAL_ANSWER', correct: false }]).stage).toBe('STEP'));
  it('compensating errors stay in STEP', () => {
    const s = run([lineEv('2x = 11'), { type: 'FINAL_ANSWER', correct: true }]);
    expect(s.stage).toBe('STEP');
    expect(s.compensating).toBe(true);
  });
  it('EXPLAIN partial gets one follow-up then advances', () => {
    const sig = (q: 'partial' | 'sound'): ProblemEvent => ({ type: 'TUTOR_SIGNAL', understanding: 'partial', shouldAdvance: false, explanation: q });
    let s = run([lineEv('x = 6'), { type: 'FINAL_ANSWER', correct: true }, sig('partial')]);
    expect(s.stage).toBe('EXPLAIN');
    s = reduceProblem(s, sig('partial'));
    expect(s.stage).toBe('TRANSFER');
    expect(s.explanation).toBe('partial');
  });
  it('TRANSFER done -> COMPLETE', () => {
    const s = run([
      lineEv('x = 6'), { type: 'FINAL_ANSWER', correct: true },
      { type: 'TUTOR_SIGNAL', understanding: 'understands', shouldAdvance: true, explanation: 'sound' },
      { type: 'TRANSFER_START', problemId: 'TS-08' }, { type: 'TRANSFER_DONE', solved: true },
    ]);
    expect(s.stage).toBe('COMPLETE');
    expect(s.transfer?.solved).toBe(true);
  });
  it('self-correction counted when fixed before a hint', () => {
    const s = run([lineEv('2x = 22'), lineEv('2x = 12')]);
    expect(s.selfCorrections).toBe(1);
    expect(s.misconceptions).toContain('M-SIGN-MOVE');
  });
  it('no self-correction credit after a hint', () => {
    const s = run([lineEv('2x = 22'), { type: 'HINT_REQUESTED' }, lineEv('2x = 12')]);
    expect(s.selfCorrections).toBe(0);
  });
  it('repeat wrong line escalates wording', () => expect(run([lineEv('2x = 22'), lineEv('2x = 22')]).autoEscalation).toBe(1));
  it('hint ladder caps at 4', () => {
    const h: ProblemEvent = { type: 'HINT_REQUESTED' };
    expect(run([h, h, h, h, h]).hintLevel).toBe(4);
  });
});

describe('classifyReply', () => {
  it('idk', () => expect(classifyReply('idk')).toBe('idk'));
  it("i don't know", () => expect(classifyReply("I don't know")).toBe('idk'));
  it('answer request', () => expect(classifyReply('just tell me the answer')).toBe('answer_request'));
  it('frustrated', () => expect(classifyReply('this is stupid i hate maths')).toBe('frustrated'));
  it('normal', () => expect(classifyReply('subtract 5')).toBe('normal'));
});

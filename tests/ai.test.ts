import { describe, expect, it } from 'vitest';
import { applyGuards, leaks, parseJsonLoose } from '@/lib/ai/guards';
import { buildPacket, serialisePacket } from '@/lib/ai/packet';
import { validateStrategist, buildRecords } from '@/lib/ai/strategist';
import { getProblem } from '@/content';
import { initialProblemState } from '@/lib/learning/reducer';
import { emptyMastery } from '@/lib/game/mastery';
import { emptyStreak } from '@/lib/game/streak';
import type { SessionRecord, UserProfile } from '@/types/domain';

const good = {
  response_type: 'feedback_question', tutor_message: 'Line 1 was spot on. What undoes subtracting 6?',
  feedback_type: 'correct_error', detected_misconception: 'M-SIGN-MOVE', understanding_signal: 'partial',
  explanation_quality: 'not_applicable', should_advance: false, confidence: 0.8,
};
const ctx = { task: 'respond_to_line' as const, forbidden: ['x = 6', 'x=6', '18', '3x = 18'], verifierMisconception: null };

describe('parseJsonLoose', () => {
  it('parses plain JSON', () => expect(parseJsonLoose('{"a":1}').ok).toBe(true));
  it('repairs code fences', () => {
    const r = parseJsonLoose('```json\n{"a":1}\n```');
    expect(r.ok && r.repaired).toBe(true);
  });
  it('rejects garbage', () => expect(parseJsonLoose('nope').ok).toBe(false));
  it('rejects empty', () => expect(parseJsonLoose('').ok).toBe(false));
});

describe('guards', () => {
  it('accepts a good reply', () => expect(applyGuards(good, ctx).ok).toBe(true));
  it('rejects a forced answer leak', () => {
    const r = applyGuards({ ...good, tutor_message: 'So x = 6. Can you check it?' }, ctx);
    expect(r.ok).toBe(false);
  });
  it('rejects bare next-step result', () => expect(applyGuards({ ...good, tutor_message: 'The right side becomes 18. Why?' }, ctx).ok).toBe(false));
  it('does not flag 18 inside 180 or 3.18', () => expect(leaks('Try 180 or 3.18?', ['18'])).toBeNull());
  it('catches unicode minus forms', () => expect(leaks('x = −4 now?', ['x = -4'])).toBe('x = -4'));
  it('trims to one question', () => {
    const r = applyGuards({ ...good, tutor_message: 'What undoes it? And why?' }, ctx);
    expect(r.ok && r.response.tutor_message).toBe('What undoes it?');
  });
  it('requires a question unless celebrating', () => {
    expect(applyGuards({ ...good, tutor_message: 'Nice work.' }, ctx).ok).toBe(false);
    expect(applyGuards({ ...good, tutor_message: 'Nice work.' }, { ...ctx, task: 'celebrate' }).ok).toBe(true);
  });
  it('blocks belittling tone', () => expect(applyGuards({ ...good, tutor_message: 'This is easy. What next?' }, ctx).ok).toBe(false));
  it('verifier misconception wins', () => {
    const r = applyGuards({ ...good, detected_misconception: 'M-COLLECT' }, { ...ctx, verifierMisconception: 'M-ONE-SIDE' });
    expect(r.ok && r.response.detected_misconception).toBe('M-ONE-SIDE');
  });
  it('low-confidence model guess ignored', () => {
    const r = applyGuards({ ...good, confidence: 0.3 }, ctx);
    expect(r.ok && r.response.detected_misconception).toBe('none');
  });
  it('rejects schema violations', () => expect(applyGuards({ ...good, response_type: 'lecture' }, ctx).ok).toBe(false));
});

describe('packet', () => {
  it('is compact and contains forbidden + watch lines', () => {
    const problem = getProblem('MS-02')!;
    const text = serialisePacket(buildPacket({
      task: 'respond_to_line', problem, state: initialProblemState('MS-02'), skillName: 'Multi-step', yearGroup: 10, tone: 'encouraging',
      facts: ['Line 1 "3x = 6" CHANGED the solution (now x=2).'], lastTutorQuestion: null, lastStudentInput: '3x = 6',
      watchList: ["keeps the original sign when moving a term across '='"], recentTutorQuestions: [],
    }));
    expect(text).toContain('DO NOT SAY: ');
    expect(text).toContain('"x = 6"');
    expect(text).toContain('WATCH:');
    expect(text.length).toBeLessThan(3600);
  });
});

describe('strategist validation', () => {
  const user: UserProfile = {
    uid: 'u', displayName: null, isAnonymous: true, createdAt: 0, yearGroup: 10, tone: 'encouraging', dailyGoal: 2, onboardingStep: 9,
    calibrated: true, activeConstellation: 'algebra-foundations', xp: 0, level: 1, streak: emptyStreak(), todaySolved: { date: '', count: 0 },
    stats: { solved: 0, independent: 0, selfCorrections: 0, sessions: 0 }, sound: false,
  };
  const mastery = { 'neg-numbers': { ...emptyMastery(0.8) }, 'order-ops': { ...emptyMastery(0.7) }, fractions: { ...emptyMastery(0.6) }, 'two-step': { ...emptyMastery(0.4) } };
  const session = (id: string): SessionRecord => ({
    id, expeditionType: 'next', skillId: 'two-step', problemIds: ['TS-03'], reason: '', focus: '', status: 'complete', startedAt: 1, endedAt: 2, currentIndex: 0, currentState: null,
    problems: [{ id: 'TS-03', solved: true, hintMax: 1, lines: 3, errors: [{ line: 1, misconception: 'M-SIGN-MOVE', fixedBySelf: false, text: '', message: '' }], explanation: 'partial', transfer: false, secs: 100, supported: false }],
    inferenceCounts: { onDevice: 0, cloud: 0, scripted: 0 }, xpEarned: 0,
  });
  const input = buildRecords(user, mastery, [session('s1'), session('s2')], {});
  it('clamps inflated evidence and replaces invented ids', () => {
    const { output, adjustments } = validateStrategist({
      recurring_misconceptions: [{ id: 'M-SIGN-MOVE', evidence_count: 9, sessions_seen: 5, severity: 'high', student_explanation: '', nova_watch_phrase: 'signs' },
        { id: 'M-MADE-UP', evidence_count: 2, sessions_seen: 1, severity: 'low', student_explanation: '', nova_watch_phrase: '' }],
      strengths: [], next_expedition: { skill_id: 'two-step', problem_ids: ['TS-07', 'ZZ-99', 'MS-03'], reason: '', focus: '' },
      revision_queue: ['fractions', 'calculus'], difficulty_adjustment: 'same', coach_note: '',
    }, input, mastery);
    expect(output.recurring_misconceptions).toHaveLength(1);
    expect(output.recurring_misconceptions[0].evidence_count).toBe(2);
    expect(output.recurring_misconceptions[0].sessions_seen).toBe(2);
    expect(output.next_expedition.problem_ids).toEqual(['TS-07']); // MS-03 is locked, ZZ-99 invented
    expect(output.revision_queue).toEqual(['fractions']);
    expect(adjustments.length).toBeGreaterThan(0);
  });
});

describe('verdict consistency (small-model safety)', () => {
  const base = { ...good, feedback_type: 'correct_error' };
  it('rejects praise for a line the checker marked wrong', () => {
    const r = applyGuards({ ...base, tutor_message: "You've correctly rewritten 3x = 6. Where did the 3 come from?" }, { ...ctx, verdict: 'WRONG' });
    expect(r.ok).toBe(false);
  });
  it('rejects affirm feedback for a wrong line', () => {
    expect(applyGuards({ ...base, feedback_type: 'affirm', tutor_message: 'What did you do to the -6?' }, { ...ctx, verdict: 'WRONG' }).ok).toBe(false);
  });
  it('allows a neutral question about a wrong line', () => {
    expect(applyGuards({ ...base, tutor_message: 'Line 2 moved the answer. What undoes subtracting 6?' }, { ...ctx, verdict: 'WRONG' }).ok).toBe(true);
  });
  it('allows "not quite right" for a wrong line', () => {
    expect(applyGuards({ ...base, tutor_message: "That's not quite right yet. What happened to the -6?" }, { ...ctx, verdict: 'WRONG' }).ok).toBe(true);
  });
  it('rejects criticism of a correct line', () => {
    expect(applyGuards({ ...good, feedback_type: 'affirm', tutor_message: 'Not quite. What next?' }, { ...ctx, verdict: 'CORRECT' }).ok).toBe(false);
  });
  it('packet states the verdict for a wrong line', () => {
    const problem = getProblem('MS-02')!;
    const text = serialisePacket(buildPacket({
      task: 'respond_to_line', problem, state: initialProblemState('MS-02'), skillName: 'Multi-step', yearGroup: 10, tone: 'encouraging',
      facts: ['Line 2 "3x = 6" CHANGED the solution (now x=2).'], lastTutorQuestion: null, lastStudentInput: '3x = 6', watchList: [], recentTutorQuestions: [],
    }));
    expect(text).toContain("VERDICT: the student's latest line is WRONG");
  });
});

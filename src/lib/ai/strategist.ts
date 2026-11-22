/**
 * The Cartographer: cloud-only cross-session analysis. It never sees chat text, only compact
 * structured records, and can only recommend content that exists (validated against the catalogue).
 */
import { PROBLEMS, SKILLS, getProblem } from '@/content';
import { MISCONCEPTIONS, isMisconceptionId } from '@/content/misconceptions';
import { isUnlocked, type MasteryRecord } from '@/lib/game/mastery';
import { recommend, type Expedition } from '@/lib/learning/recommender';
import { rankTitle } from '@/lib/game/levels';
import type { Insight, MisconceptionCount, SessionRecord, UserProfile } from '@/types/domain';
import { parseJsonLoose } from './guards';
import { runStrategist } from './inference';
import { strategistZ, type StrategistOutput } from './schemas';
import { useAiStatus } from '@/stores/aiStatus';

export interface StrategistInput {
  student: { yearGroup: string | number; goal: number; rank: string };
  mastery: Record<string, number>;
  records: {
    sessionId: string;
    date: string;
    skill: string;
    problems: { id: string; solved: boolean; hintMax: number; lines: number; errors: { misconception: string | null; fixedBySelf: boolean }[]; explanation: string; secs: number }[];
  }[];
  misconceptionTotals: Record<string, { count: number; sessions: number }>;
  catalog: { id: string; skill: string; difficulty: number; targets: string[]; unlocked: boolean }[];
  misconceptionCatalog: Record<string, string>;
}

export function buildRecords(
  user: UserProfile, mastery: Record<string, MasteryRecord>, sessions: SessionRecord[], misconceptions: Record<string, MisconceptionCount>,
): StrategistInput {
  const masteryValues = Object.fromEntries(SKILLS.map((s) => [s.id, Math.round((mastery[s.id]?.value ?? 0) * 100) / 100]));
  return {
    student: { yearGroup: user.yearGroup, goal: user.dailyGoal, rank: rankTitle(user.level) },
    mastery: masteryValues,
    records: sessions.slice(0, 8).map((s) => ({
      sessionId: s.id,
      date: new Date(s.startedAt).toISOString().slice(0, 10),
      skill: s.skillId,
      problems: s.problems.map((p) => ({
        id: p.id, solved: p.solved, hintMax: p.hintMax, lines: p.lines,
        errors: p.errors.map((e) => ({ misconception: e.misconception, fixedBySelf: e.fixedBySelf })),
        explanation: p.explanation, secs: p.secs,
      })),
    })),
    misconceptionTotals: Object.fromEntries(Object.entries(misconceptions).map(([k, v]) => [k, { count: v.count, sessions: v.sessions.length }])),
    catalog: PROBLEMS.filter((p) => !p.transferOnly).map((p) => ({
      id: p.id, skill: p.skillId, difficulty: p.difficulty,
      targets: p.tags.filter((t) => t.startsWith('M-')),
      unlocked: isUnlocked(SKILLS.find((s) => s.id === p.skillId)?.prerequisites ?? [], mastery),
    })),
    misconceptionCatalog: Object.fromEntries(Object.entries(MISCONCEPTIONS).map(([k, v]) => [k, v.name])),
  };
}

/** Evidence counts computed deterministically from the same records the model saw. */
function computedEvidence(input: StrategistInput): Record<string, { count: number; sessions: number }> {
  const out: Record<string, { count: number; sessions: Set<string> }> = {};
  for (const r of input.records) for (const p of r.problems) for (const e of p.errors) {
    if (!e.misconception) continue;
    (out[e.misconception] ??= { count: 0, sessions: new Set() }).count++;
    out[e.misconception].sessions.add(r.sessionId);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { count: v.count, sessions: v.sessions.size }]));
}

/** Validate against the catalogue and clamp inflated claims; returns the adjusted output and notes. */
export function validateStrategist(
  out: StrategistOutput, input: StrategistInput, mastery: Record<string, MasteryRecord>,
): { output: StrategistOutput; adjustments: string[] } {
  const adjustments: string[] = [];
  const evidence = computedEvidence(input);
  const recurring = out.recurring_misconceptions
    .filter((m) => {
      const ok = isMisconceptionId(m.id) && (evidence[m.id]?.count ?? 0) > 0;
      if (!ok) adjustments.push(`dropped unsupported misconception ${m.id}`);
      return ok;
    })
    .map((m) => {
      const ev = evidence[m.id];
      if (m.evidence_count > ev.count || m.sessions_seen > ev.sessions) {
        adjustments.push(`clamped ${m.id} evidence ${m.evidence_count}/${m.sessions_seen} -> ${ev.count}/${ev.sessions}`);
      }
      return { ...m, evidence_count: Math.min(m.evidence_count, ev.count), sessions_seen: Math.min(m.sessions_seen, ev.sessions) };
    });

  const unlockedIds = new Set(input.catalog.filter((c) => c.unlocked).map((c) => c.id));
  let next = out.next_expedition;
  const validIds = next.problem_ids.filter((id) => unlockedIds.has(id));
  const skillOk = SKILLS.some((s) => s.id === next.skill_id) && isUnlocked(SKILLS.find((s) => s.id === next.skill_id)!.prerequisites, mastery);
  if (!skillOk || validIds.length === 0) {
    const fb = recommend(mastery, Object.fromEntries(Object.entries(evidence).map(([k, v]) => [k, v.count])));
    adjustments.push(`replaced next expedition (${next.skill_id}: ${next.problem_ids.join(',')}) with rules choice ${fb.skillId}`);
    next = { ...next, skill_id: fb.skillId, problem_ids: fb.problemIds };
  } else if (validIds.length !== next.problem_ids.length) {
    adjustments.push(`removed unknown or locked problems: ${next.problem_ids.filter((i) => !validIds.includes(i)).join(',')}`);
    next = { ...next, problem_ids: validIds.slice(0, 3) };
  } else next = { ...next, problem_ids: validIds.slice(0, 3) };

  const revision = out.revision_queue.filter((s) => SKILLS.some((k) => k.id === s));
  return { output: { ...out, recurring_misconceptions: recurring, next_expedition: next, revision_queue: revision }, adjustments };
}

export function serialiseStrategistInput(input: StrategistInput, type: Insight['type']): string {
  const task = type === 'weekly'
    ? 'TASK: write a weekly report. Use coach_note for a 2-3 sentence narrative of the week.'
    : type === 'first_route'
      ? 'TASK: the student just finished calibration. Plan their first expedition from the mastery values.'
      : 'TASK: the student just finished a session. Update the misconception profile and plan the next expedition.';
  return `${task}\nINPUT:\n${JSON.stringify(input)}`;
}

export async function runCartographer(
  type: Insight['type'], user: UserProfile, mastery: Record<string, MasteryRecord>, sessions: SessionRecord[], misconceptions: Record<string, MisconceptionCount>,
): Promise<{ ok: true; insight: Insight } | { ok: false; error: string; fallback: Expedition }> {
  const input = buildRecords(user, mastery, sessions, misconceptions);
  const res = await runStrategist(serialiseStrategistInput(input, type));
  const log = useAiStatus.getState().addLog;
  const fallback = recommend(mastery, Object.fromEntries(Object.entries(misconceptions).map(([k, v]) => [k, v.count])), sessions[0]?.problemIds ?? []);
  if (res.text === null) {
    log({ role: 'Guide', task: type, mode: res.mode, source: 'SCRIPTED', latencyMs: res.latencyMs, validation: 'error', note: res.error });
    return { ok: false, error: res.error ?? 'unavailable', fallback };
  }
  const parsed = parseJsonLoose(res.text);
  const z = parsed.ok ? strategistZ.safeParse(parsed.value) : null;
  if (!z || !z.success) {
    log({ role: 'Guide', task: type, mode: res.mode, source: res.source, latencyMs: res.latencyMs, validation: 'failed', note: 'schema' });
    return { ok: false, error: 'The analysis came back malformed.', fallback };
  }
  const { output, adjustments } = validateStrategist(z.data, input, mastery);
  log({ role: 'Guide', task: type, mode: res.mode, source: res.source, latencyMs: res.latencyMs, validation: adjustments.length ? 'repaired' : 'valid', note: adjustments.join('; ') || undefined });
  return {
    ok: true,
    insight: {
      id: `i_${Date.now().toString(36)}`, type, createdAt: Date.now(), source: res.source, latencyMs: res.latencyMs,
      model: res.model, output, adjustments,
    },
  };
}

/** Top-2 Nova watch phrases by severity, from the latest insight (else from deterministic counts). */
export function watchList(insight: Insight | null, misconceptions: Record<string, MisconceptionCount>): { ids: string[]; phrases: string[] } {
  const rank = { high: 3, medium: 2, low: 1 } as const;
  if (insight?.output.recurring_misconceptions.length) {
    const top = [...insight.output.recurring_misconceptions].sort((a, b) => rank[b.severity] - rank[a.severity] || b.evidence_count - a.evidence_count).slice(0, 2);
    return { ids: top.map((t) => t.id), phrases: top.map((t) => t.nova_watch_phrase) };
  }
  const top = Object.entries(misconceptions).filter(([, v]) => v.count >= 2 && v.sessions.length >= 2).sort((a, b) => b[1].count - a[1].count).slice(0, 2);
  return {
    ids: top.map(([k]) => k),
    phrases: top.map(([k]) => (isMisconceptionId(k) ? MISCONCEPTIONS[k].watch : k)),
  };
}

export function expeditionFromInsight(insight: Insight): Expedition {
  const n = insight.output.next_expedition;
  const fixIt = insight.output.recurring_misconceptions.some((m) => m.severity === 'high' && n.problem_ids.some((id) => getProblem(id)?.tags.includes(m.id)));
  return { skillId: n.skill_id, problemIds: n.problem_ids, reason: n.reason, focus: n.focus, source: 'strategist', type: fixIt ? 'fix-it' : 'next' };
}

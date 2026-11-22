/** Validation pipeline: parse -> zod -> semantic guards. Pure, unit-tested. */
import { isMisconceptionId, type MisconceptionId } from '@/content/misconceptions';
import { tutorResponseZ, type TutorResponse } from './schemas';
import type { TutorTask } from './prompts';

export function parseJsonLoose(raw: string | null): { ok: true; value: unknown; repaired: boolean } | { ok: false } {
  if (!raw) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(raw), repaired: false };
  } catch {
    const stripped = raw.replace(/```(?:json)?/gi, '');
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return { ok: true, value: JSON.parse(stripped.slice(start, end + 1)), repaired: true };
      } catch {
        return { ok: false };
      }
    }
    return { ok: false };
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[−–—]/g, '-').replace(/[×]/g, '*').replace(/\s+/g, '');

/** True if the message contains a forbidden string (or the bare number as a standalone token). */
export function leaks(message: string, forbidden: string[]): string | null {
  const flat = norm(message);
  const spaced = message.replace(/[−–—]/g, '-');
  for (const f of forbidden) {
    if (!f.trim()) continue;
    if (/^-?\d+(\.\d+)?(\/\d+)?$/.test(f.trim())) {
      const esc = f.trim().replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
      if (new RegExp(`(^|[^0-9a-z.\\/^])${esc}(?![0-9a-z\\/]|\\.\\d)`, 'i').test(spaced)) return f;
    } else if (flat.includes(norm(f))) return f;
  }
  return null;
}

const TONE_BLOCKLIST = /\b(obviously|easy|simply|just do|stupid|dumb|idiot|lazy|wrong again|as i said)\b/i;

export interface GuardContext {
  task: TutorTask;
  forbidden: string[];
  verifierMisconception: MisconceptionId | null;
  /** The checker's verdict on the latest work; replies must not contradict it. */
  verdict?: 'WRONG' | 'CORRECT' | null;
}

const PRAISE = /\b(correct(ly)?|well done|great( job| work)?|good job|nice( work| job)?|perfect|exactly right|that'?s right|you'?ve got it|spot on)\b/i;
const NEGATED_PRAISE = /\b(not|isn'?t|wasn'?t|aren'?t|almost|nearly)\s+(quite\s+)?(correct|right)\b/i;
const CRITICISM = /\b(not quite|incorrect|is wrong|was wrong|changed the (solution|answer|value))\b/i;

/** A reply that praises a line the checker marked wrong (or criticises a correct one) is rejected. */
export function contradictsVerdict(message: string, feedbackType: string, verdict: GuardContext['verdict']): boolean {
  if (verdict === 'WRONG') return feedbackType === 'affirm' || (PRAISE.test(message) && !NEGATED_PRAISE.test(message));
  if (verdict === 'CORRECT') return feedbackType === 'correct_error' || CRITICISM.test(message);
  return false;
}

export type GuardResult =
  | { ok: true; response: TutorResponse; notes: string[] }
  | { ok: false; reason: string };

export function applyGuards(value: unknown, ctx: GuardContext): GuardResult {
  const parsed = tutorResponseZ.safeParse(value);
  if (!parsed.success) return { ok: false, reason: `schema: ${parsed.error.issues[0]?.path.join('.')}` };
  const r = { ...parsed.data };
  const notes: string[] = [];

  const leaked = leaks(r.tutor_message, ctx.forbidden);
  if (leaked) return { ok: false, reason: `leak: "${leaked}"` };

  if (TONE_BLOCKLIST.test(r.tutor_message)) return { ok: false, reason: 'tone' };

  if (contradictsVerdict(r.tutor_message, r.feedback_type, ctx.verdict)) {
    return { ok: false, reason: ctx.verdict === 'WRONG' ? 'praised a wrong line' : 'criticised a correct line' };
  }

  const q = (r.tutor_message.match(/\?/g) ?? []).length;
  const questionOptional = ctx.task === 'celebrate';
  if (q === 0 && !questionOptional) return { ok: false, reason: 'no question' };
  if (q > 1) {
    r.tutor_message = r.tutor_message.slice(0, r.tutor_message.indexOf('?') + 1);
    notes.push('trimmed to one question');
  }

  if (r.tutor_message.length > 300) {
    const cut = r.tutor_message.slice(0, 300);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    r.tutor_message = end > 40 ? cut.slice(0, end + 1) : cut;
    notes.push('truncated');
  }

  // the verifier's deterministic guess wins; model proposals below 0.6 confidence are ignored
  if (ctx.verifierMisconception) r.detected_misconception = ctx.verifierMisconception;
  else if (!isMisconceptionId(r.detected_misconception) || r.confidence < 0.6) r.detected_misconception = 'none';

  return { ok: true, response: r, notes };
}

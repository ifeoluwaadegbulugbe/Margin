import { Schema } from 'firebase/ai';
import { z } from 'zod';
import { MISCONCEPTION_IDS } from '@/content/misconceptions';

const RESPONSE_TYPES = ['question', 'feedback_question', 'hint', 'celebrate', 'redirect'] as const;
const FEEDBACK_TYPES = ['affirm', 'correct_error', 'partial', 'neutral', 'encourage'] as const;
const UNDERSTANDING = ['understands', 'partial', 'confused', 'off_topic'] as const;
const EXPLANATION = ['sound', 'partial', 'missing', 'not_applicable'] as const;
const MISC = [...MISCONCEPTION_IDS, 'none'] as string[];

/** Cloud structured output (inCloudParams.generationConfig.responseSchema). */
export const tutorResponseSchema = Schema.object({
  properties: {
    response_type: Schema.enumString({ enum: [...RESPONSE_TYPES] }),
    tutor_message: Schema.string(),
    feedback_type: Schema.enumString({ enum: [...FEEDBACK_TYPES] }),
    detected_misconception: Schema.enumString({ enum: MISC }),
    understanding_signal: Schema.enumString({ enum: [...UNDERSTANDING] }),
    explanation_quality: Schema.enumString({ enum: [...EXPLANATION] }),
    should_advance: Schema.boolean(),
    confidence: Schema.number(),
  },
});

/** On-device structured output (onDeviceParams.promptOptions.responseConstraint): plain JSON Schema. */
export const tutorResponseJsonSchema = {
  type: 'object',
  properties: {
    response_type: { type: 'string', enum: [...RESPONSE_TYPES] },
    tutor_message: { type: 'string', maxLength: 300 },
    feedback_type: { type: 'string', enum: [...FEEDBACK_TYPES] },
    detected_misconception: { type: 'string', enum: MISC },
    understanding_signal: { type: 'string', enum: [...UNDERSTANDING] },
    explanation_quality: { type: 'string', enum: [...EXPLANATION] },
    should_advance: { type: 'boolean' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['response_type', 'tutor_message', 'feedback_type', 'detected_misconception', 'understanding_signal', 'explanation_quality', 'should_advance', 'confidence'],
  additionalProperties: false,
} as const;

/** App-side validation: schema enforcement can still produce semantically bad content. */
export const tutorResponseZ = z.object({
  response_type: z.enum(RESPONSE_TYPES),
  tutor_message: z.string().min(2),
  feedback_type: z.enum(FEEDBACK_TYPES),
  detected_misconception: z.string(),
  understanding_signal: z.enum(UNDERSTANDING),
  explanation_quality: z.enum(EXPLANATION),
  should_advance: z.boolean(),
  confidence: z.number().min(0).max(1).catch(0.5),
});
export type TutorResponse = z.infer<typeof tutorResponseZ>;

export const strategistSchema = Schema.object({
  properties: {
    recurring_misconceptions: Schema.array({
      items: Schema.object({
        properties: {
          id: Schema.string(),
          evidence_count: Schema.number(),
          sessions_seen: Schema.number(),
          severity: Schema.enumString({ enum: ['low', 'medium', 'high'] }),
          student_explanation: Schema.string(),
          nova_watch_phrase: Schema.string(),
        },
      }),
    }),
    strengths: Schema.array({ items: Schema.string() }),
    next_expedition: Schema.object({
      properties: {
        skill_id: Schema.string(),
        problem_ids: Schema.array({ items: Schema.string() }),
        reason: Schema.string(),
        focus: Schema.string(),
      },
    }),
    revision_queue: Schema.array({ items: Schema.string() }),
    difficulty_adjustment: Schema.enumString({ enum: ['easier', 'same', 'harder'] }),
    coach_note: Schema.string(),
  },
});

export const strategistZ = z.object({
  recurring_misconceptions: z.array(z.object({
    id: z.string(),
    evidence_count: z.number(),
    sessions_seen: z.number(),
    severity: z.enum(['low', 'medium', 'high']),
    student_explanation: z.string(),
    nova_watch_phrase: z.string(),
  })),
  strengths: z.array(z.string()),
  next_expedition: z.object({
    skill_id: z.string(),
    problem_ids: z.array(z.string()),
    reason: z.string(),
    focus: z.string(),
  }),
  revision_queue: z.array(z.string()),
  difficulty_adjustment: z.enum(['easier', 'same', 'harder']),
  coach_note: z.string(),
});
export type StrategistOutput = z.infer<typeof strategistZ>;

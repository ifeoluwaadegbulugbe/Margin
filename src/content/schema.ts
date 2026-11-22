import { z } from 'zod';
import { MISCONCEPTION_IDS } from './misconceptions';

const misconceptionZ = z.enum(MISCONCEPTION_IDS as [string, ...string[]]);

export const stepZ = z.object({
  id: z.number().int(),
  objective: z.string().min(3),
  exampleLine: z.string().min(1),
  alt: z.array(z.string()).optional(),
});

export const problemZ = z.object({
  id: z.string().regex(/^[A-Z]{2}-\d{2}$/),
  skillId: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  statement: z.string().min(3),
  latex: z.string().optional(),
  verifier: z.enum(['linearEquation', 'numeric']),
  variable: z.string().length(1).optional(),
  answer: z.number(),
  requireSimplest: z.boolean().optional(),
  objective: z.string(),
  steps: z.array(stepZ).min(1),
  distractors: z.array(z.object({ value: z.number(), misconception: misconceptionZ, atStep: z.number().int().optional() })),
  hints: z.object({
    '1': z.string(),
    '2': z.string(),
    '3': z.string(),
    '4': z.object({ problem: z.string(), lines: z.array(z.string()).min(1), answer: z.number() }),
  }),
  explainPrompt: z.string(),
  transferId: z.string().optional(),
  transferOnly: z.boolean().optional(),
  tags: z.array(z.string()),
});

export type Problem = z.infer<typeof problemZ>;

export const skillZ = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  description: z.string(),
  objectives: z.array(z.string()),
  prerequisites: z.array(z.string()),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  minutes: z.number(),
  x: z.number(),
  y: z.number(),
});
export type Skill = z.infer<typeof skillZ>;

export const constellationZ = z.object({
  id: z.string(),
  name: z.string(),
  subject: z.string(),
  skills: z.array(skillZ),
});
export type Constellation = z.infer<typeof constellationZ>;

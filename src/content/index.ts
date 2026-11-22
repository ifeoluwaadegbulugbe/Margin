import { z } from 'zod';
import { constellationZ, problemZ, type Problem, type Skill } from './schema';
import constellationJson from './algebra/constellation.json';
import negNumbers from './algebra/neg-numbers.json';
import orderOps from './algebra/order-ops.json';
import fractions from './algebra/fractions.json';
import twoStep from './algebra/two-step.json';
import multiStep from './algebra/multi-step.json';

export const CONSTELLATION = constellationZ.parse(constellationJson);
export const SKILLS: Skill[] = CONSTELLATION.skills;
export const PROBLEMS: Problem[] = z
  .array(problemZ)
  .parse([...negNumbers, ...orderOps, ...fractions, ...twoStep, ...multiStep]);

const byId = new Map(PROBLEMS.map((p) => [p.id, p]));
const skillById = new Map(SKILLS.map((s) => [s.id, s]));

export const getProblem = (id: string): Problem | undefined => byId.get(id);
export const getSkill = (id: string): Skill | undefined => skillById.get(id);
export const coreProblems = (skillId: string) => PROBLEMS.filter((p) => p.skillId === skillId && !p.transferOnly);

export type { Problem, Skill };

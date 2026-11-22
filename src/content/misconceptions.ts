export const MISCONCEPTIONS = {
  'M-SIGN-MOVE': {
    name: 'Moved a term across = without changing its sign',
    watch: "keeps the original sign when moving a term across '='",
    concept: 'Moving a term really means doing the opposite operation to both sides.',
  },
  'M-INV-OP': {
    name: 'Used the wrong undo operation',
    watch: 'uses the wrong inverse operation (e.g. subtracting instead of dividing)',
    concept: 'Multiplying is undone by dividing; adding is undone by subtracting.',
  },
  'M-ONE-SIDE': {
    name: 'Changed only one side of the equation',
    watch: 'sometimes changes only one side of the equation',
    concept: 'Whatever you do to one side, you must do to the other to keep it balanced.',
  },
  'M-DIST-FIRST': {
    name: 'Multiplied only the first term in the bracket',
    watch: 'multiplies only the first term inside a bracket',
    concept: 'The number outside a bracket multiplies every term inside it.',
  },
  'M-NEG-MULT': {
    name: 'Sign error multiplying or dividing negatives',
    watch: 'gets the sign wrong when multiplying or dividing negatives',
    concept: 'Two negatives multiply to a positive; one negative gives a negative.',
  },
  'M-NEG-SUB': {
    name: 'Treated subtracting a negative as subtracting',
    watch: 'treats subtracting a negative as ordinary subtraction',
    concept: 'Subtracting a negative is the same as adding its opposite.',
  },
  'M-BODMAS-LTR': {
    name: 'Worked left to right, ignoring order of operations',
    watch: 'works strictly left to right instead of following order of operations',
    concept: 'Brackets, then powers, then multiply/divide, then add/subtract.',
  },
  'M-FRAC-ADD': {
    name: 'Added the tops and the bottoms',
    watch: 'adds numerators and denominators separately',
    concept: 'Fractions need a common denominator before you add them.',
  },
  'M-FRAC-DIV': {
    name: 'Divided fractions without flipping the second',
    watch: 'divides fractions without flipping the second one',
    concept: 'Dividing by a fraction is multiplying by its reciprocal.',
  },
  'M-COLLECT': {
    name: 'Combined unlike terms',
    watch: 'combines x terms with plain numbers',
    concept: 'Only like terms (all x terms, or all numbers) can be combined.',
  },
} as const;

export type MisconceptionId = keyof typeof MISCONCEPTIONS;
export const MISCONCEPTION_IDS = Object.keys(MISCONCEPTIONS) as MisconceptionId[];
export const isMisconceptionId = (s: string): s is MisconceptionId => s in MISCONCEPTIONS;

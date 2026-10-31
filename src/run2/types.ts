import { z } from 'zod';

export const DIMENSIONS = ['agent', 'action', 'patient', 'tense'] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export const PRESENTATIONS = ['ids', 'inline', 'inline-shuffled'] as const;
export type Presentation = (typeof PRESENTATIONS)[number];

export const PRESSURES = ['none', 'framing', 'game'] as const;
export type Pressure = (typeof PRESSURES)[number];

const DimensionSchema = z.enum(DIMENSIONS);

const DefaultsSchema = z.object({
  model: z.string(),
  maxOutputTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2),
  listenerTemperature: z.number().min(0).max(2),
  sampleFraction: z.number().gt(0).lte(1),
  maxTrainingTokens: z.number().int().positive(),
  maxGenerations: z.number().int().positive(),
  stasisWindow: z.number().int().positive(),
  stasisEpsilon: z.number().min(0),
  chains: z.number().int().positive(),
  testItems: z.number().int().positive(),
  confusionsShown: z.number().int().positive(),
  postTest: z.boolean(),
  concurrency: z.number().int().positive(),
});

const ConditionSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    phase: z.number().int().positive(),
    description: z.string().optional(),
    presentation: z.enum(PRESENTATIONS),
    pressure: z.enum(PRESSURES),
    fieldOrder: z
      .array(DimensionSchema)
      .length(4)
      .default(['agent', 'action', 'patient', 'tense']),
    agentLabels: z.array(z.string()).length(5).optional(),
    actionLabels: z.array(z.string()).length(5).optional(),
    model: z.string().optional(),
    chains: z.number().int().positive().optional(),
    maxGenerations: z.number().int().positive().optional(),
    temperature: z.number().min(0).max(2).optional(),
  })
  .superRefine((cond, ctx) => {
    if (new Set(cond.fieldOrder).size !== 4) {
      ctx.addIssue({ code: 'custom', message: 'fieldOrder must contain each dimension once' });
    }
    if (cond.pressure !== 'none' && cond.presentation === 'ids') {
      ctx.addIssue({
        code: 'custom',
        message: 'framing and game pressure need an inline presentation',
      });
    }
  });

export const Run2ConfigSchema = z
  .object({
    baseSeed: z.number().int(),
    defaults: DefaultsSchema,
    conditions: z.array(ConditionSchema).min(1),
  })
  .superRefine((cfg, ctx) => {
    const names = cfg.conditions.map((c) => c.name);
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: 'custom', message: 'condition names must be unique' });
    }
  });

export type Run2Config = z.infer<typeof Run2ConfigSchema>;
export type Defaults = z.infer<typeof DefaultsSchema>;
export type ConditionConfig = z.infer<typeof ConditionSchema>;

export interface ResolvedCondition extends ConditionConfig {
  model: string;
  chains: number;
  maxGenerations: number;
  temperature: number;
}

export function resolveCondition(config: Run2Config, cond: ConditionConfig): ResolvedCondition {
  const d = config.defaults;
  return {
    ...cond,
    model: cond.model ?? d.model,
    chains: cond.chains ?? d.chains,
    maxGenerations: cond.maxGenerations ?? d.maxGenerations,
    temperature: cond.temperature ?? d.temperature,
  };
}

export interface CommunicationResult {
  total: number;
  correct: number;
  accuracy: number;
  // Accuracy on test meanings the listener was not shown an example of.
  // undefined when every test meaning was in the sample.
  heldOutAccuracy: number | undefined;
  perDimension: Record<Dimension, number>;
}

export interface CommunicationRecord {
  pre: CommunicationResult;
  revised: boolean;
  post?: CommunicationResult;
}

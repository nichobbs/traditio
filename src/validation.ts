import { z } from 'zod';
import type { LanguagePair } from './types.js';

const LanguagePairSchema = z.object({
  meaningId: z.string().min(1),
  form: z.string().min(1).max(40).regex(/^[a-z]+$/),
});

const LanguageResponseSchema = z.array(LanguagePairSchema);

export function validateLanguageResponse(data: unknown): LanguagePair[] {
  return LanguageResponseSchema.parse(data);
}

export type ValidationError = z.ZodError;

export function formatValidationError(error: ValidationError): string {
  return error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('\n');
}
